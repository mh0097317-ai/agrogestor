"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { validCnpj } from "@/lib/company-registry";
import type { CompanyRegistry } from "@/lib/company-registry";
import { Button } from "@/components/ui";
export function CompanyLookup({
  value,
  disabled,
  auto = false,
  onResult,
}: {
  value: string;
  disabled: boolean;
  auto?: boolean;
  onResult: (company: CompanyRegistry) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<CompanyRegistry | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apply = useRef(onResult);
  useEffect(() => {
    apply.current = onResult;
  }, [onResult]);
  useEffect(() => () => request.current?.abort(), []);
  const lookup = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/company-lookup?cnpj=${encodeURIComponent(value)}`,
        { signal: abort.signal, cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Não foi possível consultar.");
      if (abort.signal.aborted) return;
      setResult(data);
      apply.current(data);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Não foi possível consultar.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }, [value]);
  useEffect(() => {
    if (!auto || disabled || !validCnpj(value)) return;
    timer.current = setTimeout(() => {
      void lookup();
    }, 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [auto, disabled, value, lookup]);
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy || !validCnpj(value)}
        onClick={lookup}
      >
        {busy ? "Consultando…" : "Buscar dados do CNPJ"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <p role="status">
          {result.legalName}
          {result.tradeName ? ` · ${result.tradeName}` : ""}. Campos vazios
          preenchidos; revise antes de salvar. Fonte: {result.source}.
        </p>
      )}
      <small>
        A consulta usa dados cadastrais públicos. Fotos e perfis no Google não
        fazem parte do cadastro do CNPJ.
      </small>
    </div>
  );
}
