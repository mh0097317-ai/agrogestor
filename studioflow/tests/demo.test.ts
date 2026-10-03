import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createSeed } from "../src/lib/seed";
import {
  createDemoBusiness,
  mutateDemo,
  readDemo,
} from "../src/services/server-demo";
import {
  createBooking,
  mutateStore,
  normalizeStoreTimes,
} from "../src/services/server-store";
import { brazilTime, localDate } from "../src/lib/availability";

test("duas confirmações simultâneas persistem apenas uma reserva", async () => {
  const store = createSeed();
  store.business.slug = `test-${randomUUID().slice(0, 8)}`;
  store.appointments = [];
  store.payments = [];
  store.settings.minNotice = 0;
  const target = new Date(Date.now() + 3 * 86400000);
  while (target.getUTCDay() === 0) target.setUTCDate(target.getUTCDate() + 1);
  const input = {
    serviceIds: [store.services[2].id],
    professionalId: store.professionals[0].id,
    start: brazilTime(localDate(target), "15:00").toISOString(),
    name: "Carlos Henrique",
    phone: "11987654321",
    reminder: false,
  };
  try {
    await createDemoBusiness(store);
    const results = await Promise.allSettled([
      mutateDemo((data) => createBooking(data, input), store.business.slug),
      mutateDemo((data) => createBooking(data, input), store.business.slug),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal((await readDemo(store.business.slug)).appointments.length, 1);
  } finally {
    await unlink(
      join(process.cwd(), ".data", `business-${store.business.slug}.json`),
    );
  }
});
test("mutação rejeita business ID adulterado e preserva identificação server-side", () => {
  const store = createSeed();
  assert.throws(
    () =>
      mutateStore(store, {
        entity: "services",
        action: "update",
        data: {
          id: store.services[0].id,
          businessId: randomUUID(),
          name: "Não permitido",
        },
      }),
    /outra empresa/,
  );
  assert.throws(() =>
    mutateStore(store, {
      entity: "appointments",
      action: "create",
      data: { customerId: randomUUID() },
    }),
  );
});
test("pagamento exige atendimento concluído e respeita saldo; status preserva snapshot", () => {
  const store = createSeed(),
    appointment = store.appointments.find(
      (item) => item.status === "confirmed",
    )!;
  assert.throws(
    () =>
      mutateStore(store, {
        entity: "payments",
        action: "create",
        data: {
          appointmentId: appointment.id,
          amount: appointment.price,
          method: "pix",
        },
      }),
    /Conclua/,
  );
  const end = appointment.end,
    price = appointment.price;
  for (const service of store.services.filter((service) =>
    appointment.serviceIds.includes(service.id),
  )) {
    service.price += 50;
    service.duration += 30;
    service.active = false;
  }
  mutateStore(store, {
    entity: "appointments",
    action: "update",
    data: { id: appointment.id, status: "completed" },
  });
  assert.equal(appointment.end, end);
  assert.equal(appointment.price, price);
  mutateStore(store, {
    entity: "payments",
    action: "create",
    data: { appointmentId: appointment.id, amount: price - 1, method: "pix" },
  });
  assert.throws(
    () =>
      mutateStore(store, {
        entity: "payments",
        action: "create",
        data: { appointmentId: appointment.id, amount: 2, method: "pix" },
      }),
    /saldo/,
  );
});
test("adapter converte horários PostgreSQL e intervalos nulos", () => {
  const store = createSeed();
  store.professionals[0].start = "09:00:00";
  store.professionals[0].end = "20:00:00";
  store.professionals[0].breakStart = null as unknown as string;
  store.professionals[0].breakEnd = null as unknown as string;
  store.settings.openStart = "09:00:00";
  store.settings.openEnd = "20:00:00";
  const normalized = normalizeStoreTimes(store);
  assert.equal(normalized.professionals[0].start, "09:00");
  assert.equal(normalized.professionals[0].end, "20:00");
  assert.equal(normalized.professionals[0].breakStart, "");
  assert.equal(normalized.professionals[0].breakEnd, "");
  assert.equal(normalized.settings.openStart, "09:00");
  assert.equal(normalized.settings.openEnd, "20:00");
});
