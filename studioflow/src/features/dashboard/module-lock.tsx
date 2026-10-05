"use client";

import type { ReactNode } from "react";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { useWorkspace } from "@/hooks/use-workspace";
import { hasModule, moduleCatalog, type ModuleKey } from "@/lib/modules";
import "./access-gate.css";

const support = (process.env.NEXT_PUBLIC_STUDIOFLOW_WHATSAPP || "").replace(/\D/g, "");

/** O plano do estabelecimento inclui este módulo? (sem dados ainda: sim) */
export function useModule(key: ModuleKey) {
  const { data } = useWorkspace();
  return !data || hasModule(data.access?.modules, key);
}

/** Página de um módulo fora do plano: explica e oferece incluir. */
export function ModuleGate({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { data } = useWorkspace();
  if (!data || hasModule(data.access?.modules, module)) return <>{children}</>;
  const item = moduleCatalog[module];
  const ask = `Olá! Quero incluir ${item.label} no plano do ${data.business.name} no StudioFlow.`;
  return (
    <div className="module-lock">
      <span className="module-lock-icon">
        <LockSimple size={26} weight="duotone" />
      </span>
      <h1>{item.label}</h1>
      <p>{item.detail}</p>
      <p className="module-lock-note">Este módulo não está incluído no seu plano.</p>
      {support && (
        <a
          className="btn btn-primary"
          href={`https://wa.me/${support}?text=${encodeURIComponent(ask)}`}
          target="_blank"
          rel="noreferrer"
        >
          <WhatsAppIcon size={16} /> Quero incluir no meu plano
        </a>
      )}
    </div>
  );
}
