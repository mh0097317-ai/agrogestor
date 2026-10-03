import { z } from "zod";
import { normalizePhone } from "@/lib/availability";
const id = z.string().uuid();
const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");
const days = z.array(z.number().int().min(0).max(6)).min(1).max(7);
const image = z
  .string()
  .max(3_000_000)
  .refine(
    (value) =>
      !value ||
      /^https?:\/\//.test(value) ||
      /^\/[^/]/.test(value) ||
      /^data:image\/(jpeg|png|webp);base64,/.test(value),
    "Imagem inválida.",
  );
const phone = z.string().transform((value) => normalizePhone(value));
export const bookSchema = z.object({
  serviceIds: z.array(id).min(1).max(8),
  professionalId: z.union([id, z.literal("any")]),
  start: z.string().datetime({ offset: true }),
  name: z.string().trim().min(3, "Informe seu nome completo.").max(100),
  phone,
  email: z.union([z.string().email(), z.literal("")]).optional(),
  reminder: z.boolean().default(false),
});
export const serviceSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(1).max(60),
  description: z.string().max(500).default(""),
  duration: z.number().int().min(5).max(480),
  price: z.number().min(0).max(100000),
  image: image.default(""),
  active: z.boolean().default(true),
  professionalIds: z.array(id).max(100),
});
export const professionalSchema = z
  .object({
    id: id.optional(),
    name: z.string().trim().min(2).max(100),
    photo: image.default(""),
    phone: z.string().max(25).default(""),
    specialties: z.array(z.string().max(60)).max(30).default([]),
    commission: z.number().min(0).max(100),
    active: z.boolean().default(true),
    days,
    start: clock,
    end: clock,
    breakStart: z.union([clock, z.literal("")]).default(""),
    breakEnd: z.union([clock, z.literal("")]).default(""),
  })
  .refine(
    (data) => data.end > data.start,
    "O fim do expediente deve ser posterior ao início.",
  )
  .refine(
    (data) =>
      (!data.breakStart && !data.breakEnd) ||
      (!!data.breakStart &&
        !!data.breakEnd &&
        data.breakEnd > data.breakStart &&
        data.breakStart >= data.start &&
        data.breakEnd <= data.end),
    "O intervalo deve estar dentro do expediente.",
  );
export const customerSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2).max(100),
  phone,
  email: z.union([z.string().email(), z.literal("")]).optional(),
});
export const businessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().max(80),
  description: z.string().max(1000),
  address: z.string().max(300),
  phone: z.string().max(25),
  instagram: z.string().max(100),
  cover: image,
  logo: image.optional(),
  color: z
    .union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")])
    .optional(),
  amenities: z.array(z.string().max(50)).max(30),
  cnpj: z.string().max(25).optional(),
  photos: z.array(image).max(12).optional(),
});
export const settingsSchema = z
  .object({
    minNotice: z.number().int().min(0).max(10080),
    maxDays: z.number().int().min(1).max(365),
    buffer: z.number().int().min(0).max(120),
    cancellationHours: z.number().int().min(0).max(168),
    openDays: days,
    openStart: clock,
    openEnd: clock,
    notifications: z.boolean(),
  })
  .refine(
    (data) => data.openEnd > data.openStart,
    "O fechamento deve ser posterior à abertura.",
  );
export const appointmentSchema = z.object({
  id: id.optional(),
  customerId: id.optional(),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: phone,
  serviceIds: z.array(id).min(1).max(8),
  professionalId: id,
  start: z.string().datetime({ offset: true }),
  status: z
    .enum([
      "confirmed",
      "pending",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ])
    .default("confirmed"),
  reminder: z.boolean().default(false),
});
export const blockSchema = z
  .object({
    id: id.optional(),
    professionalId: id,
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    reason: z.string().min(2).max(200),
  })
  .refine(
    (data) => new Date(data.end) > new Date(data.start),
    "O fim deve ser posterior ao início.",
  );
export const paymentSchema = z.object({
  id: id.optional(),
  appointmentId: id,
  amount: z
    .number()
    .positive()
    .max(100000)
    .multipleOf(0.01, "Informe o valor com no máximo duas casas decimais."),
  method: z.enum(["pix", "cash", "credit", "debit", "other"]),
});
export const mutationSchema = z.object({
  entity: z.enum([
    "services",
    "professionals",
    "customers",
    "appointments",
    "blockedTimes",
    "business",
    "settings",
    "payments",
  ]),
  action: z.enum(["create", "update", "delete"]),
  data: z.record(z.string(), z.unknown()),
});
export const onboardingSchema = z
  .object({
    category: z.string().min(2).max(80),
    name: z.string().trim().min(2).max(100),
    cover: image.default(""),
    services: z
      .array(
        z.object({
          name: z.string().min(2).max(100),
          duration: z.number().int().min(5).max(480),
          price: z.number().min(0).max(100000),
        }),
      )
      .min(1)
      .max(30),
    professionalNames: z
      .array(z.string().trim().min(2).max(100))
      .min(1)
      .max(30),
    openDays: days,
    openStart: clock,
    openEnd: clock,
  })
  .refine(
    (data) => data.openEnd > data.openStart,
    "Confira os horários de funcionamento.",
  );
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
