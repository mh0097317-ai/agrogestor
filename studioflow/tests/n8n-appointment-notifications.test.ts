import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  appointmentEligible,
  summaryDue,
  appointmentNotificationSchema,
  saoPauloDate,
} from "../src/services/assistant/n8n-appointment-policy";
const now = Date.parse("2026-10-09T15:00:00Z");
const base = {
  ...createSeed().appointments[0],
  status: "confirmed" as const,
  reminder: true,
  createdAt: new Date(now - 3600000).toISOString(),
};
const at = (hours: number) => ({
  ...base,
  start: new Date(now + hours * 3600000).toISOString(),
  end: new Date(now + (hours + 1) * 3600000).toISOString(),
});
test("reminder windows exclude cancelled, opted-out, new and stale appointments", () => {
  assert.equal(appointmentEligible("reminder_24h", at(24), now), true);
  assert.equal(appointmentEligible("reminder_24h", at(23.5), now), false);
  assert.equal(
    appointmentEligible("reminder_24h", { ...at(24), reminder: false }, now),
    false,
  );
  assert.equal(appointmentEligible("reminder_2h", at(2), now), true);
  assert.equal(appointmentEligible("reminder_2h", at(0.1), now), false);
  assert.equal(
    appointmentEligible(
      "reminder_2h",
      { ...at(2), createdAt: new Date(now).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(
    appointmentEligible("reminder_2h", { ...at(2), status: "cancelled" }, now),
    false,
  );
});
test("no-show is explicit and aftercare follows a completed appointment", () => {
  const past = at(-2);
  assert.equal(appointmentEligible("no_show_followup", past, now), false);
  assert.equal(
    appointmentEligible(
      "no_show_followup",
      { ...past, status: "no_show" },
      now,
    ),
    true,
  );
  assert.equal(
    appointmentEligible(
      "post_appointment",
      { ...past, status: "completed" },
      now,
    ),
    true,
  );
  assert.equal(
    appointmentEligible(
      "post_appointment",
      { ...past, status: "in_progress" },
      now,
    ),
    false,
  );
  assert.equal(
    appointmentEligible(
      "post_appointment",
      { ...at(-26), status: "completed" },
      now,
    ),
    false,
  );
  assert.equal(
    appointmentEligible(
      "no_show_followup",
      { ...at(2), status: "no_show" },
      now,
    ),
    false,
  );
});
test("daily summaries use São Paulo day and cannot request another day", () => {
  const evening = Date.parse("2026-10-09T21:00:00Z");
  assert.equal(summaryDue("2026-10-09", now), false);
  assert.equal(summaryDue("2026-10-09", evening), true);
  assert.equal(summaryDue("2026-10-08", evening), false);
  assert.equal(saoPauloDate(Date.parse("2026-10-10T02:00:00Z")), "2026-10-09");
  assert.equal(
    appointmentNotificationSchema.safeParse({
      action: "daily_summary",
      date: "2026-10-09",
      phone: "arbitrary",
    }).success,
    false,
  );
  assert.equal(
    appointmentNotificationSchema.safeParse({
      action: "reminder_2h",
      appointmentId: base.id,
      test: true,
    }).success,
    true,
  );
});
