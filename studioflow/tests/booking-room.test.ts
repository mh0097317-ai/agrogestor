import test from "node:test";
import assert from "node:assert/strict";
import { DomainError, MAX_OPEN_BOOKINGS, assertBookingRoom } from "../src/lib/availability";

const now = new Date("2026-11-12T12:00:00.000Z");
const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
const booking = (phone: string, days: number, status = "confirmed") => ({ customerPhone: phone, status, start: at(days) });

test("link público: um telefone não segura a agenda inteira", () => {
  const mine = Array.from({ length: MAX_OPEN_BOOKINGS }, (_, i) => booking("62999990000", i + 1));
  assert.throws(
    () => assertBookingRoom(mine, "62999990000", now),
    (error: unknown) => error instanceof DomainError && error.status === 409 && /já tem 4 horários/.test(error.message),
  );
  // Abaixo do teto, de outro telefone, passados ou cancelados não contam.
  assert.doesNotThrow(() => assertBookingRoom(mine.slice(1), "62999990000", now));
  assert.doesNotThrow(() => assertBookingRoom(mine, "62988887777", now));
  assert.doesNotThrow(() =>
    assertBookingRoom(
      [...mine.slice(1), booking("62999990000", -1), booking("62999990000", 2, "cancelled"), booking("62999990000", 3, "completed")],
      "62999990000",
      now,
    ),
  );
});
