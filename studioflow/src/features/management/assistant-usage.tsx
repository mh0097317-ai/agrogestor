"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { businessDay } from "@/lib/utils";
import { usageSummary, type OperationSnapshot } from "@/lib/operation-health";

export function AssistantUsage({ limit }: { limit: number }) {
  const [data, setData] = useState<OperationSnapshot | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace/operation", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const usage = data && usageSummary(data.usage, businessDay(), limit);
  return (
    <div
      className="management-info"
      role={usage?.alert !== "normal" ? "status" : undefined}
    >
      <div>
        <strong>
          {usage
            ? `${usage.turns} de ${limit} turnos usados hoje`
            : error
              ? "Consumo indisponível"
              : "Consultando consumo…"}
        </strong>
        <p>
          {usage?.alert === "blocked"
            ? "Limite atingido. Novos pedidos ficam com a equipe."
            : usage?.alert === "near"
              ? "Atenção: pelo menos 80% do limite já foi usado."
              : "Perguntas exatas de preço e perguntas simples usam respostas diretas para reduzir chamadas ao modelo."}
        </p>
        <p>
          O limite é de turnos, não de reais. Consumo externo do n8n e de
          transcrição é acompanhado nos provedores.
        </p>
        <Link href="/dashboard/operacao">
          Ver consumo e saúde da operação →
        </Link>
      </div>
    </div>
  );
}
