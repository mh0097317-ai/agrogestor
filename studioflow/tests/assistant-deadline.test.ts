import test from "node:test";
import assert from "node:assert/strict";
import {
  TurnDeadlineError,
  boundedCreate,
} from "../src/services/assistant/conversations";
import { failureCode, retryable } from "../src/services/assistant/pipeline";
import { staleOutcome, type StaleRun } from "../src/services/assistant/recovery";
import type { CreateMessage } from "../src/services/assistant/agent";

const answer = { content: [], usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Awaited<ReturnType<CreateMessage>>;

test("prazo do atendimento: chamada lenta vira erro de tempo que tenta de novo", async () => {
  const slow: CreateMessage = () => new Promise((resolve) => setTimeout(() => resolve(answer), 5_000));
  const started = Date.now();
  // 300 ms de prazo e uma chamada de 5 s: o prazo corta a espera.
  const bounded = boundedCreate(slow, Date.now() + 300, Date.now, 100);
  const result = bounded({} as never);
  await assert.rejects(result, (error: unknown) => {
    assert.ok(error instanceof TurnDeadlineError);
    assert.equal(failureCode(error), "provider-timeout");
    assert.equal(retryable(error), true);
    return true;
  });
  assert.ok(Date.now() - started < 4_000, "não espera a chamada lenta terminar");
  // Sem tempo para uma chamada inteira: nem começa.
  const clock = 10_000;
  let called = false;
  const never = boundedCreate(async () => { called = true; return answer; }, 20_000, () => clock);
  await assert.rejects(never({} as never), TurnDeadlineError);
  assert.equal(called, false);
});

test("prazo do atendimento: chamada rápida passa normalmente", async () => {
  const fast: CreateMessage = async () => answer;
  const bounded = boundedCreate(fast, Date.now() + 60_000);
  assert.equal(await bounded({} as never), answer);
});

const run = (patch: Partial<StaleRun> = {}): StaleRun => ({
  conversation_id: "c1",
  business_id: "b1",
  tenant_id: "t1",
  state: "GENERATING",
  attempts: 1,
  run_updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  conversation_status: "human",
  channel: "whatsapp",
  contact_phone: "62999998494",
  answered: false,
  ...patch,
});

test("atendimento travado: fecha, passa para a equipe e avisa só o que ainda dá para salvar", () => {
  const stuck = staleOutcome(run());
  assert.equal(stuck.state, "FAILED");
  assert.equal(stuck.state === "FAILED" && stuck.errorCode, "stale");
  assert.equal(stuck.alert, true);
  assert.match(stuck.note!, /não terminou de responder/);

  // Alguém já respondeu: só fecha, sem alarme.
  assert.deepEqual(staleOutcome(run({ answered: true })), { state: "SILENT", alert: false, note: null });

  // Parou no envio: não sabemos se saiu.
  const sending = staleOutcome(run({ state: "SENDING" }));
  assert.equal(sending.state === "FAILED" && sending.errorCode, "delivery-unconfirmed");
  assert.match(sending.note!, /Confira o WhatsApp/);

  // Caso antigo (mais de um dia): fecha e registra, sem acordar o dono.
  const old = staleOutcome(run({ run_updated_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }));
  assert.equal(old.state, "FAILED");
  assert.equal(old.alert, false);

  // Chat do site não manda aviso por WhatsApp.
  assert.equal(staleOutcome(run({ channel: "web" })).alert, false);
});
