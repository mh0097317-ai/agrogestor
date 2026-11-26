import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/*
 * Estruturas da evolução comercial, num PostgreSQL de verdade (PGlite) com
 * todas as migrações aplicadas em ordem, como no Supabase.
 */
async function database() {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(
    `create schema extensions;create schema auth;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
  );
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort();
  for (const name of files) await db.exec(await readFile(new URL(name, directory), "utf8"));
  return db;
}

test("limite persistente: conta por janela e só o servidor usa", async () => {
  const db = await database();
  try {
    await db.exec("set role service_role;");
    const hit = async () =>
      (await db.query<{ ok: boolean }>("select public.rate_limit_hit('chat:abc',2,600) as ok")).rows[0].ok;
    assert.equal(await hit(), true);
    assert.equal(await hit(), true);
    assert.equal(await hit(), false);
    // Janela vencida recomeça a contagem.
    await db.exec("update public.rate_limits set window_start = now() - interval '11 minutes'");
    assert.equal(await hit(), true);
    await db.exec("reset role;set role authenticated;");
    await assert.rejects(db.query("select public.rate_limit_hit('x',1,60)"));
    await assert.rejects(db.query("select * from public.rate_limits"));
    await db.exec("reset role;set role anon;");
    await assert.rejects(db.query("select public.rate_limit_hit('x',1,60)"));
  } finally {
    await db.close();
  }
});

test("planos: vitrine pública só com planos ativos e sem escrita de fora", async () => {
  const db = await database();
  try {
    await db.exec("reset role;set role anon;");
    const plans = (await db.query<{ key: string; monthly_cents: number | null }>(
      "select key, monthly_cents from public.platform_plans order by sort",
    )).rows;
    assert.deepEqual(plans.map((p) => p.key), ["essencial", "profissional", "premium"]);
    // Nenhum preço inventado: nasce vazio.
    assert.ok(plans.every((p) => p.monthly_cents === null));
    await assert.rejects(db.query("select updated_by from public.platform_plans"));
    await assert.rejects(db.query("update public.platform_plans set monthly_cents = 1"));
    await assert.rejects(db.query("select * from public.platform_subscription_requests"));
    await db.exec("reset role;set role service_role;");
    await db.exec("update public.platform_plans set active = false where key = 'premium'");
    await db.exec("reset role;set role anon;");
    assert.equal((await db.query("select key from public.platform_plans")).rows.length, 2);
  } finally {
    await db.close();
  }
});

test("assinatura no cartão: cobrança registrada uma vez, paga soma 30 dias uma vez", async () => {
  const db = await database();
  try {
    const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await db.query("insert into auth.users(id,email)values($1,'dono@sub.test')", [owner]);
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,'casa-sub',$2::jsonb)", [
      owner,
      JSON.stringify({ name: "Casa", category: "Barbearia", cover: "", services: [{ name: "Corte", duration: 40, price: 50 }], professionalNames: ["Lucas"], openDays: [1, 2, 3, 4, 5, 6], openStart: "09:00", openEnd: "19:00" }),
    ]);
    const biz = (await db.query<{ id: string }>("select id from public.businesses where slug='casa-sub'")).rows[0].id;
    await db.query("update public.businesses set platform_subscription_id='sub_123' where id=$1", [biz]);
    await db.query("insert into public.platform_access(business_id,status,access_until) values($1,'active',now()+interval '2 days') on conflict (business_id) do update set status='active', access_until=now()+interval '2 days'", [biz]);
    // Fatura avulsa em aberto: a assinatura assume.
    await db.query("insert into public.platform_invoices(business_id,asaas_charge_id,value,due_date) values($1,'pay_avulsa',99,current_date)", [biz]);
    const charge = (paid: boolean) =>
      db.query("select public.platform_subscription_charge($1,'pay_sub_1','sub_123',99,current_date,'https://x',$2)", [biz, paid]);
    await charge(false);
    await charge(false);
    const invoices = (await db.query<{ asaas_charge_id: string; status: string }>("select asaas_charge_id,status from public.platform_invoices where business_id=$1 order by created_at", [biz])).rows;
    assert.deepEqual(invoices.map((i) => `${i.asaas_charge_id}:${i.status}`), ["pay_avulsa:cancelled", "pay_sub_1:pending"]);
    const before = (await db.query<{ access_until: string }>("select access_until from public.platform_access where business_id=$1", [biz])).rows[0].access_until;
    await charge(true);
    await charge(true);
    const after = (await db.query<{ access_until: string }>("select access_until from public.platform_access where business_id=$1", [biz])).rows[0].access_until;
    const days = Math.round((Date.parse(after) - Date.parse(before)) / 86400000);
    assert.equal(days, 30);
    // Aviso de outra assinatura não entra nesta casa.
    await assert.rejects(db.query("select public.platform_subscription_charge($1,'pay_x','sub_999',99,current_date,'',true)", [biz]), /subscription mismatch/);
    await db.exec("reset role;set role authenticated;");
    await assert.rejects(db.query("select public.platform_subscription_charge($1,'pay_y','sub_123',99,current_date,'',true)", [biz]));
  } finally {
    await db.close();
  }
});

test("custo da IA: tokens somados por modelo e dia; rastro da IA só no servidor", async () => {
  const db = await database();
  try {
    const owner = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await db.query("insert into auth.users(id,email)values($1,'dono@ia.test')", [owner]);
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,'casa-ia',$2::jsonb)", [
      owner,
      JSON.stringify({ name: "Casa", category: "Barbearia", cover: "", services: [{ name: "Corte", duration: 40, price: 50 }], professionalNames: ["Lucas"], openDays: [1, 2, 3, 4, 5, 6], openStart: "09:00", openEnd: "19:00" }),
    ]);
    const biz = (await db.query<{ id: string; tenant_id: string }>("select id,tenant_id from public.businesses where slug='casa-ia'")).rows[0];
    for (let i = 0; i < 2; i++)
      await db.query("select public.assistant_add_model_tokens($1,'claude-sonnet-5-5',1000,200)", [biz.id]);
    await db.query("select public.assistant_add_model_tokens($1,'claude-haiku-4-5',500,0)", [biz.id]);
    const rows = (await db.query<{ model: string; input_tokens: string; output_tokens: string }>(
      "select model,input_tokens,output_tokens from public.assistant_model_usage where business_id=$1 order by model", [biz.id],
    )).rows;
    assert.deepEqual(rows.map((r) => `${r.model}:${r.input_tokens}:${r.output_tokens}`), [
      "claude-haiku-4-5:500:0",
      "claude-sonnet-5-5:2000:400",
    ]);
    // business_ai_plan recebe o grant padrão do Supabase (aqui, o dono do banco grava).
    await db.exec("reset role;");
    await db.query("insert into public.business_ai_plan(business_id,monthly_budget_cents) values($1,5000)", [biz.id]);
    await assert.rejects(db.query("update public.business_ai_plan set monthly_budget_cents=-1"));
    await db.exec("set role service_role;");
    await db.query("insert into public.platform_settings(id,usd_brl) values('default',5.4) on conflict (id) do update set usd_brl=5.4");
    await assert.rejects(db.query("update public.platform_settings set usd_brl=0.5"));
    const conv = (await db.query<{ id: string }>(
      "insert into public.conversations(tenant_id,business_id,channel,contact_phone,contact_name) values($1,$2,'whatsapp','62999990000','Ana') returning id",
      [biz.tenant_id, biz.id],
    )).rows[0].id;
    await db.query("insert into public.assistant_tool_events(business_id,conversation_id,tool,ok,summary) values($1,$2,'agendar',true,'marcado')", [biz.id, conv]);
    await db.exec("reset role;set role authenticated;");
    await assert.rejects(db.query("select * from public.assistant_tool_events"));
    await assert.rejects(db.query("select * from public.assistant_model_usage"));
    await assert.rejects(db.query("select public.assistant_add_model_tokens($1,'x-model',1,1)", [biz.id]));
  } finally {
    await db.close();
  }
});

test("despesas: valores e categorias conferidos no banco, só o servidor lê", async () => {
  const db = await database();
  try {
    const id = (await db.query<{ id: string }>(
      "with t as (insert into public.tenants(name) values ('T') returning id) insert into public.businesses(tenant_id, name, slug, category) select id, 'Casa', 'casa-despesas', 'barbearia' from t returning id",
    )).rows[0].id;
    await db.exec("set role service_role;");
    await db.query(
      "insert into public.business_expenses(business_id,category,description,amount_cents,due_date) values ($1,'aluguel','Aluguel',150000,'2026-11-05')",
      [id],
    );
    await assert.rejects(db.query(
      "insert into public.business_expenses(business_id,category,description,amount_cents,due_date) values ($1,'aluguel','Aluguel',0,'2026-11-05')",
      [id],
    ));
    await assert.rejects(db.query(
      "insert into public.business_expenses(business_id,category,description,amount_cents,due_date) values ($1,'festa','Festa',100,'2026-11-05')",
      [id],
    ));
    await db.exec("reset role;set role authenticated;");
    await assert.rejects(db.query("select * from public.business_expenses"));
    await db.exec("reset role;set role anon;");
    await assert.rejects(db.query("select * from public.business_expenses"));
  } finally {
    await db.close();
  }
});

test("consentimento: nasce falso e o histórico é só do servidor", async () => {
  const db = await database();
  try {
    const cols = (await db.query<{ column_name: string; column_default: string | null }>(
      "select column_name, column_default from information_schema.columns where table_name='customers' and column_name in ('birth_date','marketing_consent')",
    )).rows;
    assert.equal(cols.find((c) => c.column_name === "marketing_consent")?.column_default, "false");
    assert.ok(cols.some((c) => c.column_name === "birth_date"));
    await db.exec("set role authenticated;");
    await assert.rejects(db.query("select * from public.customer_consent_events"));
    await db.exec("reset role;set role anon;");
    await assert.rejects(db.query("insert into public.customer_consent_events(business_id,customer_id,consent,source) values (gen_random_uuid(),gen_random_uuid(),true,'painel')"));
  } finally {
    await db.close();
  }
});
