import { z } from "zod";
import { assertPublicOpen } from "@/lib/access";
import { DomainError, normalizePhone } from "@/lib/availability";
import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import type { Store } from "@/types";
import { isDemo, mutateDemo } from "./server-demo";

export const checkInSchema = z.union([
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Link inválido.") }),
  z.object({
    phone: z
      .string()
      .max(25)
      .transform((value) => normalizePhone(value))
      .refine((value) => /^[0-9]{10,11}$/.test(value), "Informe seu WhatsApp com DDD."),
  }),
]);
export interface CheckInResult {
  customer: string;
  professional: string;
  start: string;
  checkedInAt: string;
}

const messages: Record<string, [string, number]> = {
  "outside window": [
    "O check-in abre 3 horas antes do seu horário, no dia do atendimento.",
    409,
  ],
  "unknown booking": [
    "Não achamos um horário seu para agora. Confira o número ou fale com a recepção.",
    404,
  ],
  "not checkable": ["Este horário não está mais ativo. Fale com a recepção.", 409],
};
const fail = (code: string) => {
  const [text, status] = messages[code] || ["Não foi possível fazer o check-in.", 409];
  return new DomainError(text, status);
};
const HOUR = 3_600_000;

/** Mesmas regras de check_in_appointment, no arquivo da demonstração. */
export function checkInStore(
  store: Store,
  input: z.infer<typeof checkInSchema>,
  now = new Date(),
): CheckInResult {
  const open = ["pending", "confirmed", "in_progress"];
  let appointment;
  if ("token" in input) {
    appointment = store.appointments.find((item) => item.token === input.token);
    if (!appointment) throw fail("unknown booking");
    if (!open.includes(appointment.status)) throw fail("not checkable");
    if (
      now.getTime() < new Date(appointment.start).getTime() - 3 * HOUR ||
      now.getTime() > new Date(appointment.end).getTime()
    )
      throw fail("outside window");
  } else {
    appointment = store.appointments
      .filter(
        (item) =>
          item.customerPhone === input.phone &&
          open.includes(item.status) &&
          new Date(item.start).getTime() - 3 * HOUR <= now.getTime() &&
          new Date(item.end).getTime() >= now.getTime(),
      )
      .sort(
        (a, b) =>
          Math.abs(new Date(a.start).getTime() - now.getTime()) -
          Math.abs(new Date(b.start).getTime() - now.getTime()),
      )[0];
    if (!appointment) throw fail("unknown booking");
  }
  appointment.checkedInAt ??= now.toISOString();
  const professional = store.professionals.find(
    (person) => person.id === appointment.professionalId,
  );
  return {
    customer: appointment.customerName.split(" ")[0],
    professional: professional?.name.split(" ")[0] || "",
    start: appointment.start,
    checkedInAt: appointment.checkedInAt,
  };
}

export async function checkIn(
  slug: string,
  input: z.infer<typeof checkInSchema>,
): Promise<CheckInResult> {
  if (isDemo())
    return mutateDemo((store) => {
      assertPublicOpen(store.access ?? { status: "active", until: null });
      return checkInStore(store, input);
    }, slug);
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new DomainError("Estabelecimento não encontrado.", 404);
  assertPublicOpen(await readBusinessAccess(business.id));
  const { data, error } =
    "token" in input
      ? await admin.rpc("check_in_by_token", { p_token: input.token })
      : await admin.rpc("check_in_by_phone", {
          p_business_id: business.id,
          p_phone: input.phone,
        });
  if (error) throw fail(error.message);
  // A receipt from another business does not check in here.
  if (data.business_id !== business.id) throw fail("unknown booking");
  return {
    customer: data.customer,
    professional: data.professional || "",
    start: data.start,
    checkedInAt: data.checked_in_at,
  };
}
