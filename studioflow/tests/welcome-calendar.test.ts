import test from "node:test";
import assert from "node:assert/strict";
import { welcomeReply } from "../src/services/assistant/welcome-reply";
import { calendarContent } from "../src/features/booking/calendar-export";
import { createSeed } from "../src/lib/seed";
import type { ConversationMessage } from "../src/types";

test("first catalog response greets by São Paulo time without a provider call", () => {
  const reply = "O corte fica R$ 30,00.";
  for (const [instant, hello] of [
    ["2026-10-15T11:00:00Z", "Bom dia"],
    ["2026-10-15T18:00:00Z", "Boa tarde"],
    ["2026-10-15T23:00:00Z", "Boa noite"],
  ])
    assert.equal(
      welcomeReply(reply, [], "Quanto custa o corte?", new Date(instant)),
      `${hello}! Tudo bem?\n\n${reply}`,
    );
  const now = new Date("2026-10-15T23:00:00Z");
  const recent = [
    { role: "assistant", body: reply, createdAt: "2026-10-15T22:59:00Z" },
  ] as ConversationMessage[];
  assert.equal(welcomeReply(reply, recent, "Quero às 9h", now), reply);
  assert.match(
    welcomeReply(reply, recent, "Boa noite, quanto custa?", now),
    /^Boa noite!/,
  );
  assert.equal(
    welcomeReply("Boa noite! Posso ajudar.", [], "", now),
    "Boa noite! Posso ajudar.",
  );
  assert.equal(welcomeReply("", [], "", now), "");
});

test("calendar export preserves the appointment and includes three display alarms", () => {
  const store = createSeed();
  const appointment = store.appointments[0];
  const content = calendarContent(
    appointment,
    store.business,
    store.services,
    "https://app.studioflowapp.tech/booking/test",
    new Date("2026-10-15T12:00:00Z"),
  );
  assert.equal((content.match(/BEGIN:VALARM/g) || []).length, 3);
  assert.deepEqual(
    [...content.matchAll(/TRIGGER:([^\r\n]+)/g)].map((m) => m[1]),
    ["-PT12H", "-PT2H", "-PT1H"],
  );
  assert.equal((content.match(/ACTION:DISPLAY/g) || []).length, 3);
  assert.ok(content.includes(`UID:${appointment.id}@studioflow`));
  assert.ok(
    content.includes(
      `DTSTART:${new Date(appointment.start).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    ),
  );
  assert.doesNotMatch(content, /TRIGGER:-PT10M/);
  assert.match(content, /END:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR/);
});
