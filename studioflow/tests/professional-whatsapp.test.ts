import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import {
  realWhatsAppContacts,
  whatsappDestination,
} from "../src/lib/whatsapp-contacts";
import { assertProfessionalChannel } from "../src/lib/professional-scope";
import { inviteRedirect as safeInviteRedirect } from "../src/lib/invite-redirect";

test("actual contact numbers: exclude own number, groups, LIDs and malformed records; deduplicate without inventing names", () => {
  assert.equal(
    whatsappDestination({
      contactPhone: "4155552671",
      contactRef: "wa:14155552671",
    }),
    "+14155552671",
  );
  assert.equal(
    whatsappDestination({ contactPhone: "11998765432" }),
    "11998765432",
  );
  assert.deepEqual(
    realWhatsAppContacts(
      [
        { remoteJid: "5511987654321@s.whatsapp.net", pushName: "Me" },
        { remoteJid: "5511998765432@s.whatsapp.net", pushName: " Ana " },
        { remoteJid: "5511998765432@s.whatsapp.net", pushName: "" },
        { remoteJid: "14155552671@s.whatsapp.net" },
        { remoteJid: "123456789012345@lid", pushName: "Not a phone" },
        { remoteJid: "5511999999999@g.us" },
        { remoteJid: "status@broadcast" },
        { remoteJid: "5511999999999@s.whatsapp.net", isGroup: true },
        null,
      ],
      "5511987654321",
    ),
    [
      { phone: "5511998765432", name: "Ana" },
      { phone: "14155552671", name: "" },
    ],
  );
});

test("professional scope refuses shop / other accounts and invite redirects never leave the invite route", () => {
  const member = { role: "professional", professionalId: "own" };
  assert.doesNotThrow(() => assertProfessionalChannel(member, "own"));
  for (const id of [undefined, null, "other"])
    assert.throws(() => assertProfessionalChannel(member, id));
  assert.throws(() =>
    assertProfessionalChannel({ role: "professional" }, "own"),
  );
  assert.doesNotThrow(() =>
    assertProfessionalChannel({ role: "owner" }, "other"),
  );
  const path = "/equipe/convite/" + "A".repeat(43);
  assert.equal(safeInviteRedirect(path), path);
  for (const invalid of [
    "https://evil.test",
    "//evil.test",
    "/dashboard",
    path + "?next=evil",
  ])
    assert.equal(safeInviteRedirect(invalid), null);
});

