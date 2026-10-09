import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { readAdminInvoices } from "../src/services/platform-monitoring-data";
test("admin invoice query reads every PostgREST page, preserves centavos and rejects backend errors", async () => {
  const offsets: number[] = [],
    filters: string[] = [];
  let fail = false;
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const offset = Number(url.searchParams.get("offset") || 0);
    offsets.push(offset);
    filters.push(url.searchParams.get("or") || "");
    response.setHeader("Content-Type", "application/json");
    if (fail) {
      response.writeHead(500);
      response.end(JSON.stringify({ message: "unavailable" }));
      return;
    }
    const rows = Array.from({ length: offset === 0 ? 500 : 1 }, (_, index) => ({
      id: String(offset + index),
      business_id: "business",
      value: "79.90",
      due_date: "2026-10-07",
      status: "pending",
      invoice_url: "",
      paid_at: null,
      created_at: "2026-10-01T12:00:00Z",
    }));
    response.end(JSON.stringify(rows));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const client = createClient(
    `http://127.0.0.1:${address.port}`,
    "server-test-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const rows = await readAdminInvoices(client, {
      from: "2026-10-01",
      to: "2026-10-07",
    });
    assert.equal(rows.length, 501);
    assert.deepEqual(offsets, [0, 500]);
    assert.equal(rows[500].value, 79.9);
    assert.ok(
      filters.every(
        (f) =>
          f.includes("status.eq.pending") &&
          f.includes("created_at.gte.2026-10-01T00:00:00-03:00") &&
          f.includes("paid_at.lt.2026-10-08T03:00:00.000Z"),
      ),
    );
    assert.ok(!("asaas_charge_id" in rows[0]));
    fail = true;
    await assert.rejects(
      readAdminInvoices(client, { from: "2026-10-01", to: "2026-10-07" }),
      /Não foi possível consultar as mensalidades/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
