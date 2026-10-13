import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  attendanceQuestion,
  attendanceToken,
  ownerDigest,
  readAttendanceToken,
} from "../src/services/attendance";

test("link do atendimento: assinado, de um horário só e com validade", () => {
  process.env.ATTENDANCE_LINK_SECRET = "test-secret";
  const now = Date.parse("2026-10-15T15:00:00Z");
  const token = attendanceToken("coliseu", "appt-1", now);
  assert.deepEqual(readAttendanceToken(token, now + 3600_000), {
    slug: "coliseu",
    id: "appt-1",
  });
  assert.equal(readAttendanceToken(token, now + 49 * 3600_000), null, "expira em 48 h");
  const [payload, signature] = token.split(".");
  const forged = Buffer.from("coliseu|appt-2|9999999999").toString("base64url");
  assert.equal(readAttendanceToken(`${forged}.${signature}`, now), null);
  assert.equal(readAttendanceToken(`${payload}.x${signature.slice(1)}`, now), null);
  assert.equal(readAttendanceToken("lixo", now), null);
});

test("mensagens: pergunta ao profissional e lista do dono, sem telefone do cliente", () => {
  process.env.ATTENDANCE_LINK_SECRET = "test-secret";
  const store = createSeed();
  const appointment = {
    ...store.appointments[0],
    start: "2026-10-15T17:30:00Z",
    customerName: "Pedro Lima",
  };
  const question = attendanceQuestion(store, appointment, "https://x/atendimento/t");
  assert.match(question, /14:30/);
  assert.match(question, /Pedro Lima/);
  assert.match(question, /https:\/\/x\/atendimento\/t/);
  assert.doesNotMatch(question, new RegExp(appointment.customerPhone));
  const digest = ownerDigest(store, [appointment], "https://app");
  assert.match(digest, /1 atendimento ficou sem baixa/);
  assert.match(digest, /agenda\?date=2026-10-15/);
});
