import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { Appointment, Professional, Store } from "@/types";
import {
  chooseProfessional,
  DomainError,
  normalizePhone,
  overlaps,
  servicesFor,
} from "@/lib/availability";
import { isDemo, readDemo, mutateDemo } from "./server-demo";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import {
  appointmentSchema,
  blockSchema,
  bookSchema,
  businessSchema,
  customerSchema,
  mutationSchema,
  paymentSchema,
  professionalSchema,
  serviceSchema,
  settingsSchema,
} from "./server-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

export async function demoWorkspaceSlug() {
  return (
    (await cookies()).get("studioflow-demo-business")?.value || "barber-011"
  );
}
export function publicProfessional(person?: Professional) {
  return person
    ? {
        id: person.id,
        businessId: person.businessId,
        name: person.name,
        photo: person.photo,
        specialties: person.specialties,
        active: person.active,
      }
    : null;
}
export function normalizeStoreTimes(store: Store): Store {
  for (const professional of store.professionals) {
    professional.start = professional.start.slice(0, 5);
    professional.end = professional.end.slice(0, 5);
    professional.breakStart = professional.breakStart?.slice(0, 5) || "";
    professional.breakEnd = professional.breakEnd?.slice(0, 5) || "";
  }
  store.settings.openStart = store.settings.openStart.slice(0, 5);
  store.settings.openEnd = store.settings.openEnd.slice(0, 5);
  return store;
}
export function withCustomerMetrics(store: Store): Store {
  for (const customer of store.customers) {
    const completed = store.appointments
      .filter(
        (item) =>
          item.customerId === customer.id && item.status === "completed",
      )
      .sort((a, b) => a.start.localeCompare(b.start));
    customer.visits = completed.length;
    customer.lastVisit = completed.at(-1)?.start;
    customer.totalSpent = store.payments
      .filter((payment) =>
        store.appointments.some(
          (item) =>
            item.id === payment.appointmentId &&
            item.customerId === customer.id,
        ),
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
    const popular = (values: string[]) =>
      Array.from(new Set(values)).sort(
        (a, b) =>
          values.filter((value) => value === b).length -
          values.filter((value) => value === a).length,
      )[0];
    const favoriteService = popular(
      completed.flatMap((item) => item.serviceIds),
    );
    customer.favoriteService = store.services.find(
      (service) => service.id === favoriteService,
    )?.name;
    customer.favoriteProfessional = store.professionals.find(
      (person) =>
        person.id === popular(completed.map((item) => item.professionalId)),
    )?.name;
    const intervals = completed
      .slice(1)
      .map(
        (item, index) =>
          (new Date(item.start).getTime() -
            new Date(completed[index].start).getTime()) /
          86400000,
      )
      .filter((days) => days >= 1);
    if (intervals.length >= 2)
      customer.returnInterval = Math.round(
        intervals.reduce((sum, days) => sum + days, 0) / intervals.length,
      );
  }
  return store;
}
function camel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camel);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        camel(item),
      ]),
    );
  return value;
}
export async function loadSupabaseStore(
  client: SupabaseClient,
  businessId: string,
): Promise<Store> {
  const tables = [
    "businesses",
    "services",
    "professionals",
    "customers",
    "appointments",
    "payments",
    "blocked_times",
    "business_settings",
    "professional_services",
  ] as const;
  const results = await Promise.all(
    tables.map((table) =>
      client
        .from(table)
        .select("*")
        .eq(table === "businesses" ? "id" : "business_id", businessId),
    ),
  );
  const error = results.find((result) => result.error)?.error;
  if (error)
    throw new DomainError(
      `Não foi possível carregar o estabelecimento: ${error.message}`,
      503,
    );
  const [
    businesses,
    services,
    professionals,
    customers,
    appointments,
    payments,
    blockedTimes,
    settings,
    relations,
  ] = results.map((result) => camel(result.data)) as [
    Store["business"][],
    Store["services"],
    Store["professionals"],
    Store["customers"],
    Store["appointments"],
    Store["payments"],
    Store["blockedTimes"],
    Store["settings"][],
    { serviceId: string; professionalId: string }[],
  ];
  if (!businesses[0])
    throw new DomainError("Estabelecimento não encontrado.", 404);
  const serviceIds = await client
    .from("appointment_services")
    .select("appointment_id,service_id")
    .eq("business_id", businessId);
  if (serviceIds.error)
    throw new DomainError("Não foi possível carregar os agendamentos.", 503);
  for (const service of services)
    service.professionalIds = relations
      .filter((relation) => relation.serviceId === service.id)
      .map((relation) => relation.professionalId);
  for (const appointment of appointments)
    appointment.serviceIds = (serviceIds.data || [])
      .filter((relation) => relation.appointment_id === appointment.id)
      .map((relation) => relation.service_id);
  return withCustomerMetrics(
    normalizeStoreTimes({
      business: businesses[0],
      services,
      professionals,
      customers,
      appointments,
      payments,
      blockedTimes,
      settings: settings[0],
    }),
  );
}
export async function getPublicStore(slug: string) {
  if (isDemo()) return readDemo(slug);
  const client = createSupabaseAdmin();
  const { data, error } = await client
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data)
    throw new DomainError("Estabelecimento não encontrado.", 404);
  return loadSupabaseStore(client, data.id);
}
export async function getWorkspace() {
  if (isDemo())
    return {
      ...withCustomerMetrics(await readDemo(await demoWorkspaceSlug())),
      viewer: { name: "João Pedro", role: "owner" },
      mode: "demo",
    } as Store;
  const { client, businessId, role, user } = await requireMembership();
  const { data: profile } = await client
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    ...(await loadSupabaseStore(client, businessId)),
    viewer: { name: profile?.name || user.user_metadata?.name || "Você", role },
    mode: "live",
  } as Store;
}
export function createBooking(
  store: Store,
  input: z.infer<typeof bookSchema>,
  staff = false,
): Appointment {
  const services = servicesFor(store, input.serviceIds);
  const professional = chooseProfessional(
    store,
    input.serviceIds,
    input.professionalId,
    input.start,
    undefined,
    staff,
  );
  const now = new Date().toISOString();
  let customer = store.customers.find(
    (person) =>
      person.businessId === store.business.id && person.phone === input.phone,
  );
  if (!customer) {
    customer = {
      id: randomUUID(),
      businessId: store.business.id,
      name: input.name,
      phone: input.phone,
      email: input.email || undefined,
      visits: 0,
      totalSpent: 0,
      createdAt: now,
    };
    store.customers.push(customer);
  }
  const appointment: Appointment = {
    id: randomUUID(),
    businessId: store.business.id,
    customerId: customer.id,
    customerName: input.name,
    customerPhone: input.phone,
    serviceIds: input.serviceIds,
    professionalId: professional.id,
    start: new Date(input.start).toISOString(),
    end: new Date(
      new Date(input.start).getTime() +
        services.reduce((sum, service) => sum + service.duration, 0) * 60000,
    ).toISOString(),
    price: services.reduce((sum, service) => sum + service.price, 0),
    status: "confirmed",
    reminder: input.reminder,
    token: randomBytes(32).toString("hex"),
    createdAt: now,
  };
  store.appointments.push(appointment);
  return appointment;
}
export async function bookPublic(
  slug: string,
  input: z.infer<typeof bookSchema>,
) {
  if (isDemo()) return mutateDemo((store) => createBooking(store, input), slug);
  const store = await getPublicStore(slug);
  const { data, error } = await createSupabaseAdmin().rpc("book_appointment", {
    p_business_id: store.business.id,
    p_service_ids: input.serviceIds,
    p_professional_id:
      input.professionalId === "any" ? null : input.professionalId,
    p_start: input.start,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email || null,
    p_reminder: input.reminder,
  });
  if (error)
    throw new DomainError(
      error.message.includes("unavailable")
        ? "Este horário acabou de ficar indisponível. Escolha outro horário."
        : "Não foi possível confirmar. Confira os dados e tente novamente.",
      409,
    );
  return camel(data) as Appointment;
}
export function mutateStore(
  store: Store,
  mutation: z.infer<typeof mutationSchema>,
) {
  const { entity, action, data } = mutation;
  const businessId = store.business.id;
  if (
    (data.businessId && data.businessId !== businessId) ||
    (data.tenantId && data.tenantId !== store.business.tenantId)
  )
    throw new DomainError(
      "Dados de outra empresa não podem ser utilizados.",
      403,
    );
  if (entity === "business") {
    if (action !== "update") throw new DomainError("Ação inválida.");
    store.business = {
      ...store.business,
      ...businessSchema.parse({ ...store.business, ...data }),
    };
    return;
  }
  if (entity === "settings") {
    if (action !== "update") throw new DomainError("Ação inválida.");
    store.settings = {
      ...store.settings,
      ...settingsSchema.parse({ ...store.settings, ...data }),
    };
    return;
  }
  const records = store[entity] as { id: string; businessId: string }[];
  const previous = records.find(
    (record) => record.id === data.id && record.businessId === businessId,
  );
  if (action === "create" && records.some((record) => record.id === data.id))
    throw new DomainError("Já existe um registro com este identificador.", 409);
  if (action !== "create" && !previous)
    throw new DomainError("Registro não encontrado.", 404);
  if (action === "delete") {
    if (entity === "services" || entity === "professionals") {
      Object.assign(previous!, { active: false });
      return;
    }
    if (entity === "appointments") {
      Object.assign(previous!, { status: "cancelled" });
      return;
    }
    if (
      entity === "customers" &&
      store.appointments.some((item) => item.customerId === previous!.id)
    )
      throw new DomainError(
        "Este cliente possui histórico. Seu cadastro precisa ser preservado.",
        409,
      );
    records.splice(records.indexOf(previous!), 1);
    return;
  }
  const merged = { ...previous, ...data };
  let validated: Record<string, unknown>;
  if (entity === "services") {
    validated = serviceSchema.parse(merged);
    if (
      (validated.professionalIds as string[]).some(
        (id) =>
          !store.professionals.some(
            (person) => person.id === id && person.businessId === businessId,
          ),
      )
    )
      throw new DomainError("Profissional inválido.");
  } else if (entity === "professionals")
    validated = professionalSchema.parse(merged);
  else if (entity === "customers")
    validated = {
      visits: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      ...previous,
      ...customerSchema.parse(merged),
    };
  else if (entity === "blockedTimes") {
    validated = blockSchema.parse(merged);
    if (
      !store.professionals.some(
        (person) =>
          person.id === validated.professionalId &&
          person.businessId === businessId,
      )
    )
      throw new DomainError("Profissional inválido.");
    if (
      store.appointments.some(
        (item) =>
          item.professionalId === validated.professionalId &&
          !["cancelled", "no_show"].includes(item.status) &&
          new Date(item.start) < new Date(validated.end as string) &&
          new Date(item.end) > new Date(validated.start as string),
      )
    )
      throw new DomainError(
        "Há um agendamento neste período. Reagende antes de bloquear.",
        409,
      );
  } else if (entity === "payments") {
    validated = {
      ...paymentSchema.parse(merged),
      createdAt: new Date().toISOString(),
    };
    if (
      previous &&
      (previous as Store["payments"][number]).appointmentId !==
        validated.appointmentId
    )
      throw new DomainError(
        "O agendamento de um pagamento não pode ser alterado.",
        409,
      );
    const appointment = store.appointments.find(
      (item) =>
        item.id === validated.appointmentId && item.businessId === businessId,
    );
    if (!appointment) throw new DomainError("Agendamento inválido.");
    if (appointment.status !== "completed")
      throw new DomainError(
        "Conclua o atendimento antes de registrar o pagamento.",
        409,
      );
    const paid = store.payments
      .filter(
        (payment) =>
          payment.appointmentId === appointment.id &&
          payment.id !== previous?.id,
      )
      .reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
    if (
      paid + Math.round((validated.amount as number) * 100) >
      Math.round(appointment.price * 100)
    )
      throw new DomainError(
        "O valor ultrapassa o saldo restante deste atendimento.",
        409,
      );
  } else {
    const payload = appointmentSchema.parse(merged);
    if (
      payload.customerId &&
      !store.customers.some(
        (person) =>
          person.id === payload.customerId && person.businessId === businessId,
      )
    )
      throw new DomainError("Cliente inválido.");
    const booked = previous as Appointment | undefined;
    const sameServices =
      booked &&
      payload.serviceIds.length === booked.serviceIds.length &&
      payload.serviceIds.every((id) => booked.serviceIds.includes(id));
    if (
      booked &&
      !sameServices &&
      store.payments.some((payment) => payment.appointmentId === booked.id)
    )
      throw new DomainError(
        "Este atendimento possui pagamentos. Revise os pagamentos antes de alterar os serviços.",
        409,
      );
    const sameSlot =
      booked &&
      sameServices &&
      new Date(payload.start).getTime() === new Date(booked.start).getTime() &&
      payload.professionalId === booked.professionalId;
    const services = sameServices
      ? store.services.filter((service) =>
          booked.serviceIds.includes(service.id),
        )
      : servicesFor(store, payload.serviceIds);
    if (!["cancelled", "no_show"].includes(payload.status) && !sameSlot)
      chooseProfessional(
        store,
        payload.serviceIds,
        payload.professionalId,
        payload.start,
        previous?.id,
        true,
      );
    if (
      sameSlot &&
      ["cancelled", "no_show"].includes(booked.status) &&
      !["cancelled", "no_show"].includes(payload.status) &&
      store.appointments.some(
        (item) =>
          item.id !== booked.id &&
          item.professionalId === booked.professionalId &&
          !["cancelled", "no_show"].includes(item.status) &&
          overlaps(
            new Date(booked.start).getTime(),
            new Date(booked.end).getTime() + store.settings.buffer * 60000,
            new Date(item.start).getTime(),
            new Date(item.end).getTime() + store.settings.buffer * 60000,
          ),
      )
    )
      throw new DomainError("Este horário já possui um agendamento.", 409);
    let customer = store.customers.find(
      (person) =>
        person.id === payload.customerId ||
        person.phone === normalizePhone(payload.customerPhone),
    );
    if (!customer) {
      customer = {
        id: randomUUID(),
        businessId,
        name: payload.customerName,
        phone: payload.customerPhone,
        visits: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
      };
      store.customers.push(customer);
    }
    const duration = sameServices
      ? (new Date(booked.end).getTime() - new Date(booked.start).getTime()) /
        60000
      : services.reduce((sum, service) => sum + service.duration, 0);
    validated = {
      ...payload,
      customerId: customer.id,
      end: new Date(
        new Date(payload.start).getTime() + duration * 60000,
      ).toISOString(),
      price: sameServices
        ? booked.price
        : services.reduce((sum, service) => sum + service.price, 0),
      createdAt: booked?.createdAt || new Date().toISOString(),
      token: booked?.token || randomBytes(32).toString("hex"),
    };
  }
  const record = {
    ...previous,
    ...validated,
    id: previous?.id || (validated.id as string | undefined) || randomUUID(),
    businessId,
  };
  if (action === "create") records.push(record);
  else Object.assign(previous!, record);
}
export async function mutateWorkspace(
  mutation: z.infer<typeof mutationSchema>,
) {
  if (isDemo())
    return {
      ...(await mutateDemo(
        (store) => {
          mutateStore(store, mutation);
          return withCustomerMetrics(store);
        },
        await demoWorkspaceSlug(),
      )),
      viewer: { name: "João Pedro", role: "owner" },
      mode: "demo",
    } as Store;
  const { client, businessId, role, user } = await requireMembership();
  const elevated = ["owner", "admin", "manager"].includes(role);
  if (
    !elevated &&
    ["services", "professionals", "business", "settings", "payments"].includes(
      mutation.entity,
    )
  )
    throw new DomainError(
      "Você não possui permissão para alterar este módulo.",
      403,
    );
  const store = await loadSupabaseStore(client, businessId);
  mutateStore(store, mutation); // Apply the same validation and full-interval check before the database transaction.
  const { error } = await createSupabaseAdmin().rpc("workspace_mutation", {
    p_business_id: businessId,
    p_user_id: user.id,
    p_entity: mutation.entity,
    p_action: mutation.action,
    p_data: mutation.data,
  });
  if (error) {
    const messages: Record<string, string> = {
      unavailable: "Este horário está indisponível.",
      "complete appointment before payment":
        "Conclua o atendimento antes de registrar o pagamento.",
      "payment exceeds remaining balance":
        "O valor ultrapassa o saldo restante deste atendimento.",
      "payment appointment is immutable":
        "O agendamento de um pagamento não pode ser alterado.",
      "appointment has payments":
        "Este atendimento possui pagamentos. Revise-os antes de alterar os serviços.",
      "identifier already exists or forbidden":
        "Este registro já existe ou não pertence ao estabelecimento.",
      forbidden: "Você não possui permissão para realizar esta ação.",
    };
    throw new DomainError(
      messages[error.message] ||
        "Não foi possível salvar. Confira os dados e os vínculos deste registro.",
      error.message === "forbidden" ? 403 : 409,
    );
  }
  const { data: profile } = await client
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    ...(await loadSupabaseStore(client, businessId)),
    viewer: { name: profile?.name || user.user_metadata?.name || "Você", role },
    mode: "live",
  } as Store;
}
export { camel };
