import Link from "next/link";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { assistantImpact } from "@/lib/assistant-impact";
import { businessDay, money } from "@/lib/utils";
import type { Store } from "@/types";

export function StudioFlowResults({ data, now }: { data: Store; now: number }) {
  const to = businessDay(new Date(now));
  const from = businessDay(new Date(now - 6 * 86400000));
  const impact = assistantImpact(data, from, to);
  return (
    <section className="sf-results" aria-labelledby="sf-results-title">
      <header>
        <span className="sf-eyebrow">
          <Sparkle size={16} /> Seu assistente, em números
        </span>
        <span>Últimos 7 dias</span>
      </header>
      <h2 id="sf-results-title">
        Conversas que viram
        <br />
        <em>resultado.</em>
      </h2>
      <dl>
        <div>
          <dt>Agendamentos gerados</dt>
          <dd>{impact.created}</dd>
        </div>
        <div>
          <dt>Atendimentos concluídos</dt>
          <dd>{impact.completed}</dd>
        </div>
        <div>
          <dt>Recebido desses atendimentos</dt>
          <dd>{money(impact.received)}</dd>
        </div>
      </dl>
      <footer>
        <p>
          Reservas criadas, atendimentos realizados e pagamentos recebidos no
          período. Somente agendamentos atribuídos ao atendimento automático.
        </p>
        <Link href="/dashboard/relatorios">
          Ver relatórios <ArrowUpRight size={16} />
        </Link>
      </footer>
    </section>
  );
}
