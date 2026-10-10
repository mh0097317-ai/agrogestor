"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Check,
  IdentificationCard,
  LockSimple,
  Seal,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import type { Service, Slot } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { BusyButton } from "@/features/public/public-ui";
import { BookingRecap } from "./booking-summary";
import { StepHead } from "./selection-steps";
import { DrawCheck } from "./draw-check";
import { useState } from "react";
import { coverageMessages, formatCpf, isValidCpf } from "@/lib/payments";
import type { CoverageResult } from "@/lib/payments";
import { money } from "@/lib/utils";

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
  cpf: z.string().optional(),
});
export type CustomerFields = z.infer<typeof customerSchema>;
/** The CPF is asked only when a Pix deposit will be charged. */
const withCpf = customerSchema.refine((value) => isValidCpf(value.cpf || ""), {
  path: ["cpf"],
  message: "Informe um CPF válido. Ele é exigido para emitir o Pix.",
});

const lowerWords = new Set(["da", "de", "do", "das", "dos", "e"]);
/** "ana paula dos santos" → "Ana Paula dos Santos". */
function titleName(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  // Respect a name typed with intentional capitals.
  if (clean !== clean.toLocaleLowerCase("pt-BR")) return clean;
  return clean
    .split(" ")
    .map((word, index) =>
      index > 0 && lowerWords.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1),
    )
    .join(" ");
}

/** "ana paula" → "Ana" (only a real-looking first name). */
function firstName(value: string) {
  const word = value.trim().split(/\s+/)[0] || "";
  return word.length >= 2 && /^[\p{L}'-]+$/u.test(word)
    ? word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR")
    : "";
}

export interface ClubNotice {
  planName: string;
  result: CoverageResult;
}
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
  services,
  professional,
  slot,
  defaults,
  busy,
  error,
  onSubmit,
  onChange,
  onEdit,
  deposit = 0,
  holdMinutes = 15,
  club,
}: {
  /** Pix deposit charged now (0 when none). */
  deposit?: number;
  holdMinutes?: number;
  club?: ClubNotice | null;
  welcomeName?: string;
  onForget?: () => void;
  services: Service[];
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
    control,
  } = useForm<CustomerFields>({
    resolver: zodResolver(deposit > 0 ? withCpf : customerSchema),
    defaultValues: defaults,
  });
  const values = useWatch({ control }) as CustomerFields;
  const valid = {
    name: (values.name || "").trim().length >= 3,
    phone: validBrazilianPhone(values.phone || ""),
    cpf: isValidCpf(values.cpf || ""),
  };
  // The title greets by first name once the name field is left.
  const [greeting, setGreeting] = useState(
    () => welcomeName || firstName(defaults.name),
  );
  const mark = (ok: boolean) =>
    ok ? (
      <span className="bk-valid" aria-hidden="true">
        <DrawCheck size={15} />
      </span>
    ) : null;
  return (
    <section className="bk-step">
      <StepHead
        key={greeting}
        title={
          welcomeName && greeting === welcomeName
            ? `Que bom te ver, ${welcomeName}!`
            : greeting
              ? `Quase pronto, ${greeting}!`
              : "Quase pronto!"
        }
        text="Confirme seus dados para finalizar o agendamento."
      />
      <BookingRecap
        services={services}
        professional={professional}
        slot={slot}
        onEdit={onEdit}
        totalPrice={club?.result === "covered" ? 0 : undefined}
      />
      {club && (
        <div
          className={`bk-club-note ${club.result === "covered" ? "is-covered" : ""}`}
          role="status"
        >
          <Seal weight="duotone" size={20} />
          <span>
            <strong>
              {club.result === "covered"
                ? `Incluso no ${club.planName}`
                : club.planName}
            </strong>
            {club.result === "covered"
              ? "Este horário entra no seu clube e não tem custo agora."
              : coverageMessages[club.result]}
          </span>
        </div>
      )}
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
              {...register("name", {
                onBlur: (event) => {
                  const tidy = titleName(event.target.value);
                  if (tidy !== event.target.value) setValue("name", tidy);
                  setGreeting(firstName(tidy));
                },
              })}
            />
            {mark(valid.name)}
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
            {mark(valid.phone)}
          </span>
          {errors.phone && (
            <span id="booking-phone-error" className="bk-field-error">
              {errors.phone.message}
            </span>
          )}
        </label>
        {deposit > 0 && (
          <div className="bk-deposit-field">
            <div className="bk-deposit-note">
              <span>
                <strong>Sinal de {money(deposit)} via Pix</strong>O valor é
                descontado no dia. Seu horário fica guardado por{" "}
                {holdMinutes} minutos enquanto você paga.
              </span>
            </div>
            <label htmlFor="booking-cpf">
              <span className="bk-label">CPF</span>
              <span className="bk-input">
                <IdentificationCard weight="duotone" size={18} />
                <input
                  id="booking-cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  aria-invalid={!!errors.cpf}
                  aria-describedby={
                    errors.cpf ? "booking-cpf-error" : "booking-cpf-help"
                  }
                  {...register("cpf", {
                    onChange: (event) =>
                      setValue("cpf", formatCpf(event.target.value)),
                  })}
                />
                {mark(valid.cpf)}
              </span>
              {errors.cpf ? (
                <span id="booking-cpf-error" className="bk-field-error">
                  {errors.cpf.message}
                </span>
              ) : (
                <span id="booking-cpf-help" className="bk-field-help">
                  Vai só para o Asaas emitir o Pix. Não fica salvo aqui.
                </span>
              )}
            </label>
          </div>
        )}
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
          {deposit > 0
            ? `Reservar e pagar ${money(deposit)}`
            : "Confirmar agendamento"}
        </BusyButton>
        <p className="bk-safe">
          <LockSimple weight="duotone" size={14} /> Seus dados são usados só
          para este agendamento.{" "}
          <a href="/privacidade" target="_blank" rel="noreferrer">
            Privacidade
          </a>
        </p>
      </form>
    </section>
  );
}
