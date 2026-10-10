"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Button, Card, PageHeader } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { activationSignature, activationSteps } from "@/lib/activation";
import { hasModule } from "@/lib/modules";
import "./activation.css";

export default function ActivationPage() {
  const { data, refresh, refreshing, error: workspaceError } = useWorkspace();
  const [checked, setChecked] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const allowed = ["owner", "admin", "manager"].includes(
    data?.viewer?.role || "",
  );
  const signature = data && activationSignature(data);
  const key = data && `studioflow-activation-v1:${data.business.id}`;
  useEffect(() => {
    if (!key || !signature || !allowed) return;
    // Browser-local acknowledgement, never represented as an automatic test result.
    queueMicrotask(() => {
      setAcknowledged(false);
      try {
        const record = JSON.parse(localStorage.getItem(key) || "null");
        setChecked(
          record?.signature === signature &&
            typeof record?.at === "string" &&
            Number.isFinite(Date.parse(record.at))
            ? record.at
            : null,
        );
      } catch {
        setChecked(null);
      }
    });
  }, [key, signature, allowed]);
  if (workspaceError)
    return (
      <Card>
        <h2>Não foi possível carregar seu espaço.</h2>
        <p>{workspaceError}</p>
        <Button onClick={() => void refresh()}>Tentar novamente</Button>
      </Card>
    );
  if (!data) return <p>Carregando seu espaço…</p>;
  if (!allowed)
    return (
      <Card>A ativação está disponível para a gestão do estabelecimento.</Card>
    );
  const steps = activationSteps(data);
  const configured = steps.every((step) => step.ready);
  const done =
    steps.filter((step) => step.ready).length + (configured && checked ? 1 : 0);
  const assistant = hasModule(data.access?.modules, "recepcionista");
  function finish() {
    if (!configured || !acknowledged || !key || !signature) return;
    const at = new Date().toISOString();
    setChecked(at);
    try {
      localStorage.setItem(key, JSON.stringify({ signature, at }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  return (
    <div className="activation-page">
      <PageHeader
        title="Ative seu espaço"
        description="Cinco passos para receber a primeira reserva com segurança."
        actions={
          <Button
            variant="secondary"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? "Conferindo…" : "Conferir novamente"}
          </Button>
        }
      />
      <Card className="activation-progress">
        <div>
          <span className="activation-eyebrow">
            Preparação / {data.business.name}
          </span>
          <h2>
            {done === 5
              ? "Pronto para receber clientes."
              : "Sua primeira reserva começa aqui."}
          </h2>
          <p>
            {done} de 5 etapas conferidas
            {data.mode === "demo" ? " · Dados de demonstração" : ""}.
          </p>
        </div>
        <progress
          max={5}
          value={done}
          aria-label={`${done} de 5 etapas conferidas`}
        />
      </Card>
      <ol className="activation-steps">
        {steps.map((step, i) => (
          <li key={step.id} className={step.ready ? "ready" : "pending"}>
            <span className="activation-number" aria-hidden="true">
              {step.ready ? <Check size={20} weight="bold" /> : `0${i + 1}`}
            </span>
            <div>
              <span className="activation-eyebrow">
                {step.ready
                  ? "Configuração conferida"
                  : "Precisa da sua atenção"}
              </span>
              <h2>{step.title}</h2>
              <p>{step.detail}</p>
              {step.id === "hours" && (
                <Link href="/dashboard/equipe">Ajustar horários da equipe</Link>
              )}
              {step.id === "channels" && assistant && (
                <Link href="/dashboard/configuracoes?aba=whatsapp">
                  Conectar WhatsApp
                </Link>
              )}
            </div>
            <Link className="activation-action" href={step.href}>
              {step.action}
              <ArrowRight size={17} />
            </Link>
          </li>
        ))}
      </ol>
      <Card className="activation-test">
        <span className="activation-eyebrow">05 / Teste acompanhado</span>
        <h2>Veja a reserva chegar de ponta a ponta.</h2>
        <p>
          {assistant
            ? "Com outro número sob seu controle, envie uma mensagem ao WhatsApp conectado. Peça um serviço, escolha um horário livre e autorize a reserva."
            : "Abra sua página como cliente, escolha um serviço e um horário livre e conclua uma reserva usando seu próprio contato."}{" "}
          Este teste cria um agendamento real e pode gerar um sinal por Pix, se
          estiver habilitado.
        </p>
        <ol>
          <li>
            Confira serviço, profissional, dia, horário e valor no comprovante
            recebido.
          </li>
          <li>
            Abra a agenda e confirme que há apenas uma reserva, com os mesmos
            dados.
          </li>
          <li>
            {assistant
              ? "Confira no aparelho se a resposta chegou. Se houver sinal, a reserva deve informar que aguarda o pagamento."
              : "Se houver sinal, confira a indicação de pagamento pendente no comprovante."}
          </li>
          <li>
            Depois, cancele a reserva de teste na agenda para liberar o horário.
            Confira separadamente qualquer pagamento feito.
          </li>
        </ol>
        <div className="activation-test-links">
          {data.settings.onlineBookingEnabled && (
            <Link
              href={`/${data.business.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir página de agendamento ↗
            </Link>
          )}
          <Link href="/dashboard/agenda">Conferir agenda →</Link>
          <Link href="/dashboard/operacao">Ver saúde da operação →</Link>
        </div>
        {configured && checked ? (
          <div className="activation-confirmed" role="status">
            <CheckCircle size={24} />
            <div>
              <strong>Teste conferido por você</strong>
              <p>
                {new Date(checked).toLocaleString("pt-BR")} · Registro neste
                aparelho. A conferência é sua; não é uma validação automática de
                entrega.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setChecked(null);
                  setAcknowledged(false);
                  if (key) {
                    try {
                      localStorage.removeItem(key);
                    } catch {}
                  }
                }}
              >
                Refazer conferência
              </Button>
            </div>
          </div>
        ) : (
          <>
            <label className="activation-check">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={!configured}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>
                Recebi o comprovante e conferi a reserva na agenda, com os
                mesmos dados.
              </span>
            </label>
            <Button disabled={!configured || !acknowledged} onClick={finish}>
              Registrar minha conferência
            </Button>
            {!configured && (
              <p>
                Conclua as quatro configurações acima antes de registrar o
                teste.
              </p>
            )}
          </>
        )}
        {storageError && (
          <p role="status">
            Sua conferência está marcada nesta tela, mas o navegador não
            permitiu salvar neste aparelho.
          </p>
        )}
      </Card>
    </div>
  );
}
