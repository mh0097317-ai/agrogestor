import assert from "node:assert/strict";
import test from "node:test";
import {
  platformSummary,
  searchPlatform,
} from "../src/features/platform/platform-summary";
import type { PlatformBusiness } from "../src/services/platform";
import { emptyActivity } from "../src/lib/platform-activity";
const row = (
  name: string,
  state: PlatformBusiness["state"],
  price: number | null,
): PlatformBusiness => ({
  id: name,
  name,
  state,
  price,
  slug: name,
  category: "Barbearia",
  phone: "",
  image: "",
  createdAt: "2026-10-01T12:00:00Z",
  status:
    state === "pending"
      ? "pending"
      : state === "suspended"
        ? "suspended"
        : "active",
  until: null,
  note: "",
  ownerName: "",
  ownerEmail: "",
  lastSignInAt: null,
  appointments30d: 2,
  customers: 5,
  lastAppointmentAt: null,
  modules: null,
  plan: "",
  onlineBookingEnabled: true,
  assistantEnabled: false,
  whatsappStatus: "close",
  activity: emptyActivity(),
});
test("platform metrics separate contracted amounts from expired accounts and count real activity", () => {
  const items = [
    row("Ativa", "active", 100),
    row("Vencendo", "expiring", 50),
    row("Vencida", "expired", 200),
    row("Aguardando", "pending", null),
  ];
  items[1].onlineBookingEnabled = false;
  assert.deepEqual(platformSummary(items), {
    monthly: 150,
    paying: 2,
    appointments: 8,
    customers: 20,
    pending: 1,
    expiring: 1,
    closed: 1,
    online: 1,
  });
  assert.equal(platformSummary([]).monthly, 0);
});
test("admin search ignores accents and attention sorting prioritizes pending and nearest expiry without mutating input", () => {
  const items = [
    row("João", "active", 100),
    row("Nova", "pending", null),
    row("Amanhã", "expiring", 50),
    row("Hoje", "expiring", 50),
  ];
  items[2].until = "2026-10-09T12:00:00Z";
  items[3].until = "2026-10-08T12:00:00Z";
  assert.equal(searchPlatform(items, "joao", "name")[0].name, "João");
  assert.deepEqual(
    searchPlatform(items, "", "attention").map((item) => item.name),
    ["Nova", "Hoje", "Amanhã", "João"],
  );
  assert.equal(items[0].name, "João");
});
