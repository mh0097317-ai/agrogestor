import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createSeed } from "../src/lib/seed";
import { availableSlots, brazilTime, localDate } from "../src/lib/availability";
import {
  assertOnlineBookingEnabled,
  businessWhatsAppLink,
  onlineBookingEnabled,
} from "../src/lib/online-booking";
import { bookWithPayments } from "../src/services/server-payments";
import { createBooking, mutateStore } from "../src/services/server-store";
import {
  createDemoBusiness,
  mutateDemo,
  readDemo,
} from "../src/services/server-demo";
import { getOnlineBookingStore } from "../src/services/server-online-booking";
import { waitlistMessage } from "../src/features/dashboard/growth";

test("legacy/default opt-in and WhatsApp uses only a configured valid contact", () => {
  assert.equal(onlineBookingEnabled({}), true);
  assert.equal(onlineBookingEnabled({ onlineBookingEnabled: true }), true);
  assert.throws(
    () => assertOnlineBookingEnabled({ onlineBookingEnabled: false }),
    /Agendamento online indisponível/,
  );
  assert.equal(businessWhatsAppLink(""), null);
  assert.equal(businessWhatsAppLink("123"), null);
  assert.equal(
    businessWhatsAppLink("(11) 99999-8888"),
    "https://wa.me/5511999998888",
  );
  assert.equal(
    businessWhatsAppLink("+55 11 99999-8888"),
    "https://wa.me/5511999998888",
  );
});

test("disabled public link creates no records; staff and receptionist stay independent; reactivation preserves data", async () => {
  const store = createSeed();
  const slug =
    (store.business.slug = `test-online-${randomUUID().slice(0, 8)}`);
  store.appointments = [];
  store.payments = [];
  store.customers = [];
  store.settings.minNotice = 0;
  store.settings.onlineBookingEnabled = false;
  const service = store.services.find((s) => s.active)!;
  let slot;
  for (let offset = 2; offset < 12 && !slot; offset++) {
    const date = localDate(new Date(Date.now() + offset * 86400000));
    slot = availableSlots(store, [service.id], "any", date)[0];
  }
  assert.ok(slot);
  const input = {
    serviceIds: [service.id],
    professionalId: slot.professionalId,
    start: slot.start,
    name: "Cliente isolado",
    phone: "11999998888",
    reminder: false,
  };
  // A working day of that professional, two weeks ahead (independent of today's weekday).
  const worker = store.professionals.find((p) => p.id === slot.professionalId)!;
  let staffDate = "";
  for (let offset = 15; offset < 22 && !staffDate; offset++) {
    const day = new Date(Date.now() + offset * 86400000);
    if (worker.days.includes(new Date(`${localDate(day)}T12:00:00Z`).getUTCDay()))
      staffDate = localDate(day);
  }
  try {
    await createDemoBusiness(store);
    await assert.rejects(
      getOnlineBookingStore(slug),
      /Agendamento online indisponível/,
    );
    await assert.rejects(
      bookWithPayments(slug, input),
      /Agendamento online indisponível/,
    );
    let current = await readDemo(slug);
    assert.equal(current.appointments.length, 0);
    assert.equal(current.customers.length, 0);
    const assisted = await bookWithPayments(slug, input, "receptionist", {
      channel: "whatsapp",
      conversationId: "local-conversation",
    });
    assert.ok(assisted.token);
    assert.equal(assisted.bookingChannel, "assistant_whatsapp");
    // The internal agenda uses the neutral engine with staff rules.
    await mutateDemo(
      (draft) =>
        createBooking(
          draft,
          {
            ...input,
            start: brazilTime(staffDate, "15:00").toISOString(),
          },
          true,
        ),
      slug,
    );
    // Saving unrelated rules must not silently turn public booking back on.
    await mutateDemo(
      (draft) =>
        mutateStore(draft, {
          entity: "settings",
          action: "update",
          data: { buffer: 5 },
        }),
      slug,
    );
    current = await readDemo(slug);
    assert.equal(current.settings.onlineBookingEnabled, false);
    assert.equal(current.appointments.length, 2);
    await mutateDemo((draft) => {
      draft.settings.onlineBookingEnabled = true;
    }, slug);
    const reopened = await getOnlineBookingStore(slug);
    assert.equal(reopened.business.slug, slug);
    assert.equal(reopened.appointments[0].token, assisted.token);
    assert.equal(reopened.settings.buffer, 5);
    // Another tenant is unaffected.
    assert.equal(
      onlineBookingEnabled((await readDemo("barber-011")).settings),
      true,
    );
  } finally {
    await unlink(join(process.cwd(), ".data", `business-${slug}.json`));
  }
});

test("waitlist outreach preserves the queue without sharing a disabled booking link", () => {
  const store = createSeed();
  const entry = {
    id: randomUUID(),
    businessId: store.business.id,
    serviceId: store.services[0].id,
    professionalId: null,
    customerName: "Maria Silva",
    customerPhone: "11999998888",
    desiredDate: "2026-10-12",
    period: "any" as const,
    status: "waiting" as const,
    createdAt: new Date().toISOString(),
  };
  store.settings.onlineBookingEnabled = false;
  assert.doesNotMatch(
    waitlistMessage(store, entry, "https://example.test/book"),
    /https:/,
  );
  store.settings.onlineBookingEnabled = true;
  assert.match(
    waitlistMessage(store, entry, "https://example.test/book"),
    /https:/,
  );
});
