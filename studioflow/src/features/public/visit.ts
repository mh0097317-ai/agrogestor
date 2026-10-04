/** O horário mais recente do cliente nesta casa, guardado só no aparelho dele. */
export interface SavedVisit {
  token: string;
  start: string;
  end: string;
}
const key = (slug: string) => `studioflow:visit:${slug}`;
const HOUR = 3_600_000;

export function saveVisit(slug: string, visit: SavedVisit) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(visit));
  } catch {
    // Optional convenience: the phone number still works.
  }
}
export function readVisit(slug: string): SavedVisit | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(slug)) || "null");
    return value && /^[a-f0-9]{64}$/.test(value.token) ? value : null;
  } catch {
    return null;
  }
}
/** Check-in abre 3 horas antes e fecha no fim do atendimento. */
export function checkInOpen(visit: Pick<SavedVisit, "start" | "end">, now = Date.now()) {
  return now >= Date.parse(visit.start) - 3 * HOUR && now <= Date.parse(visit.end);
}
