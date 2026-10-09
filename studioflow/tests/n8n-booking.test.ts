import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { limitPublicMutation } from "../src/services/server-http";
import {
  bookingCreatedEvent,
  bookingWebhookConfiguration,
  sendBookingCreated,
} from "../src/services/assistant/n8n-booking";
import {
  inactiveCustomerEpisode,
  notificationSchema,
} from "../src/services/assistant/n8n-notifications";

const config = {
  businessId: "08a87f89-544b-42ac-af0a-3b4a9a07a90d",
  professionalId: null,
  basicUser: "test",
  basicPassword: "test",
  token: "x".repeat(32),
};
test("authenticated retention batches have a separate rate limit from public requests", () => {
  const request = new Request("https://example.test", {
    headers: { "x-forwarded-for": "192.0.2.187" },
  });
  for (let i = 0; i < 20; i++) limitPublicMutation(request);
  assert.throws(() => limitPublicMutation(request));
  for (let i = 0; i < 240; i++)
    limitPublicMutation(request, { scope: "retention-test", max: 240 });
  assert.throws(() =>
    limitPublicMutation(request, { scope: "retention-test", max: 240 }),
  );
});
test("booking automation is opt-in, scoped and rejects overlapping scopes", () => {
  assert.equal(
    bookingWebhookConfiguration(config.businessId, "someone", "[]"),
    null,
  );
  assert.deepEqual(
    bookingWebhookConfiguration(
      config.businessId,
      "someone",
      JSON.stringify([config]),
    ),
    config,
  );
  assert.equal(
    bookingWebhookConfiguration(
      "another-business",
      "someone",
      JSON.stringify([config]),
    ),
    null,
  );
  assert.throws(() =>
    bookingWebhookConfiguration(
      config.businessId,
      "someone",
      JSON.stringify([config, config]),
    ),
  );
});
test("persisted confirmed bookings produce stable events without contact or access secrets", () => {
  const store = createSeed();
  const appointment = {
    ...store.appointments[0],
    businessId: store.business.id,
    status: "confirmed" as const,
  };
  const event = bookingCreatedEvent(store, appointment)!;
  assert.ok(event);
  assert.equal(event.eventId, bookingCreatedEvent(store, appointment)!.eventId);
  assert.equal("customerPhone" in event, false);
  assert.equal("token" in event, false);
  assert.equal(
    bookingCreatedEvent(store, { ...appointment, status: "pending" }),
    null,
  );
  assert.equal(
    bookingCreatedEvent(store, { ...appointment, businessId: "other" }),
    null,
  );
});
test("transport requires correlated acknowledgement and never follows redirects", async () => {
  const store = createSeed();
  const appointment = {
    ...store.appointments[0],
    businessId: store.business.id,
    status: "confirmed" as const,
  };
  const event = bookingCreatedEvent(store, appointment)!;
  const scoped = { ...config, businessId: event.businessId };
  let calls = 0;
  const transport: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(init?.redirect, "error");
    return Response.json({
      received: true,
      bookingId: event.bookingId,
      eventId: event.eventId,
    });
  };
  await sendBookingCreated(event, scoped, transport);
  assert.equal(calls, 1);
  await assert.rejects(
    sendBookingCreated(event, scoped, async () =>
      Response.json({
        received: true,
        bookingId: "wrong",
        eventId: event.eventId,
      }),
    ),
  );
  await assert.rejects(
    sendBookingCreated(
      event,
      { ...scoped, businessId: config.businessId },
      transport,
    ),
  );
  assert.equal(calls, 1);
});
test("retention does not target recent customers, future bookings or another professional", () => {
  const store = createSeed();
  const base = {
    ...store.appointments[0],
    customerId: "customer",
    professionalId: "pro",
    status: "completed" as const,
    start: "2026-08-01T12:00:00Z",
    end: "2026-08-01T12:40:00Z",
  };
  const now = Date.parse("2026-10-09T12:00:00Z");
  assert.equal(
    inactiveCustomerEpisode([base], "customer", "pro", now),
    base.end,
  );
  assert.equal(
    inactiveCustomerEpisode([base], "customer", "another", now),
    null,
  );
  assert.equal(
    inactiveCustomerEpisode(
      [{ ...base, end: "2026-10-01T12:40:00Z" }],
      "customer",
      "pro",
      now,
    ),
    null,
  );
  assert.equal(
    inactiveCustomerEpisode(
      [
        base,
        {
          ...base,
          status: "confirmed",
          start: "2026-10-10T12:00:00Z",
          end: "2026-10-10T12:40:00Z",
        },
      ],
      "customer",
      "pro",
      now,
    ),
    null,
  );
  assert.equal(
    notificationSchema.safeParse({
      action: "inactive_customer",
      customerId: config.businessId,
      phone: "untrusted",
      message: "untrusted",
    }).success,
    false,
  );
});
