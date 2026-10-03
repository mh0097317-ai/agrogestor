import { writeFile } from "node:fs/promises";
import { createSeed } from "../src/lib/seed";
const store = createSeed();
const statements = [
  "-- Development sample generated from src/lib/seed.ts. Do not apply to a production business.",
  "-- No default password or user is created. Link an existing local Auth user through business_members to explore the owner panel.",
  "begin;",
];
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
function value(input: unknown, key: string): string {
  if (input === null || input === undefined) return "null";
  if (typeof input === "boolean") return input ? "true" : "false";
  if (typeof input === "number") return String(input);
  if (Array.isArray(input)) {
    const type = ["days", "open_days"].includes(key) ? "integer" : "text";
    return `ARRAY[${input.map((item) => value(item, key)).join(",")}]::${type}[]`;
  }
  return quote(String(input));
}
const snake = (key: string) =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
function insert(table: string, record: object, omit: string[] = []) {
  const entries = Object.entries(record)
    .filter(
      ([key]) =>
        !omit.includes(key) && record[key as keyof typeof record] !== undefined,
    )
    .map(([key, item]) => [snake(key), item] as const);
  statements.push(
    `insert into public.${table} (${entries.map(([key]) => `"${key}"`).join(",")}) values (${entries.map(([key, item]) => value(item, key)).join(",")}) on conflict do nothing;`,
  );
}
insert("tenants", { id: store.business.tenantId, name: store.business.name });
insert("businesses", store.business);
insert("business_settings", {
  ...store.settings,
  tenantId: store.business.tenantId,
});
for (const professional of store.professionals)
  insert("professionals", {
    ...professional,
    tenantId: store.business.tenantId,
    breakStart: professional.breakStart || null,
    breakEnd: professional.breakEnd || null,
  });
for (const service of store.services) {
  insert("services", { ...service, tenantId: store.business.tenantId }, [
    "professionalIds",
  ]);
  for (const professionalId of service.professionalIds)
    insert("professional_services", {
      tenantId: store.business.tenantId,
      businessId: store.business.id,
      professionalId,
      serviceId: service.id,
    });
}
for (const customer of store.customers)
  insert("customers", { ...customer, tenantId: store.business.tenantId });
for (const appointment of store.appointments) {
  insert(
    "appointments",
    {
      ...appointment,
      tenantId: store.business.tenantId,
      occupiedEnd: new Date(
        new Date(appointment.end).getTime() + store.settings.buffer * 60000,
      ).toISOString(),
    },
    ["serviceIds", "token"],
  );
  for (const serviceId of appointment.serviceIds) {
    const service = store.services.find((item) => item.id === serviceId)!;
    insert("appointment_services", {
      tenantId: store.business.tenantId,
      businessId: store.business.id,
      appointmentId: appointment.id,
      serviceId,
      duration: service.duration,
      price: service.price,
    });
  }
}
for (const payment of store.payments)
  insert("payments", { ...payment, tenantId: store.business.tenantId });
for (const block of store.blockedTimes)
  insert("blocked_times", { ...block, tenantId: store.business.tenantId });
statements.push("commit;");
await writeFile(
  new URL("../supabase/seed.sql", import.meta.url),
  statements.join("\n") + "\n",
);
console.log(
  `Generated Supabase seed: ${store.services.length} services, ${store.professionals.length} professionals, ${store.customers.length} customers, ${store.appointments.length} appointments.`,
);
