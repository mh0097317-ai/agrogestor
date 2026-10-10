import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  customerBookingMessage,
  customerBookingEligible,
  deliverCustomerBooking,
} from "../src/services/whatsapp/booking-confirmation";

const fixture = () => {
  const store = createSeed();
  store.settings.notifications = true;
  const appointment = {
    ...store.appointments[0],
    businessId: store.business.id,
    customerName: "Ana Maria",
    customerPhone: "11987654321",
    reminder: false,
    start: new Date(Date.now() + 86400000).toISOString(),
    status: "confirmed" as const,
    bookingChannel: "public_link" as const,
    depositStatus: null,
  };
  return { store, appointment };
};

test("missing provider acknowledgement is recorded as failed, never sent", async () => {
  const { store, appointment } = fixture();
  const receipts: string[] = [];
  assert.equal(
    await deliverCustomerBooking(store, appointment, {
      sender: async () => undefined,
      claim: async () => true,
      receipt: async (status) => {
        receipts.push(status);
      },
    }),
    "failed",
  );
  assert.deepEqual(receipts, ["failed"]);
});
test("immediate confirmation uses the actual booking and does not require reminder opt-in", async () => {
  const { store, appointment } = fixture();
  let claimed = false,
    sends = 0;
  const journal = {
    sender: async (phone: string, body: string) => {
      sends++;
      assert.equal(phone, appointment.customerPhone);
      assert.match(body, /Agendamento confirmado/);
      return "provider-accepted";
    },
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    receipt: async (status: string, id?: string) => {
      assert.equal(status, "sent");
      assert.equal(id, "provider-accepted");
    },
  };
  assert.equal(
    await deliverCustomerBooking(store, appointment, journal),
    "sent",
  );
  assert.equal(
    await deliverCustomerBooking(store, appointment, journal),
    "skipped",
  );
  assert.equal(sends, 1);
});
test("pending approval/Pix are never described as confirmed and cancelled/foreign bookings cannot notify", () => {
  const { store, appointment } = fixture();
  assert.match(
    customerBookingMessage(store, { ...appointment, status: "pending" }),
    /aguardando aprovação/,
  );
  assert.match(
    customerBookingMessage(store, {
      ...appointment,
      depositStatus: "pending",
      depositAmount: 15,
    }),
    /aguardando o sinal/,
  );
  assert.equal(
    customerBookingEligible(store, { ...appointment, status: "cancelled" }),
    false,
  );
  assert.equal(
    customerBookingEligible(store, { ...appointment, businessId: "other" }),
    false,
  );
  assert.equal(
    customerBookingEligible(store, {
      ...appointment,
      bookingChannel: "assistant_whatsapp",
    }),
    false,
  );
  store.settings.notifications = false;
  assert.equal(customerBookingEligible(store, appointment), false);
});
test("disconnected sender does not consume a claim; uncertain failure is recorded without replay", async () => {
  const { store, appointment } = fixture();
  let claims = 0,
    failed = false;
  const journal = {
    sender: null,
    claim: async () => {
      claims++;
      return true;
    },
    receipt: async () => {},
  };
  assert.equal(
    await deliverCustomerBooking(store, appointment, journal),
    "skipped",
  );
  assert.equal(claims, 0);
  assert.equal(
    await deliverCustomerBooking(store, appointment, {
      ...journal,
      sender: async () => {
        throw Error("provider failure");
      },
      receipt: async (status) => {
        failed = status === "failed";
      },
    }),
    "failed",
  );
  assert.equal(failed, true);
});
