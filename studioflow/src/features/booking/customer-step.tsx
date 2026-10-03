"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Service, Slot } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { BusyButton } from "@/features/public/public-ui";
import { BookingSummary } from "./booking-summary";

const validDdds = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
  37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);
export function validBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");
  return (
    digits.length === 11 &&
    validDdds.has(Number(digits.slice(0, 2))) &&
    digits[2] === "9" &&
    !/^(\d)\1+$/.test(digits.slice(2))
  );
}
const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome, com pelo menos 3 letras.")
    .max(100, "Use no máximo 100 caracteres."),
  phone: z
    .string()
    .refine(
      validBrazilianPhone,
      "Informe um WhatsApp válido com DDD. Ex.: (11) 99999-9999.",
    ),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido.")]),
  reminder: z.boolean(),
});
export type CustomerFields = z.infer<typeof customerSchema>;
export function phoneMask(value: string) {
  const digits = value
    .replace(/\D/g, "")
    .replace(/^55(?=\d{11}$)/, "")
    .slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function CustomerStep({
  service,
  professional,
  slot,
  defaults,
  busy,
  error,
  onSubmit,
  onChange,
}: {
  service: Service;
  professional?: PublicProfessional;
  slot: Slot;
  defaults: CustomerFields;
  busy: boolean;
  error: string;
  onSubmit: (values: CustomerFields) => void;
  onChange: (values: CustomerFields) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
  } = useForm<CustomerFields>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaults,
  });
  return (
    <section className="booking-step">
      <span className="public-eyebrow">04 / SÓ FALTAM SEUS DADOS</span>
      <h1 tabIndex={-1}>Quase pronto!</h1>
      <p className="booking-subtitle">
        Confira seu horário e conte como podemos te chamar.
      </p>
      <div className="booking-mobile-summary">
        <BookingSummary
          service={service}
          professional={professional}
          slot={slot}
          compact
        />
      </div>
      <form
        className="booking-customer-form"
        onSubmit={handleSubmit(onSubmit)}
        onBlur={() => onChange(getValues())}
        onChange={() => onChange(getValues())}
      >
        <label htmlFor="booking-name">
          Seu nome
          <input
            id="booking-name"
            autoComplete="name"
            placeholder="Como você se chama?"
            maxLength={100}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "booking-name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <span id="booking-name-error" className="booking-field-error">
              {errors.name.message}
            </span>
          )}
        </label>
        <label htmlFor="booking-phone">
          WhatsApp
          <input
            id="booking-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 99999-9999"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "booking-phone-error" : undefined}
            {...register("phone", {
              onChange: (event) =>
                setValue("phone", phoneMask(event.target.value)),
            })}
          />
          {errors.phone && (
            <span id="booking-phone-error" className="booking-field-error">
              {errors.phone.message}
            </span>
          )}
        </label>
        <label htmlFor="booking-email">
          E-mail <span className="booking-optional">opcional</span>
          <input
            id="booking-email"
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "booking-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <span id="booking-email-error" className="booking-field-error">
              {errors.email.message}
            </span>
          )}
        </label>
        <label className="booking-checkbox">
          <input type="checkbox" {...register("reminder")} />
          <span>
            Quero receber lembretes do meu agendamento pelo WhatsApp.
            <small>
              Sua autorização de contato será salva. Guarde também seu link de
              confirmação.
            </small>
          </span>
        </label>
        {error && (
          <div className="booking-error" role="alert">
            {error}
          </div>
        )}
        <BusyButton type="submit" busy={busy}>
          Confirmar agendamento <ArrowRight size={18} />
        </BusyButton>
        <p className="booking-private-note">
          <ShieldCheck size={14} /> Seus dados serão usados para cuidar do seu
          agendamento.
        </p>
      </form>
    </section>
  );
}
