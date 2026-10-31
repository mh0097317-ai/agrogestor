import test from "node:test";
import assert from "node:assert/strict";
import { readDemo } from "../src/services/server-demo";
import { claudeCreate } from "../src/services/assistant/agent";
import { receptionistModel } from "../src/services/assistant/receptionist";
import { runReceptionistEval } from "../src/services/assistant/receptionist-eval";

/*
 * As mesmas conversas do botão "Testar a recepcionista" do /admin, rodadas
 * aqui com a loja de demonstração: npm run eval:recepcionista
 * Precisa de ANTHROPIC_API_KEY no ambiente (gasta crédito).
 */
const create = claudeCreate(receptionistModel);

test(
  "conversas de teste da recepcionista",
  { skip: !create && "sem ANTHROPIC_API_KEY no ambiente" },
  async () => {
    const store = await readDemo("barber-011");
    store.business.address ||= "Rua das Palmeiras, 120 - Centro";
    const results = await runReceptionistEval(store, create!);
    for (const r of results) {
      console.log(
        `${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : ` — ${r.problems.join(" · ")}`}`,
      );
      for (const t of r.turns)
        console.log(
          `    cliente: ${t.customer}\n    bia (${t.seconds}s): ${t.reply || "(sem resposta)"}${t.list ? `\n      [${t.list}]` : ""}`,
        );
    }
    const failed = results.filter((r) => !r.ok).map((r) => r.name);
    assert.deepEqual(failed, [], `falharam: ${failed.join(", ")}`);
  },
);
