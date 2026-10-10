import type { Store } from "@/types";
import { hasModule } from "./modules";

export interface ActivationStep {
  id: string;
  title: string;
  detail: string;
  ready: boolean;
  href: string;
  action: string;
}

const time = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const hours = (start: string, end: string) =>
  time(start) && time(end) && start < end;

/** Configuration checks only; connection state never proves message delivery. */
export function activationSteps(data: Store): ActivationStep[] {
  const own = data.business.id;
  const services = data.services.filter(
    (s) => s.businessId === own && s.active,
  );
  const validServices = services.filter(
    (s) =>
      s.name.trim() &&
      Number.isFinite(s.price) &&
      s.price >= 0 &&
      Number.isInteger(s.duration) &&
      s.duration > 0,
  );
  const team = data.professionals.filter(
    (p) => p.businessId === own && p.active,
  );
  const linked =
    validServices.length > 0 &&
    validServices.every((s) =>
      team.some((p) => s.professionalIds.includes(p.id)),
    );
  const settings = data.settings;
  const shopHours =
    settings.openDays.length > 0 &&
    settings.openDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    hours(settings.openStart, settings.openEnd);
  const bookableTeam = team.filter(
    (p) =>
      hours(p.start, p.end) &&
      p.days.some((d) => settings.openDays.includes(d)) &&
      p.start < settings.openEnd &&
      p.end > settings.openStart &&
      ((!p.breakStart && !p.breakEnd) ||
        (hours(p.breakStart, p.breakEnd) &&
          p.breakStart >= p.start &&
          p.breakEnd <= p.end)),
  );
  const schedule =
    shopHours &&
    linked &&
    validServices.every((s) =>
      bookableTeam.some((p) => s.professionalIds.includes(p.id)),
    );
  const assistant = hasModule(data.access?.modules, "recepcionista");
  const whatsapp =
    !!data.whatsapp ||
    data.whatsappLink?.status === "open" ||
    (data.professionalWhatsAppLinks || []).some(
      (link) =>
        link.status === "open" &&
        team.some((p) => p.id === link.professionalId),
    );
  const channelReady = assistant
    ? whatsapp && !!data.aiReady && settings.assistantEnabled
    : settings.onlineBookingEnabled;
  return [
    {
      id: "services",
      title: "Catálogo que o cliente pode reservar",
      detail: `${validServices.length} serviços ativos com preço e duração válidos. Confira se os valores estão atualizados.`,
      ready: services.length > 0 && services.length === validServices.length,
      href: "/dashboard/servicos",
      action: "Conferir serviços",
    },
    {
      id: "team",
      title: "Equipe vinculada aos serviços",
      detail: `${team.length} profissionais ativos. Cada serviço precisa ter alguém habilitado para realizá-lo.`,
      ready: linked,
      href: "/dashboard/equipe",
      action: "Organizar equipe",
    },
    {
      id: "hours",
      title: "Expediente da loja e dos profissionais",
      detail:
        "Os dias e os horários precisam se encontrar. Confira também os intervalos e os bloqueios da agenda.",
      ready: schedule,
      href: "/dashboard/configuracoes?aba=agenda",
      action: "Conferir expediente",
    },
    {
      id: "channels",
      title: assistant
        ? "WhatsApp e recepcionista preparados"
        : "Página de agendamento aberta",
      detail: assistant
        ? "Conecte o número, habilite a recepcionista e confira a credencial de IA. O teste final confirma o caminho completo."
        : "Ative o agendamento online para o cliente escolher e reservar pela sua página.",
      ready: channelReady,
      href: assistant
        ? "/dashboard/configuracoes?aba=assistant"
        : "/dashboard/configuracoes?aba=onlineBooking",
      action: assistant ? "Preparar atendimento" : "Ativar página",
    },
  ];
}

/** Invalidate the owner's local test acknowledgement when booking configuration changes. */
export function activationSignature(data: Store) {
  return JSON.stringify({
    business: data.business.id,
    services: data.services
      .map((s) => [
        s.id,
        s.active,
        s.name,
        s.price,
        s.duration,
        [...s.professionalIds].sort(),
      ])
      .sort(),
    team: data.professionals
      .map((p) => [
        p.id,
        p.active,
        [...p.days].sort(),
        p.start,
        p.end,
        p.breakStart,
        p.breakEnd,
      ])
      .sort(),
    settings: [
      data.settings.openDays,
      data.settings.openStart,
      data.settings.openEnd,
      data.settings.minNotice,
      data.settings.maxDays,
      data.settings.buffer,
      data.settings.onlineBookingEnabled,
      data.settings.assistantEnabled,
      data.settings.depositMode,
      data.settings.depositValue,
    ],
    channels: [
      !!data.aiReady,
      !!data.whatsapp,
      data.whatsappLink?.status,
      (data.professionalWhatsAppLinks || [])
        .map((l) => [l.professionalId, l.status])
        .sort(),
      hasModule(data.access?.modules, "recepcionista"),
    ],
  });
}
