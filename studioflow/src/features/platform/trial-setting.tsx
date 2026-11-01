"use client";
import { useEffect, useState } from "react";
import { Gift } from "@phosphor-icons/react/dist/ssr";

/** Quantos dias grátis cada barbearia nova ganha ao se cadastrar. */
export function TrialSetting() {
  const [saved, setSaved] = useState<number | null>(null);
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    fetch("/api/admin/platform/trial", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (typeof result?.days !== "number") return;
        setSaved(result.days);
        setDays(String(result.days));
      })
      .catch(() => undefined);
  }, []);
  async function save() {
    const value = Number(days);
    if (!Number.isInteger(value) || value < 0 || value > 365) {
      setNote("Use de 0 a 365 dias.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/admin/platform/trial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: value }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setSaved(result.days);
      setNote("Salvo. Vale para os próximos cadastros.");
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const value = Number(days);
  const changed = saved !== null && days !== "" && value !== saved;
  return (
    <div className="pf-trial">
      <Gift size={20} />
      <div>
        <strong>Teste grátis para quem se cadastra</strong>
        <span>
          {saved === null
            ? "Carregando…"
            : saved > 0
              ? `Barbearia nova já entra liberada por ${saved} dias. Depois, é só você renovar aqui.`
              : "Desligado: barbearia nova fica aguardando você liberar."}
        </span>
        {note && <small role="status">{note}</small>}
      </div>
      <label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={days}
          disabled={saved === null || busy}
          onChange={(event) => {
            setDays(event.target.value);
            setNote("");
          }}
          aria-label="Dias de teste grátis"
        />
        dias
      </label>
      <button type="button" disabled={!changed || busy} onClick={() => void save()}>
        {busy ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
