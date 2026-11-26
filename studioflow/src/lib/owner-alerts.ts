import { hasModule } from "@/lib/modules";
import { businessDay } from "@/lib/utils";
import type { Store } from "@/types";

/** Falhas da IA que só a StudioFlow resolve (a chave fica no cofre da plataforma). */
export const credentialFailures = new Set([
  "provider-auth",
  "missing-key",
  "provider-balance",
  "budget-limit",
]);

export interface OwnerAlert {
  id: "whatsapp" | "ai" | "conversations" | "unfinished";
  title: string;
  detail: string;
  action: { label: string; href: string; external?: boolean };
}

/** Números de WhatsApp (QR) que estão fora: o da casa e os de cada profissional. */
export function whatsappDown(data: Store) {
  const down: string[] = [];
  // Com a API oficial da Meta conectada, o número por QR não é o canal principal.
  if (
    data.whatsappLink &&
    data.whatsappLink.status !== "open" &&
    !data.whatsapp
  )
    down.push(data.business.name);
  for (const link of data.professionalWhatsAppLinks || []) {
    if (link.status === "open") continue;
    const person = data.professionals.find(
      (p) => p.id === link.professionalId && p.active,
    );
    if (person) down.push(person.name.split(" ")[0]);
  }
  return down;
}

/** A IA está ligada e a última tentativa dela parou por chave ou saldo. */
export function aiCredentialProblem(
  latest: { state: string; errorCode: string | null } | null | undefined,
) {
  return (
    !!latest &&
    latest.state === "FAILED" &&
    credentialFailures.has(latest.errorCode || "")
  );
}

const openStatuses = new Set(["confirmed", "pending", "in_progress"]);

/**
 * Atendimentos que já terminaram e ninguém fechou (atendido, falta ou
 * cancelado). Nada muda de status sozinho: o dono revisa em Pendências.
 */
export function pastOpenAppointments(data: Store, now = Date.now()) {
  return data.appointments
    .filter((a) => openStatuses.has(a.status) && Date.parse(a.end) < now)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Os de dias anteriores (os de hoje o Salão ao vivo já mostra). */
export function unfinishedAppointments(data: Store, now = Date.now()) {
  const today = businessDay(new Date(now));
  return pastOpenAppointments(data, now).filter(
    (a) => businessDay(a.start) < today,
  );
}

export function ownerAlerts(
  data: Store,
  input: {
    now?: number;
    attention?: number | null;
    latestRun?: { state: string; errorCode: string | null } | null;
    support?: string;
  } = {},
): OwnerAlert[] {
  const now = input.now ?? Date.now();
  const alerts: OwnerAlert[] = [];
  const assistant =
    hasModule(data.access?.modules, "recepcionista") &&
    data.settings.assistantEnabled;
  const down = whatsappDown(data);
  if (down.length)
    alerts.push({
      id: "whatsapp",
      title:
        down.length === 1
          ? "WhatsApp desconectado"
          : `${down.length} WhatsApps desconectados`,
      detail: `${down.join(", ")}: ${assistant ? "a recepcionista não responde e " : ""}os lembretes não saem até reconectar.`,
      action: {
        label: "Reconectar",
        href: "/dashboard/configuracoes?aba=whatsapp",
      },
    });
  if (assistant && aiCredentialProblem(input.latestRun)) {
    const text = `Olá! A recepcionista IA do ${data.business.name} parou de responder (${input.latestRun?.errorCode}).`;
    alerts.push({
      id: "ai",
      title: "A recepcionista IA parou de responder",
      detail:
        input.latestRun?.errorCode === "budget-limit"
          ? "O orçamento mensal da IA foi atingido. As conversas estão indo para a equipe."
          : input.latestRun?.errorCode === "provider-balance"
            ? "O provedor da IA recusou por saldo. As conversas estão indo para a equipe."
            : "A chave da IA foi recusada. As conversas estão indo para a equipe.",
      action: input.support
        ? {
            label: "Avisar o StudioFlow",
            href: `https://wa.me/${input.support}?text=${encodeURIComponent(text)}`,
            external: true,
          }
        : { label: "Ver detalhes", href: "/dashboard/operacao" },
    });
  }
  if (input.attention)
    alerts.push({
      id: "conversations",
      title:
        input.attention === 1
          ? "1 conversa esperando a equipe"
          : `${input.attention} conversas esperando a equipe`,
      detail: "Cliente sem resposta no WhatsApp. Responda pelo painel.",
      action: { label: "Abrir conversas", href: "/dashboard/conversas" },
    });
  const late = unfinishedAppointments(data, now);
  if (late.length)
    alerts.push({
      id: "unfinished",
      title:
        late.length === 1
          ? "1 horário passado sem finalizar"
          : `${late.length} horários passados sem finalizar`,
      detail:
        "Diga o que aconteceu em cada um (atendido, falta ou cancelado) para o caixa e os relatórios ficarem certos.",
      action: {
        label: "Regularizar",
        href: "/dashboard/pendencias",
      },
    });
  return alerts;
}
