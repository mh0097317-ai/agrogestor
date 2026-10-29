"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui";
import { FormError, FormField } from "./shared";

export function TrainingCoach({
  existing,
  onApply,
  disabled,
}: {
  existing: string;
  onApply: (text: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState("acolhedor");
  const [notes, setNotes] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    setSuggestion("");
    try {
      const response = await fetch("/api/workspace/assistant/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existing, tone, notes }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Não foi possível gerar a sugestão.");
      setSuggestion(body.instructions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="training-coach">
      <div>
        <span className="sheet-eyebrow">O jeito da sua casa</span>
        <h3>Ensine a IA a atender como você.</h3>
        <p>
          Conte como gosta de receber seus clientes. A IA organiza suas
          orientações e você revisa antes de salvar.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(!open)}
        disabled={disabled || busy}
      >
        <Sparkle size={18} />{" "}
        {open ? "Fechar ajuda" : "Me ajude a treinar a IA"}
      </Button>
      {open && (
        <div className="management-form">
          <FormField label="Tom da conversa">
            <select
              value={tone}
              disabled={disabled || busy}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="acolhedor">Acolhedor e natural</option>
              <option value="descontraído">Leve e descontraído</option>
              <option value="profissional">Objetivo e profissional</option>
            </select>
          </FormField>
          <FormField
            label="Como você quer que ela atenda?"
            hint="Use apenas informações reais. Não inclua senhas ou dados pessoais dos seus clientes."
          >
            <textarea
              rows={4}
              maxLength={1000}
              disabled={disabled || busy}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Cumprimente pelo horário, responda com carinho e pergunte qual profissional o cliente prefere. Se ele perguntar sobre produtos, consulte o catálogo."
            />
          </FormField>
          <Button
            type="button"
            disabled={disabled || busy || notes.trim().length < 10}
            onClick={() => void generate()}
          >
            {busy ? "Preparando suas orientações…" : "Criar sugestão com IA"}
          </Button>
          <small>
            Usa a IA do atendimento e respeita a chave geral. Pode consumir
            créditos do provedor.
          </small>
          <FormError error={error} />
          {suggestion && (
            <div className="training-suggestion">
              <FormField label="Revise a sugestão">
                <textarea
                  rows={8}
                  maxLength={1500}
                  value={suggestion}
                  disabled={disabled || busy}
                  onChange={(e) => setSuggestion(e.target.value)}
                />
              </FormField>
              <Button
                type="button"
                disabled={disabled || busy || !suggestion.trim()}
                onClick={() => {
                  onApply(suggestion);
                  setSuggestion("");
                  setOpen(false);
                }}
              >
                Usar nas instruções
              </Button>
              <p>
                Depois toque em “Salvar treinamento” para aplicar ao
                atendimento.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
