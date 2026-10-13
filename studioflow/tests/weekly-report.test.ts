import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { createSeed } from "../src/lib/seed";
import {
  weeklyPeriod,
  weeklyScope,
  weeklySummary,
} from "../src/lib/weekly-report";
import { platformWeeklySummary } from "../src/lib/platform-weekly-report";
import { weeklyReportPdf } from "../src/services/weekly-report-pdf";
import {
  deliverWeeklyPdf,
  weeklySendWindow,
  weeklyPreferencesSchema,
} from "../src/services/weekly-report-delivery";
const now = new Date("2026-10-13T12:00:00Z");
test("weekly period is Monday-Sunday in Sao Paulo, even across month and UTC boundaries", () => {
  assert.deepEqual(weeklyPeriod(undefined, now), {
    from: "2026-10-05",
    to: "2026-10-11",
  });
  assert.deepEqual(weeklyPeriod(undefined, new Date("2026-10-12T01:00:00Z")), {
    from: "2026-09-28",
    to: "2026-10-04",
  });
  assert.deepEqual(weeklyPeriod("2026-10-13"), {
    from: "2026-10-12",
    to: "2026-10-18",
  });
  assert.throws(() => weeklyPeriod("2026-02-30"));
  assert.equal(weeklySendWindow(new Date("2026-10-19T12:00:00Z")), true);
  assert.equal(weeklySendWindow(new Date("2026-10-19T11:59:00Z")), false);
  assert.equal(weeklySendWindow(new Date("2026-10-20T12:00:00Z")), false);
});
test("professional report cannot access another professional or overall shop financials", () => {
  const store = createSeed();
  const p = store.professionals[0];
  store.viewer = { role: "professional", name: p.name, professionalId: p.id };
  assert.equal(weeklyScope(store), p.id);
  assert.throws(() => weeklyScope(store, "another"));
  store.viewer = { role: "receptionist", name: "Equipe" };
  assert.throws(() => weeklyScope(store));
  store.viewer = { role: "owner", name: "Dono" };
  assert.equal(weeklyScope(store), undefined);
  const a = {
    ...store.appointments[0],
    businessId: store.business.id,
    professionalId: p.id,
    start: "2026-10-06T12:00:00Z",
    status: "completed" as const,
  };
  const report = weeklySummary(
    store,
    "2026-10-05",
    p.id,
    [a, { ...a, id: "foreign", businessId: "other" }],
    [
      {
        businessId: store.business.id,
        professionalId: p.id,
        amount: 30.1,
        createdAt: "2026-10-11T23:00:00Z",
      },
      {
        businessId: store.business.id,
        professionalId: "other",
        amount: 1000,
        createdAt: "2026-10-06T12:00:00Z",
      },
    ],
    [
      {
        businessId: store.business.id,
        total: 999,
        status: "paid",
        createdAt: "2026-10-06T12:00:00Z",
      },
    ],
    now,
  );
  assert.equal(report.completed, 1);
  assert.equal(report.received, 3010);
  assert.equal(report.productReceived, 0);
  assert.equal(report.professionals.length, 1);
  assert.equal(report.attendance, 100);
});
test("platform revenue uses paid invoices and never counts shop revenue or promised fees", () => {
  const shops = [
    {
      id: "shop",
      name: "Loja",
      status: "active" as const,
      until: null,
      createdAt: "2026-10-06T12:00:00Z",
    },
  ];
  const i = {
    id: "paid",
    businessId: "shop",
    value: 79.9,
    dueDate: "2026-10-05",
    paidAt: "2026-10-06T12:00:00Z",
    createdAt: "2026-10-05T12:00:00Z",
    status: "paid" as const,
    invoiceUrl: "",
  };
  const result = platformWeeklySummary(
    shops,
    [i, { ...i, id: "open", status: "pending", value: 1000, paidAt: null }],
    "2026-10-05",
    now,
  );
  assert.equal(result.totalReceived, 7990);
  assert.equal(result.completed, 1);
  assert.equal(result.customers, 1);
  assert.equal(result.overdueCents, 100000);
});
test("automatic PDF claim is atomic and uncertain sends are never replayed", async () => {
  let claimed = false,
    sends = 0;
  const receipts: string[] = [];
  const input = {
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    build: async () => new Uint8Array([1]),
    send: async () => {
      sends++;
      return "";
    },
    receipt: async (status: string) => {
      receipts.push(status);
    },
  };
  assert.equal(await deliverWeeklyPdf(input), "failed");
  assert.equal(await deliverWeeklyPdf(input), "skipped");
  assert.equal(sends, 1);
  assert.deepEqual(receipts, ["failed"]);
  assert.throws(() =>
    weeklyPreferencesSchema.parse({
      enabled: true,
      includeProfessionals: true,
      ownerPhone: "",
    }),
  );
});
test("PDF pagination and names with accents or emoji produce a readable multi-page document", async () => {
  const store = createSeed();
  store.mode = "demo";
  store.business.name = "Barbearia São José ✂️";
  const report = weeklySummary(store, "2026-10-05", undefined, [], [], [], now);
  report.professionals = Array.from({ length: 30 }, (_, i) => ({
    name: `Profissional ${i + 1}`,
    completed: 0,
    received: 0,
    commission: 0,
  }));
  const bytes = await weeklyReportPdf(report);
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3);
  assert.match(doc.getTitle()!, /Relatório semanal/);
  for (const page of doc.getPages()) assert.ok(page.getHeight() > 800);
});
