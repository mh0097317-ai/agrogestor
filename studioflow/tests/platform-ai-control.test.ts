import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  platformAiEnabled,
  platformAiSchema,
} from "../src/services/platform-ai-control";
import {
  processConversation,
  type ConversationRepo,
} from "../src/services/assistant/conversations";

test("global AI switch is off by default and cannot be changed by tenant members", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261013133125_platform_ai_control.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select enabled from platform_ai_control",
        )
      ).rows[0].enabled,
      false,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.exec("update platform_ai_control set enabled=true"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select * from platform_ai_control"),
      /permission denied/,
    );
    await db.exec(
      "reset role; set role service_role; update platform_ai_control set enabled=true",
    );
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select enabled from platform_ai_control",
        )
      ).rows[0].enabled,
      true,
    );
  } finally {
    await db.close();
  }
});

test("unavailable production switch fails closed before provider execution", async () => {
  const previous = process.env.STUDIOFLOW_DEMO_MODE;
  process.env.STUDIOFLOW_DEMO_MODE = "false";
  try {
    assert.equal(await platformAiEnabled(), false);
    let manual = false;
    const repo = {
      get: async () => ({ status: "ai" }),
      update: async (_id: string, patch: { status?: string }) => {
        manual = patch.status === "human";
      },
      addMessage: async () => "event",
      lease: async () => {
        throw Error("Disabled AI must not lease a provider turn");
      },
    } as unknown as ConversationRepo;
    await processConversation(
      repo,
      "paused",
      {
        origin: "https://studioflow.example",
        slug: "paused",
        send: async () => {
          throw Error("Disabled AI must not send a message");
        },
      },
      async () => {
        throw Error("Disabled AI must not call the provider");
      },
    );
    assert.equal(manual, true);
    assert.equal(
      platformAiSchema.safeParse({ enabled: "true" }).success,
      false,
    );
    assert.equal(
      platformAiSchema.safeParse({ enabled: true, businessId: "spoofed" })
        .success,
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.STUDIOFLOW_DEMO_MODE;
    else process.env.STUDIOFLOW_DEMO_MODE = previous;
  }
});
