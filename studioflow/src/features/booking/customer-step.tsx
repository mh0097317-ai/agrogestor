"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, LockSimple, User } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import type { Service, Slot } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { BusyButton } from "@/features/public/public-ui";
import { BookingRecap } from "./booking-summary";
import { StepHead } from "./selection-steps";

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
  onEdit,
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
  onEdit?: (step: number) => void;
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
    <section className="bk-step">
      <StepHead
        title={
          welcomeName ? `Que bom te ver, ${welcomeName}!` : "Quase pronto!"
        }
        text="Confirme seus dados para finalizar o agendamento."
      />
      <BookingRecap
        service={service}
        professional={professional}
        slot={slot}
        onEdit={onEdit}
      />
      {welcomeName && (
        <div className="bk-welcome" role="status">
          <span>
            Seus dados já estão preenchidos e ficam só neste aparelho.
          </span>
          <button type="button" onClick={onForget}>
            Não é você?
          </button>
        </div>
      )}
      <form
        className="bk-form"
        onSubmit={handleSubmit(onSubmit)}
        onBlur={() => onChange(getValues())}
        onChange={() => onChange(getValues())}
        noValidate
      >
        <label htmlFor="booking-name">
          <span className="bk-label">Seu nome</span>
          <span className="bk-input">
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
            <span id="booking-name-error" className="bk-field-error">
              {errors.name.message}
            </span>
          )}
        </label>
        <label htmlFor="booking-phone">
          <span className="bk-label">WhatsApp</span>
          <span className="bk-input">
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
            <span id="booking-phone-error" className="bk-field-error">
              {errors.phone.message}
            </span>
          )}
        </label>
        <label className="bk-check">
          <input type="checkbox" {...register("reminder")} />
          <span className="bk-check-box" aria-hidden="true">
            <Check weight="bold" size={12} />
          </span>
          <span>Quero receber lembretes do meu agendamento pelo WhatsApp.</span>
        </label>
        {error && (
          <div className="bk-alert" role="alert">
            <p>{error}</p>
          </div>
        )}
        <BusyButton type="submit" busy={busy} className="bk-primary sf-sheen">
          Confirmar agendamento
        </BusyButton>
        <p className="bk-safe">
          <LockSimple weight="duotone" size={14} /> Seus dados são usados só
          para este agendamento.
        </p>
      </form>
    </section>
  );
}