test("professional invite is consumed atomically; database isolates each phone book and conversation even within the same salon", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  try {
    await db.exec(
      `create schema extensions; create schema auth; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema auth to authenticated,service_role; create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; set search_path=public,extensions;`,
    );
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(name, directory), "utf8"));
    await db.query(
      `insert into auth.users(id,email) values ($1,'owner@salon.test'),($2,'barber@salon.test'),($3,'other@salon.test')`,
      [owner, user, other],
    );
    await db.exec("set role service_role");
    await db.query(`select public.create_workspace($1,'salon',$2::jsonb)`, [
      owner,
      JSON.stringify({
        name: "Salon",
        category: "Barbearia",
        cover: "",
        services: [{ name: "Corte", duration: 40, price: 50 }],
        professionalNames: ["Lucas", "Ana"],
        openDays: [1, 2, 3, 4, 5, 6],
        openStart: "09:00",
        openEnd: "19:00",
      }),
    ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        `select id,tenant_id from public.businesses where slug='salon'`,
      )
    ).rows[0];
    const pros = (
      await db.query<{ id: string }>(
        `select id from public.professionals where business_id=$1 order by name`,
        [biz.id],
      )
    ).rows;
    assert.equal(pros.length, 2);
    const own = pros[0].id,
      second = pros[1].id;
    const hash = Buffer.alloc(32, 1),
      replaced = Buffer.alloc(32, 2);
    await assert.rejects(
      db.query("select public.create_professional_invite($1,$2,$3,$4,$5)", [
        biz.id,
        own,
        other,
        "barber@salon.test",
        hash,
      ]),
      /forbidden/,
    );
    await db.query("select public.create_professional_invite($1,$2,$3,$4,$5)", [
      biz.id,
      own,
      owner,
      "barber@salon.test",
      hash,
    ]);
    await assert.rejects(
      db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
        hash,
        user,
        "wrong@salon.test",
        true,
      ]),
      /wrong-account/,
    );
    await assert.rejects(
      db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
        hash,
        user,
        "barber@salon.test",
        false,
      ]),
      /wrong-account/,
    );
    await db.query("select public.create_professional_invite($1,$2,$3,$4,$5)", [
      biz.id,
      own,
      owner,
      "barber@salon.test",
      replaced,
    ]);
    await assert.rejects(
      db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
        hash,
        user,
        "barber@salon.test",
        true,
      ]),
      /invalid-invite/,
    );
    await db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
      replaced,
      user,
      "barber@salon.test",
      true,
    ]);
    await assert.rejects(
      db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
        replaced,
        user,
        "barber@salon.test",
        true,
      ]),
      /invalid-invite/,
    );
    await db.query("select public.create_professional_invite($1,$2,$3,$4,$5)", [
      biz.id,
      second,
      owner,
      "owner@salon.test",
      hash,
    ]);
    await assert.rejects(
      db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
        hash,
        owner,
        "owner@salon.test",
        true,
      ]),
      /existing-team-account/,
    );
    const messages: string[] = [];
    for (const [index, professionalId] of [own, second].entries()) {
      const customer = (
        await db.query<{ id: string }>(
          `insert into public.customers(tenant_id,business_id,name,phone) values($1,$2,$3,$4) returning id`,
          [
            biz.tenant_id,
            biz.id,
            `Client ${index}`,
            index ? "11987654322" : "11987654321",
          ],
        )
      ).rows[0];
      await db.query(
        `insert into public.appointments(tenant_id,business_id,customer_id,professional_id,customer_name,customer_phone,"start","end",occupied_end,price) values($1,$2,$3,$4,$5,$6,now()+interval '1 day',now()+interval '1 day 40 minutes',now()+interval '1 day 40 minutes',50)`,
        [
          biz.tenant_id,
          biz.id,
          customer.id,
          professionalId,
          `Client ${index}`,
          index ? "11987654322" : "11987654321",
        ],
      );
    }
    for (const professionalId of [own, second, null]) {
      await db.query(
        `insert into public.whatsapp_contacts(tenant_id,business_id,professional_id,channel_key,phone,name) values($1,$2,$3,$4,'5511998765432','Actual contact') on conflict(business_id,channel_key,phone) do update set name=excluded.name`,
        [biz.tenant_id, biz.id, professionalId, professionalId || "shop"],
      );
      const c = (
        await db.query<{ id: string }>(
          `insert into public.conversations(tenant_id,business_id,channel,contact_phone,whatsapp_professional_id) values($1,$2,'whatsapp','11998765432',$3) returning id`,
          [biz.tenant_id, biz.id, professionalId],
        )
      ).rows[0];
      messages.push(c.id);
      await db.query(
        `insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body) values($1,$2,$3,'customer','Horários?')`,
        [biz.tenant_id, biz.id, c.id],
      );
    }
    await db.exec("reset role; set role authenticated");
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      user,
    ]);
    assert.equal(
      (await db.query("select * from public.appointments")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.customers")).rows.length,
      1,
    );
    assert.deepEqual(
      (
        await db.query<{ id: string }>("select id from public.conversations")
      ).rows.map((r) => r.id),
      [messages[0]],
    );
    assert.equal(
      (await db.query("select * from public.conversation_messages")).rows
        .length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.whatsapp_contacts")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(`update public.whatsapp_contacts set name='Tampered'`),
    );
    await assert.rejects(
      db.query("select * from public.professional_access_invites"),
    );
    await assert.rejects(
      db.query("select public.accept_professional_invite($1,$2,$3,$4)", [
        hash,
        user,
        "owner@salon.test",
        true,
      ]),
    );
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      owner,
    ]);
    assert.equal(
      (await db.query("select * from public.appointments")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select * from public.customers")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select * from public.conversations")).rows.length,
      3,
    );
    assert.equal(
      (await db.query("select * from public.whatsapp_contacts")).rows.length,
      3,
    );
    await db.exec("reset role; set role service_role");
    await db.query("update public.professionals set active=false where id=$1", [
      own,
    ]);
    await db.exec("reset role; set role authenticated");
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      user,
    ]);
    assert.equal(
      (await db.query("select * from public.conversations")).rows.length,
      0,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.whatsapp_contacts"));
  } finally {
    await db.close();
  }
});
