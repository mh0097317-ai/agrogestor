"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/professional-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível aceitar.");
      router.replace("/dashboard/configuracoes?aba=whatsapp");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível aceitar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p>
        <Link
          href={`/login?next=${encodeURIComponent(`/equipe/convite/${token}`)}`}
        >
          Entrar ou criar minha conta
        </Link>
      </p>
      <Button disabled={busy} onClick={() => void accept()}>
        {busy ? "Vinculando…" : "Aceitar convite e acessar"}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
