import test from "node:test";
import assert from "node:assert/strict";
import { assistantScheduleOpen } from "../src/lib/assistant-schedule";

test("AI schedule follows configured business days and São Paulo opening hours", () => {
  const schedule = { enabled: true, days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" };
  assert.equal(assistantScheduleOpen(schedule, new Date("2026-10-26T11:00:00Z")), true); // Monday 08:00
  assert.equal(assistantScheduleOpen(schedule, new Date("2026-10-26T21:00:00Z")), false); // 18:00
  assert.equal(assistantScheduleOpen(schedule, new Date("2026-10-25T15:00:00Z")), false); // Sunday
});

test("disabled schedules leave manual business hours unchanged and overnight shifts work", () => {
  assert.equal(
    assistantScheduleOpen(
      { enabled: false, days: [], start: "invalid", end: "invalid" },
      new Date("2026-10-26T02:00:00Z"),
    ),
    true,
  );
  const overnight = { enabled: true, days: [1], start: "22:00", end: "02:00" };
  assert.equal(assistantScheduleOpen(overnight, new Date("2026-10-27T04:00:00Z")), true); // Tue 01:00, Monday's shift
  assert.equal(assistantScheduleOpen(overnight, new Date("2026-10-27T06:00:00Z")), false); // Tue 03:00
});

test("PostgreSQL time values with seconds work like the dashboard's HH:mm values", () => {
  assert.equal(
    assistantScheduleOpen(
      { enabled: true, days: [1], start: "08:00:00", end: "18:00:00" },
      new Date("2026-10-26T11:00:00Z"),
    ),
    true,
  );
});
