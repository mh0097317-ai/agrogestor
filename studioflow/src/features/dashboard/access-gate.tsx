"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowsClockwise,
  Check,
  SignOut,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { WhatsAppIcon } from "@/components/brand-icons";
import type { BlockedAccess } from "@/hooks/use-workspace";
import { FeePayment } from "./fee-payment";
import "./access-gate.css";

/** Número da equipe StudioFlow para falar sobre liberação (só dígitos, com DDI). */
const support = (process.env.NEXT_PUBLIC_STUDIOFLOW_WHATSAPP || "").replace(
  /\D/g,
  "",
);

const copy = {
  pending: {
    kicker: "Cadastro recebido",
    title: "Seu painel está quase pronto",
    text: "A equipe StudioFlow confere cada estabelecimento antes de liberar. Assim que liberarmos, esta tela abre sozinha.",
    ask: "Olá! Acabei de cadastrar meu estabelecimento no StudioFlow e gostaria de liberar o acesso.",
  },
  expired: {
    kicker: "Acesso encerrado",
    title: "Seu período de acesso terminou",
    text: "Sua agenda online também está pausada. Seus dados, clientes e histórico continuam guardados. É só renovar para voltar de onde parou.",
    ask: "Olá! O acesso do meu estabelecimento no StudioFlow venceu e quero renovar.",
  },
  suspended: {
    kicker: "Acesso pausado",
    title: "O acesso está pausado",
    text: "Painel e agenda online estão fechados por enquanto. Nada foi apagado. Fale com a equipe StudioFlow para reativar.",
    ask: "Olá! Quero reativar o acesso do meu estabelecimento no StudioFlow.",
  },
} as const;

export function AccessGate({
  access,
  onRetry,
}: {
  access: BlockedAccess;
  onRetry: () => Promise<void>;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const text =
    copy[
      access.state === "pending" || access.state === "suspended"
        ? access.state
        : "expired"
    ];

  // Opens by itself as soon as the team releases the access.
  useEffect(() => {
    const timer = window.setInterval(() => void onRetry(), 30_000);
    return () => window.clearInterval(timer);
  }, [onRetry]);

  async function check() {
    setChecking(true);
    await onRetry();
    setChecking(false);
  }
  async function signOut() {
    setLeaving(true);
    await fetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }
  const ask = `${text.ask}${access.business ? ` (${access.business})` : ""}`;

  return (
    <main className="gate">
      <div className="gate-card">
        <Brand size={34} />
        <small className="gate-kicker">{text.kicker}</small>
        <h1>{text.title}</h1>
        {access.business && <p className="gate-business">{access.business}</p>}
        <p>{text.text}</p>
        {access.state === "pending" ? (
          <ol className="gate-steps">
            <li className="is-done">
              <span>
                <Check size={13} weight="bold" />
              </span>
              Cadastro e página criados
            </li>
            <li className="is-now">
              <span />
              Liberação pela equipe StudioFlow
            </li>
            <li>
              <span />
              Painel aberto para você usar
            </li>
          </ol>
        ) : (
          access.until && (
            <p className="gate-until">
              Acesso até {format(new Date(access.until), "dd/MM/yyyy")}
            </p>
          )
        )}
        {access.state === "expired" && (
          <FeePayment
            onPaid={async () => {
              await onRetry();
            }}
          />
        )}
        <div className="gate-actions">
          {support && (
            <a
              className="btn btn-primary"
              href={`https://wa.me/${support}?text=${encodeURIComponent(ask)}`}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon size={16} /> Falar com o StudioFlow
            </a>
          )}
          <button
            type="button"
            className={`btn ${support ? "btn-secondary" : "btn-primary"}`}
            onClick={() => void check()}
            disabled={checking}
          >
            <ArrowsClockwise
              size={16}
              className={checking ? "gate-spin" : ""}
            />
            {checking ? "Conferindo…" : "Conferir agora"}
          </button>
        </div>
        <button
          type="button"
          className="gate-signout"
          onClick={() => void signOut()}
          disabled={leaving}
        >
          <SignOut size={15} /> {leaving ? "Saindo…" : "Sair da conta"}
        </button>
      </div>
    </main>
  );
}
