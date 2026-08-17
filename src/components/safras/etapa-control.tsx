"use client";

import { ETAPAS_LABEL } from "@/lib/status";
import { atualizarEtapaAction } from "@/modules/safras/actions";
import type { EtapaSafra, StatusEtapa } from "@prisma/client";

const OPCOES: { value: StatusEtapa; label: string }[] = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluída" },
];

export function EtapaControl({
  safraId,
  etapas,
}: {
  safraId: string;
  etapas: { etapa: EtapaSafra; status: StatusEtapa }[];
}) {
  const action = atualizarEtapaAction.bind(null, safraId);
  return (
    <div className="flex flex-wrap gap-2">
      {etapas.map((e) => (
        <form key={e.etapa} action={action} className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2">
          <input type="hidden" name="etapa" value={e.etapa} />
          <span className="text-[13px] font-medium text-ink">{ETAPAS_LABEL[e.etapa]}</span>
          <select
            name="status"
            defaultValue={e.status}
            onChange={(ev) => ev.currentTarget.form?.requestSubmit()}
            className="rounded-[8px] border border-border bg-surface-2 px-2 py-1 text-[12px] text-text outline-none focus-visible:border-primary-500"
          >
            {OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </form>
      ))}
    </div>
  );
}
