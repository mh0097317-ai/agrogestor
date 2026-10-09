"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { FormError } from "./shared";
export function ProfessionalAccess({
  id,
  name,
  linked,
  demo,
}: {
  id: string;
  name: string;
  linked: boolean;
  demo: boolean;
}) {
  const [email, setEmail] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCopied(false);
    setUrl("");
    try {
      const response = await fetch("/api/workspace/professional-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId: id, email }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível criar o acesso.");
      setUrl(result.url);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o acesso.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (linked)
    return (
      <p className="payment-copy">
        Acesso individual de {name} vinculado. O profissional pode conectar o
        próprio WhatsApp.
      </p>
    );
  return (
    <form onSubmit={invite} className="professional-access-form">
      <strong>Acesso individual</strong>
      <p className="payment-copy">
        Convide {name} para acessar a própria agenda e conectar seu número,
        dentro desta barbearia.
      </p>
      <label>
        E-mail de {name}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          autoComplete="off"
          disabled={busy || demo}
        />
      </label>
      <Button type="submit" variant="secondary" disabled={busy || demo}>
        {busy ? "Criando convite…" : "Gerar convite de acesso"}
      </Button>
      {demo && (
        <p className="payment-copy">Disponível no ambiente publicado.</p>
      )}
      {url && (
        <>
          <label>
            Convite válido por 7 dias
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setCopied(true))
                .catch(() => setError("Copie o link exibido acima."))
            }
          >
            {copied ? "Copiado" : "Copiar convite"}
          </Button>
          <p className="payment-copy">
            Envie o link diretamente ao profissional. Gerar outro convite
            invalida este.
          </p>
        </>
      )}
      <FormError error={error} />
    </form>
  );
}
