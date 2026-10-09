import type { PlatformBusiness } from "@/services/platform";

export type PlatformOrder =
  "attention" | "recent" | "name" | "bookings" | "ai" | "revenue";
export function platformSummary(items: PlatformBusiness[]) {
  const paying = items.filter(
    (item) =>
      ["active", "expiring"].includes(item.state) && (item.price ?? 0) > 0,
  );
  return {
    monthly: paying.reduce((sum, item) => sum + (item.price ?? 0), 0),
    paying: paying.length,
    appointments: items.reduce((sum, item) => sum + item.appointments30d, 0),
    customers: items.reduce((sum, item) => sum + item.customers, 0),
    pending: items.filter((item) => item.state === "pending").length,
    expiring: items.filter((item) => item.state === "expiring").length,
    closed: items.filter((item) =>
      ["expired", "suspended"].includes(item.state),
    ).length,
    online: items.filter(
      (item) =>
        item.onlineBookingEnabled &&
        ["active", "expiring"].includes(item.state),
    ).length,
  };
}
const priority = {
  pending: 0,
  expiring: 1,
  expired: 2,
  suspended: 3,
  active: 4,
};
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchPlatform(
  items: PlatformBusiness[],
  query: string,
  order: PlatformOrder,
) {
  const term = normalized(query.trim());
  return items
    .filter(
      (item) =>
        !term ||
        normalized(
          [
            item.name,
            item.slug,
            item.ownerName,
            item.ownerEmail,
            item.phone,
          ].join(" "),
        ).includes(term),
    )
    .sort((a, b) => {
      const key =
        order === "bookings"
          ? "appointments"
          : order === "ai"
            ? "assistantBookings"
            : order === "revenue"
              ? "received"
              : null;
      if (key)
        return (
          b.activity[key] - a.activity[key] ||
          a.name.localeCompare(b.name, "pt-BR")
        );
      if (order === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (order === "attention") {
        const rank = priority[a.state] - priority[b.state];
        if (rank) return rank;
        if (a.state === "expiring" && a.until && b.until)
          return a.until.localeCompare(b.until);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
}
