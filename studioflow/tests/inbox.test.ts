import test from "node:test";
import assert from "node:assert/strict";
import {
  customerContext,
  channelMessages,
  inboxLabel,
  inboxQueue,
  needsAttention,
} from "../src/lib/inbox";
import type { Appointment, ConversationSummary, Store } from "../src/types";
import type { ConversationMessage } from "../src/types";

test("channel history includes delivered and received messages without internal activity", () => {
  const messages: ConversationMessage[] = [
    {
      id: "received",
      role: "customer",
      body: "Tem horário?",
      createdAt: "2026-10-08T16:00:00Z",
    },
    {
      id: "retry",
      role: "event",
      body: "Nova tentativa",
      createdAt: "2026-10-08T16:01:00Z",
    },
    {
      id: "sent",
      role: "assistant",
      body: "Tenho às 18h.",
      createdAt: "2026-10-08T16:02:00Z",
    },
    {
      id: "staff",
      role: "staff",
      body: "Confirmado!",
      createdAt: "2026-10-08T16:03:00Z",
    },
  ];
  assert.deepEqual(
    channelMessages(messages).map((item) => item.id),
    ["received", "sent", "staff"],
  );
  assert.equal(messages.length, 4);
  assert.deepEqual(channelMessages([messages[1]]), []);
});

const now = Date.parse("2026-10-08T16:00:00Z");
const pending: ConversationSummary = {
  id: "conversation",
  channel: "whatsapp",
  contactName: "Cliente",
  contactPhone: "+5562999999999",
  status: "ai",
  unread: 0,
  lastMessageAt: new Date(now - 180000).toISOString(),
  latestRole: "customer",
};

test("attention uses unanswered customer messages, not unread badges or personal silence", () => {
  assert.equal(needsAttention(pending, now), true);
  assert.equal(
    needsAttention(
      { ...pending, latestRole: "staff", runState: "FAILED", unread: 5 },
      now,
    ),
    false,
  );
  for (const state of ["SILENT", "GENERATING", "RETRY", "SENDING"])
    assert.equal(needsAttention({ ...pending, runState: state }, now), false);
  assert.equal(
    needsAttention({ ...pending, status: "closed", runState: "FAILED" }, now),
    false,
  );
  assert.equal(
    needsAttention(
      { ...pending, lastMessageAt: new Date(now - 30000).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(
    needsAttention(
      {
        ...pending,
        runState: "FAILED",
        lastMessageAt: new Date(now - 30000).toISOString(),
      },
      now,
    ),
    true,
  );
  assert.equal(
    inboxLabel({ ...pending, runState: "SILENT" }, now),
    "Fora do atendimento",
  );
});

test("customer context matches phone and scopes appointments to the business and connected professional", () => {
  const booking = (
    id: string,
    professionalId: string,
    start: number,
    status: Appointment["status"] = "confirmed",
    businessId = "shop",
  ): Appointment => ({
    id,
    businessId,
    customerId: "customer",
    customerName: "Cliente",
    customerPhone: "62999999999",
    professionalId,
    serviceIds: [],
    start: new Date(start).toISOString(),
    end: new Date(start + 1800000).toISOString(),
    price: 30,
    status,
    reminder: true,
    createdAt: new Date(now).toISOString(),
  });
  const store = {
    business: { id: "shop" },
    customers: [
      { id: "customer", businessId: "shop", phone: "(62) 99999-9999" },
    ],
    appointments: [
      booking("other-pro", "other", now + 10000),
      booking("other-tenant", "own", now + 10000, "confirmed", "other"),
      booking("cancelled", "own", now + 20000, "cancelled"),
      booking("own-next", "own", now + 60000),
      booking("own-last", "own", now - 60000, "completed"),
    ],
  } as Store;
  const context = customerContext(
    store,
    { ...pending, whatsappProfessionalId: "own" },
    now,
  );
  assert.equal(context.customer?.id, "customer");
  assert.equal(context.next?.id, "own-next");
  assert.equal(context.previous?.id, "own-last");
  assert.equal(
    customerContext(
      store,
      { ...pending, contactPhone: "", contactName: "Cliente" },
      now,
    ).next,
    undefined,
  );
});

test("inbox queues exclude personal silence from StudioFlow and never double-count attention", () => {
  assert.equal(inboxQueue({ ...pending, runState: "SILENT" }, now), "outside");
  assert.equal(
    inboxQueue({ ...pending, status: "human", runState: "SILENT" }, now),
    "human",
  );
  assert.equal(
    inboxQueue({ ...pending, runState: "FAILED" }, now),
    "attention",
  );
  assert.equal(
    inboxQueue({ ...pending, status: "human", runState: "FAILED" }, now),
    "attention",
  );
  assert.equal(
    inboxQueue({ ...pending, latestRole: "assistant", runState: "SENT" }, now),
    "ai",
  );
});
