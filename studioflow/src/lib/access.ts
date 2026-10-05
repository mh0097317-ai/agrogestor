import { DomainError } from "./availability";

/** Liberação de um estabelecimento pela equipe StudioFlow. */
export type AccessStatus = "pending" | "active" | "suspended";
export interface BusinessAccess {
  status: AccessStatus;
  /** Fim do acesso; null = sem prazo. */
  until: string | null;
  note?: string;
  /** Módulos contratados; null = todos (veja src/lib/modules.ts). */
  modules?: string[] | null;
  /** Plano combinado com o cliente e a mensalidade, para a equipe. */
  plan?: string;
  price?: number | null;
}
export type AccessState =
  | "pending"
  | "active"
  | "expiring"
  | "expired"
  | "suspended";
export interface AccessEvent {
  id: string;
  action:
    | "created"
    | "granted"
    | "unlimited"
    | "until"
    | "suspended"
    | "pending"
    | "note"
    | "plan";
  days: number | null;
  until: string | null;
  createdAt: string;
}

const DAY = 86_400_000;
/** Faltando até esta quantidade de dias, o dono vê o aviso de renovação. */
export const expiringDays = 5;

export function accessOpen(access: BusinessAccess, now = new Date()) {
  return (
    access.status === "active" &&
    (!access.until || new Date(access.until).getTime() > now.getTime())
  );
}
export function accessState(access: BusinessAccess, now = new Date()): AccessState {
  if (access.status === "pending") return "pending";
  if (access.status === "suspended") return "suspended";
  if (!accessOpen(access, now)) return "expired";
  const left = daysLeft(access, now);
  return left !== null && left <= expiringDays ? "expiring" : "active";
}
/** Dias inteiros que faltam (arredondado para cima); null = sem prazo. */
export function daysLeft(access: BusinessAccess, now = new Date()) {
  if (!access.until) return null;
  return Math.ceil((new Date(access.until).getTime() - now.getTime()) / DAY);
}
/** Liberar N dias soma ao prazo que ainda resta; vencido ou sem prazo conta de agora. */
export function extendUntil(
  current: string | null,
  days: number,
  now = new Date(),
) {
  const base =
    current && new Date(current).getTime() > now.getTime()
      ? new Date(current).getTime()
      : now.getTime();
  return new Date(base + days * DAY).toISOString();
}
/** Fim do dia escolhido no horário de São Paulo (23:59:59 -03:00). */
export function endOfBusinessDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new DomainError("Escolha uma data válida.");
  return new Date(`${date}T23:59:59-03:00`).toISOString();
}

/** O painel e a página pública ficam fechados enquanto o acesso não está liberado. */
export class AccessError extends DomainError {
  constructor(
    message: string,
    public access: {
      state: AccessState;
      until: string | null;
      business: string;
    },
  ) {
    super(message, 423);
  }
}
const workspaceMessages: Record<AccessState, string> = {
  pending: "Seu cadastro foi recebido e está aguardando liberação.",
  suspended: "O acesso deste estabelecimento está pausado.",
  expired: "O período de acesso deste estabelecimento terminou.",
  active: "",
  expiring: "",
};
export function assertWorkspaceOpen(
  access: BusinessAccess,
  business: string,
  now = new Date(),
) {
  const state = accessState(access, now);
  if (accessOpen(access, now)) return state;
  throw new AccessError(workspaceMessages[state], {
    state,
    until: access.until,
    business,
  });
}
export function assertPublicOpen(access: BusinessAccess, now = new Date()) {
  if (!accessOpen(access, now))
    throw new DomainError(
      "A agenda online deste estabelecimento está pausada no momento.",
      423,
    );
}
