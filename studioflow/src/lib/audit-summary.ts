/**
 * Resumo da auditoria de um estabelecimento: visitas e cliques da página,
 * funil até o agendamento e de onde vêm os visitantes.
 */
export interface AuditEvent {
  visitor: string;
  kind: string;
  detail: string;
  device: string;
  referrer: string;
  createdAt: string;
}

export interface AuditSummary {
  visits: number;
  visitors: number;
  clicks: Record<string, number>;
  funnel: { label: string; value: number }[];
  devices: { label: string; value: number }[];
  referrers: { label: string; value: number }[];
  daily: { day: string; visits: number; bookings: number }[];
}

const zoneDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

const top = (map: Map<string, number>, limit: number) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));

export function summarizeAudit(events: AuditEvent[]): AuditSummary {
  const viewers = new Set<string>();
  const opened = new Set<string>();
  const reachedData = new Set<string>();
  const clicks: Record<string, number> = {};
  const devices = new Map<string, number>();
  const referrers = new Map<string, number>();
  const daily = new Map<string, { visits: number; bookings: number }>();
  let visits = 0;
  let bookings = 0;
  for (const event of events) {
    const day = zoneDay(event.createdAt);
    const bucket = daily.get(day) || { visits: 0, bookings: 0 };
    if (event.kind === "view") {
      visits++;
      bucket.visits++;
      viewers.add(event.visitor);
      if (event.device) devices.set(event.device, (devices.get(event.device) || 0) + 1);
      referrers.set(event.referrer || "direto", (referrers.get(event.referrer || "direto") || 0) + 1);
    } else if (event.kind === "etapa") {
      if (event.detail === "inicio") opened.add(event.visitor);
      if (event.detail === "dados") reachedData.add(event.visitor);
    } else if (event.kind === "agendou") {
      bookings++;
      bucket.bookings++;
    } else {
      clicks[event.kind] = (clicks[event.kind] || 0) + 1;
      if (event.kind === "agendar") opened.add(event.visitor);
    }
    daily.set(day, bucket);
  }
  return {
    visits,
    visitors: viewers.size,
    clicks,
    funnel: [
      // Quem chega direto pelo link do agendamento também entra no topo.
      { label: "Visitaram a página ou o agendamento", value: new Set([...viewers, ...opened, ...reachedData]).size },
      { label: "Abriram o agendamento", value: opened.size },
      { label: "Chegaram nos dados", value: reachedData.size },
      { label: "Agendaram", value: bookings },
    ],
    devices: top(devices, 3),
    referrers: top(referrers, 5),
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, ...value })),
  };
}
