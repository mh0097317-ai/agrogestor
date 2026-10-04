import { z } from "zod";
import {
  chooseProfessional,
  DomainError,
  servicesFor,
} from "@/lib/availability";
import { isDemo, findDemoToken, mutateDemo } from "@/services/server-demo";
import { camel, publicProfessional } from "@/services/server-store";
import { randomUUID } from "node:crypto";
import type { Professional, Review } from "@/types";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { tokenSchema } from "@/services/server-validation";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
const reviewErrors = {
  booking_not_found: "Agendamento não encontrado.",
  review_not_allowed:
    "A avaliação fica disponível depois que o atendimento for concluído.",
  already_reviewed: "Você já avaliou este atendimento. Obrigado!",
  invalid_rating: "Escolha de 1 a 5 estrelas.",
};
/** The customer sees only their own rating and comment. */
function ownReview(review?: Review) {
  return review
    ? {
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      }
    : null;
}
const editSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("review"),
    rating: z.number().int().min(1).max(5),
    comment: z
      .string()
      .trim()
      .max(500, "Use no máximo 500 caracteres.")
      .default(""),
  }),
  z.object({
    action: z.literal("reschedule"),
    start: z.string().datetime({ offset: true }),
    professionalId: z.union([z.string().uuid(), z.literal("any")]).optional(),
  }),
]);
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const token = tokenSchema.parse((await params).token);
    if (isDemo()) {
      const { store, appointment } = await findDemoToken(token);
      return respond({
        appointment,
        business: store.business,
        services: store.services.filter((service) =>
          appointment.serviceIds.includes(service.id),
        ),
        professional: publicProfessional(
          store.professionals.find(
            (person) => person.id === appointment.professionalId,
          ),
        ),
        review: ownReview(
          store.reviews?.find((item) => item.appointmentId === appointment.id),
        ),
        loyaltyVisits: store.appointments.filter(
          (item) =>
            item.customerId === appointment.customerId &&
            item.status === "completed",
        ).length,
      });
    }
    const { data, error } = await createSupabaseAdmin().rpc("get_booking", {
      p_token: token,
    });
    if (error || !data)
      throw new DomainError("Agendamento não encontrado.", 404);
    const projection = camel(data) as Record<string, unknown>;
    projection.professional = publicProfessional(
      projection.professional as Professional | undefined,
    );
    return respond(projection);
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const token = tokenSchema.parse((await params).token),
      payload = editSchema.parse(await request.json());
    if (isDemo()) {
      const { slug } = await findDemoToken(token);
      return respond(
        await mutateDemo((store) => {
          const appointment = store.appointments.find(
            (item) => item.token === token,
          );
          if (!appointment)
            throw new DomainError("Agendamento não encontrado.", 404);
          if (payload.action === "review") {
            if (appointment.status !== "completed")
              throw new DomainError(reviewErrors.review_not_allowed, 409);
            store.reviews ??= [];
            if (
              store.reviews.some(
                (item) => item.appointmentId === appointment.id,
              )
            )
              throw new DomainError(reviewErrors.already_reviewed, 409);
            const review: Review = {
              id: randomUUID(),
              businessId: appointment.businessId,
              appointmentId: appointment.id,
              professionalId: appointment.professionalId,
              customerName: appointment.customerName.trim().split(/\s+/)[0],
              rating: payload.rating,
              comment: payload.comment,
              createdAt: new Date().toISOString(),
            };
            store.reviews.unshift(review);
            return ownReview(review);
          }
          if (payload.action === "cancel" && appointment.status === "cancelled")
            return appointment;
          if (!["confirmed", "pending"].includes(appointment.status))
            throw new DomainError(
              "Este agendamento não pode mais ser alterado.",
              409,
            );
          if (
            new Date(appointment.start).getTime() <
            Date.now() + store.settings.cancellationHours * 3600000
          )
            throw new DomainError(
              `Alterações são permitidas até ${store.settings.cancellationHours} horas antes do atendimento. Fale com o estabelecimento.`,
              409,
            );
          if (payload.action === "cancel") {
            appointment.status = "cancelled";
            return appointment;
          }
          const professional = chooseProfessional(
            store,
            appointment.serviceIds,
            payload.professionalId || appointment.professionalId,
            payload.start,
            appointment.id,
          );
          const duration = servicesFor(store, appointment.serviceIds).reduce(
            (sum, service) => sum + service.duration,
            0,
          );
          Object.assign(appointment, {
            professionalId: professional.id,
            start: new Date(payload.start).toISOString(),
            end: new Date(
              new Date(payload.start).getTime() + duration * 60000,
            ).toISOString(),
          });
          return appointment;
        }, slug),
      );
    }
    if (payload.action === "review") {
      const { data, error } = await createSupabaseAdmin().rpc("submit_review", {
        p_token: token,
        p_rating: payload.rating,
        p_comment: payload.comment,
      });
      if (error) {
        const code = Object.keys(reviewErrors).find((key) =>
          error.message.includes(key),
        ) as keyof typeof reviewErrors | undefined;
        throw new DomainError(
          code ? reviewErrors[code] : "Não foi possível enviar sua avaliação.",
          code === "booking_not_found" ? 404 : 409,
        );
      }
      return respond(camel(data));
    }
    const { data, error } = await createSupabaseAdmin().rpc("manage_booking", {
      p_token: token,
      p_action: payload.action,
      p_start: payload.action === "reschedule" ? payload.start : null,
      p_professional_id:
        payload.action === "reschedule" &&
        payload.professionalId &&
        payload.professionalId !== "any"
          ? payload.professionalId
          : null,
    });
    if (error)
      throw new DomainError(
        "Não foi possível alterar este agendamento. Confira a política de cancelamento e a disponibilidade.",
        409,
      );
    return respond(camel(data));
  } catch (error) {
    return failure(error);
  }
}
