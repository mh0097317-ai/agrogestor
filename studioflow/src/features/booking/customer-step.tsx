"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  EnvelopeSimple,
  ShieldCheck,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
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
  welcomeName,
  onForget,
  service,
  professional,
  slot,
  defaults,
  busy,
  error,
  onSubmit,
  onChange,
}: {
  welcomeName?: string;
  onForget?: () => void;
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
      <h1 tabIndex={-1}>
        {welcomeName ? `Que bom te ver, ${welcomeName}!` : "Quase pronto!"}
      </h1>
      <p className="booking-subtitle">
        {welcomeName
          ? "Confira o resumo e confirme seu horário."
          : "Só falta seu nome e WhatsApp."}
      </p>
      {welcomeName && (
        <div className="booking-welcome" role="status">
          <span>
            Seus dados já estão preenchidos e ficam só neste aparelho.
          </span>
          <button type="button" onClick={onForget}>
            Não é você?
          </button>
        </div>
      )}
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
          <span className="booking-input">
            <User weight="duotone" size={18} />
            <input
              id="booking-name"
              autoComplete="name"
              placeholder="Como você se chama?"
              maxLength={100}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "booking-name-error" : undefined}
              {...register("name")}
            />
          </span>
          {errors.name && (
            <span id="booking-name-error" className="booking-field-error">
              {errors.name.message}
            </span>
          )}
        </label>
        <label htmlFor="booking-phone">
          WhatsApp
          <span className="booking-input">
            <WhatsAppIcon size={18} />
            <input
              id="booking-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 99999-9999"
              aria-invalid={!!errors.phone}
              aria-describedby={
                errors.phone ? "booking-phone-error" : undefined
              }
              {...register("phone", {
                onChange: (event) =>
                  setValue("phone", phoneMask(event.target.value)),
              })}
            />
          </span>
          {errors.phone && (
            <span id="booking-phone-error" className="booking-field-error">
              {errors.phone.message}
            </span>
          )}
        </label>
        <label htmlFor="booking-email">
          E-mail <span className="booking-optional">opcional</span>
          <span className="booking-input">
            <EnvelopeSimple weight="duotone" size={18} />
            <input
              id="booking-email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              aria-invalid={!!errors.email}
              aria-describedby={
                errors.email ? "booking-email-error" : undefined
              }
              {...register("email")}
            />
          </span>
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
            <small>O estabelecimento poderá te avisar antes do horário.</small>
          </span>
        </label>
        {error && (
          <div className="booking-error" role="alert">
            {error}
          </div>
        )}
        <BusyButton type="submit" busy={busy} className="sf-sheen">
          Confirmar agendamento <ArrowRight weight="bold" size={18} />
        </BusyButton>
        <p className="booking-private-note">
          <ShieldCheck weight="duotone" size={14} /> Usamos seus dados só para
          este agendamento.
        </p>
      </form>
    </section>
  );
}
