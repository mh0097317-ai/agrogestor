/** The customer's last booking at a business, kept on their device only. */
export interface LastBooking {
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
}
const key = (slug: string) => `studioflow:last:${slug}`;

export function readLastBooking(slug: string): LastBooking | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(slug)) || "null");
    return value && typeof value.serviceId === "string" ? value : null;
  } catch {
    return null;
  }
}
export function saveLastBooking(slug: string, booking: LastBooking) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(booking));
  } catch {
    // Optional convenience.
  }
}
