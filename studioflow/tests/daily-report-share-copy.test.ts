import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import { dailyReportDate } from "../src/lib/daily-report";
import { createSeed } from "../src/lib/seed";
import { weeklySummary } from "../src/lib/weekly-report";
import { weeklyPreferencesSchema } from "../src/services/weekly-report-delivery";
import { weeklyReportPdf } from "../src/services/weekly-report-pdf";
import { improveShareCopy, shareCopySchema } from "../src/services/share-copy";
import type { CreateMessage } from "../src/services/assistant/agent";

test("daily send starts after closing, expires and follows Sao Paulo across midnight", () => {
  assert.equal(
    dailyReportDate(new Date("2026-10-16T01:14:00Z"), "22:00"),
    undefined,
  );
  assert.equal(
    dailyReportDate(new Date("2026-10-16T01:15:00Z"), "22:00"),
    "2026-10-15",
  );
  assert.equal(
    dailyReportDate(new Date("2026-10-16T02:15:00Z"), "22:00"),
    undefined,
  );
  assert.equal(
    dailyReportDate(new Date("2026-10-16T03:10:00Z"), "23:50"),
    "2026-10-15",
  );
  assert.equal(
    dailyReportDate(new Date("2026-10-16T03:10:00Z"), "23:30"),
    "2026-10-15",
  );
  assert.equal(
    dailyReportDate(new Date("2026-10-16T03:10:00Z"), "bad"),
    undefined,
  );
});

test("daily opt-in defaults off and requires a recipient even when weekly is off", () => {
  const input = { enabled: false, includeProfessionals: false, ownerPhone: "" };
  assert.equal(weeklyPreferencesSchema.parse(input).dailyEnabled, false);
  assert.throws(() =>
    weeklyPreferencesSchema.parse({ ...input, dailyEnabled: true }),
  );
  assert.equal(
    weeklyPreferencesSchema.parse({
      ...input,
      dailyEnabled: true,
      ownerPhone: "(62) 99999-8888",
    }).dailyEnabled,
    true,
  );
});

test("daily report counts exactly one local day and still isolates professionals", async () => {
  const store = createSeed(),
    p = store.professionals[0];
  const appointment = {
    ...store.appointments[0],
    businessId: store.business.id,
    professionalId: p.id,
    status: "completed" as const,
    start: "2026-10-15T13:00:00Z",
    end: "2026-10-15T13:40:00Z",
  };
  const rows = [
    appointment,
    { ...appointment, id: "yesterday", start: "2026-10-14T13:00:00Z" },
    { ...appointment, id: "other", professionalId: "other-professional" },
  ];
  const report = weeklySummary(
    store,
    "2026-10-15",
    p.id,
    rows,
    [],
    [],
    new Date("2026-10-16T01:15:00Z"),
    { from: "2026-10-15", to: "2026-10-15" },
  );
  assert.equal(report.completed, 1);
  assert.equal(report.days.length, 1);
  assert.equal(report.days[0].date, "2026-10-15");
  assert.equal(report.productReceived, 0);
  const doc = await PDFDocument.load(
    await weeklyReportPdf({ ...report, daily: true }),
  );
  assert.match(doc.getTitle() || "", /diário/);
  assert.ok(doc.getPageCount() >= 1);
});

test("daily migration retains service-role-only access and never activates subscriptions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create table businesses(id uuid primary key); insert into businesses values ('11111111-1111-4111-8111-111111111111');",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261013130041_weekly_pdf_reports.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261015191114_daily_report_preferences.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      "insert into weekly_report_preferences(business_id) values ('11111111-1111-4111-8111-111111111111')",
    );
    assert.equal(
      (
        await db.query<{ daily_enabled: boolean }>(
          "select daily_enabled from weekly_report_preferences",
        )
      ).rows[0].daily_enabled,
      false,
    );
    await assert.rejects(
      db.exec("update weekly_report_preferences set daily_enabled=true"),
      /daily_report_requires_phone/,
    );
    await db.exec(
      "insert into weekly_report_deliveries(business_id,week,target) values ('11111111-1111-4111-8111-111111111111','2026-10-15','owner'), ('11111111-1111-4111-8111-111111111111','2026-10-15','daily:owner')",
    );
    await assert.rejects(
      db.exec(
        "insert into weekly_report_deliveries(business_id,week,target) values ('11111111-1111-4111-8111-111111111111','2026-10-15','daily:owner')",
      ),
      /duplicate key/,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.exec("select daily_enabled from weekly_report_preferences"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("copy improvement is a bounded draft without tools, photos or publication calls", async () => {
  let calls = 0;
  const create: CreateMessage = async (params) => {
    calls++;
    assert.equal(params.tools, undefined);
    assert.equal(params.messages.length, 1);
    return {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Um resultado para compartilhar",
            caption: "Conheça nosso trabalho e fale com a equipe.",
          }),
        },
      ],
    } as Awaited<ReturnType<CreateMessage>>;
  };
  const input = shareCopySchema.parse({
    title: "Resultado",
    caption: "Veja nosso resultado",
    objective: "Convidar para conversar",
  });
  assert.match(
    (
      await improveShareCopy(
        input,
        { name: "Espaço", category: "Salão" },
        create,
      )
    ).caption,
    /equipe/,
  );
  assert.equal(calls, 1);
  assert.equal(
    shareCopySchema.safeParse({ ...input, businessId: "other" }).success,
    false,
  );
  const invalid = (async () => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text: '{"title":"ok","caption":""}' }],
  })) as unknown as CreateMessage;
  await assert.rejects(
    improveShareCopy(input, { name: "Espaço", category: "Salão" }, invalid),
    /válida/,
  );
});
