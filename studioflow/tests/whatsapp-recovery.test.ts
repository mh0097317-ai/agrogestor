import test from "node:test";
import assert from "node:assert/strict";
import { linkRecovery, type DownLink } from "../src/services/assistant/alerts";

const now = new Date("2026-11-24T15:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const link = (patch: Partial<DownLink> = {}): DownLink => ({
  business_id: "b1",
  instance: "sf-coliseu-6aeb23",
  status: "close",
  updated_at: ago(1),
  down_since: ago(1),
  reconnect_tried_at: null,
  ...patch,
});

test("WhatsApp caído: espera um pouco, tenta religar sozinho e só então avisa", () => {
  // Acabou de cair: pode ser o dono lendo o QR de novo.
  assert.deepEqual(linkRecovery(link(), now), { reconnect: false, alert: false });
  // 6 min fora: tenta religar, ainda sem aviso.
  assert.deepEqual(linkRecovery(link({ down_since: ago(6) }), now), { reconnect: true, alert: false });
  // 15 min fora: tenta e avisa.
  assert.deepEqual(linkRecovery(link({ down_since: ago(15) }), now), { reconnect: true, alert: true });
  // Tentou há 10 min: não insiste a cada 5 min.
  assert.equal(linkRecovery(link({ down_since: ago(60), reconnect_tried_at: ago(10) }), now).reconnect, false);
  assert.equal(linkRecovery(link({ down_since: ago(60), reconnect_tried_at: ago(31) }), now).reconnect, true);
});

test("WhatsApp caído: evento novo da Evolution não reinicia a espera", () => {
  // updated_at muda a cada evento; o que conta é desde quando caiu.
  const step = linkRecovery(link({ updated_at: ago(1), down_since: ago(7 * 24 * 60) }), now);
  assert.equal(step.alert, true);
  // Sem down_since (linha antiga), usa o último registro.
  assert.equal(linkRecovery(link({ down_since: null, updated_at: ago(20) }), now).alert, true);
});
