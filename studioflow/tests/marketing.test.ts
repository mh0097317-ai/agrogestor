import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import {
  ideaSchema,
  marketingSystemPrompt,
  nextSlots,
  normalizeIdea,
  rowToPost,
} from "../src/services/marketing/content";

test("marketing: carrossel com uma tela vira post e as hashtags entram na legenda", () => {
  const idea = ideaSchema.parse({
    format: "carousel",
    theme: "Faltas",
    slides: [{ title: "Cliente que some", body: "" }],
    caption: "Cliente marcou e não veio?",
    hashtags: ["barbearia", "#barbeiro", "barbearia"],
  });
  const out = normalizeIdea(idea);
  assert.equal(out.format, "post");
  assert.equal(out.slides.length, 1);
  assert.match(out.caption, /#barbearia #barbeiro$/);
});

test("marketing: hashtag estranha é recusada e o prompt proíbe números inventados", () => {
  assert.equal(
    ideaSchema.safeParse({ format: "post", theme: "x y", slides: [{ title: "a" }], caption: "Uma legenda boa", hashtags: ["#com espaço"] }).success,
    false,
  );
  const prompt = marketingSystemPrompt("tom leve");
  assert.match(prompt, /Não invente/);
  assert.match(prompt, /tom leve/);
});

test("marketing: horários espalhados na semana, no horário de Brasília, sem repetir dia", () => {
  const now = new Date("2026-10-14T15:00:00Z");
  const slots = nextSlots(3, 12, ["2026-10-15T15:00:00.000Z"], 3, now);
  assert.equal(slots.length, 3);
  for (const s of slots) assert.equal(new Date(s).getUTCHours(), 15);
  assert.ok(!slots.includes("2026-10-15T15:00:00.000Z"));
  assert.equal(new Set(slots.map((s) => s.slice(0, 10))).size, 3);
  assert.ok(slots.every((s) => Date.parse(s) > now.getTime()));
});

test("marketing: telas fora do formato não quebram a leitura do post", () => {
  const post = rowToPost({ id: "x", status: "draft", format: "post", slides: "lixo", created_at: "2026-10-14T00:00:00Z" });
  assert.deepEqual(post.slides, []);
});

test("marketing: tabelas só do servidor e cada post publicado uma vez", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(`create schema extensions;create schema auth;create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create role anon;create role authenticated;create role service_role bypassrls;
      grant usage on schema auth to authenticated,service_role;
      create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      set search_path=public,extensions;`);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(name, dir), "utf8"));
    assert.equal((await db.query("select 1 from storage.buckets where id='marketing' and public")).rows.length, 1);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from marketing_posts"), /permission/);
    await assert.rejects(db.query("select * from marketing_account"), /permission/);
    await assert.rejects(db.query("select claim_marketing_post()"), /permission/);
    await db.exec("reset role; set role service_role");
    await db.query(
      `insert into marketing_posts(format,theme,slides,caption,status,scheduled_for) values
       ('post','a','[{"title":"A","body":""}]','x','scheduled',now()-interval '1 minute'),
       ('post','b','[{"title":"B","body":""}]','x','scheduled',now()+interval '1 day'),
       ('post','c','[{"title":"C","body":""}]','x','draft',null)`,
    );
    const first = (await db.query<{ id: string | null }>("select claim_marketing_post() id")).rows[0].id;
    assert.ok(first);
    assert.equal((await db.query<{ id: string | null }>("select claim_marketing_post() id")).rows[0].id, null, "o futuro e o rascunho esperam");
    assert.equal((await db.query<{ status: string }>("select status from marketing_posts where id=$1", [first])).rows[0].status, "publishing");
    await assert.rejects(
      db.query("insert into marketing_posts(format,video_url) values('reel','http://inseguro.com/v.mp4')"),
      /check/,
    );
  } finally {
    await db.close();
  }
});
