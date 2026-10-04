"use client";

import { BellRinging, CheckCircle, User } from "@phosphor-icons/react/dist/ssr";
import { useState, type FormEvent } from "react";
import { WhatsAppIcon } from "@/components/brand-icons";
import { BusyButton } from "@/features/public/public-ui";
import { publicRequest } from "@/features/public/use-public-catalog";
import type { WaitlistPeriod } from "@/types";
import { phoneMask, validBrazilianPhone } from "./customer-step";

const periods: { value: WaitlistPeriod; label: string }[] = [
  { value: "any", label: "Qualquer hora" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
];

function rememberedCustomer() {
  try {
    const value = JSON.parse(
      localStorage.getItem("studioflow:customer") || "null",
    );
    return {
      name: typeof value?.name === "string" ? value.name : "",
      phone: typeof value?.phone === "string" ? value.phone : "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

/** Joins the waitlist for one day; the business calls back on WhatsApp. */
export function WaitlistForm({
  slug,
  serviceId,
  professionalId,
  date,
  dateLabel,
  full,
}: {
  slug: string;
  serviceId: string;
  professionalId: string;
  date: string;
  dateLabel: string;
  /** The day has no free time at all. */
  full: boolean;
}) {
  const [open, setOpen] = useState(full);
  const [initial] = useState(rememberedCustomer);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [period, setPeriod] = useState<WaitlistPeriod>("any");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (!validBrazilianPhone(phone))
      return setError("Informe um WhatsApp válido com DDD.");
    setBusy(true);
    setError("");
    try {
      await publicRequest(`/api/public/${encodeURIComponent(slug)}/waitlist`, {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          professionalId,
          date,
          period,
          name: name.trim(),
          phone,
        }),
      });
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível entrar na lista de espera.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="bk-waitlist is-done" role="status">
        <CheckCircle weight="fill" size={26} />
        <strong>Você está na lista de espera</strong>
        <p>
          Se abrir um horário em {dateLabel}, o estabelecimento te chama no
          WhatsApp.
        </p>
      </div>
    );
  if (!open)
    return (
      <button
        type="button"
        className="bk-waitlist-link"
        onClick={() => setOpen(true)}
      >
        <BellRinging weight="duotone" size={17} /> Nenhum horário serve? Entre
        na lista de espera
      </button>
    );
  return (
    <form className="bk-waitlist" onSubmit={submit} noValidate>
      <span className="bk-waitlist-icon" aria-hidden="true">
        <BellRinging weight="duotone" size={22} />
      </span>
      <strong>{full ? "Dia lotado" : "Lista de espera"}</strong>
      <p>
        Deixe seu contato. Se alguém desmarcar em {dateLabel}, você é avisado
        pelo WhatsApp.
      </p>
      <div className="bk-waitlist-periods" role="group" aria-label="Período">
        {periods.map((item) => (
          <button
            key={item.value}
            type="button"
            className={period === item.value ? "is-active" : ""}
            aria-pressed={period === item.value}
            onClick={() => setPeriod(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="bk-waitlist-field">
        <span className="bk-label">Seu nome</span>
        <span className="bk-input">
          <User weight="duotone" size={18} />
          <input
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Como você se chama?"
          />
        </span>
      </label>
      <label className="bk-waitlist-field">
        <span className="bk-label">WhatsApp</span>
        <span className="bk-input">
          <WhatsAppIcon size={18} />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={phone}
            onChange={(event) => setPhone(phoneMask(event.target.value))}
            placeholder="(11) 99999-9999"
          />
        </span>
      </label>
      {error && (
        <div className="bk-alert" role="alert">
          <p>{error}</p>
        </div>
      )}
      <BusyButton type="submit" busy={busy} className="bk-primary">
        Entrar na lista de espera
      </BusyButton>
    </form>
  );
}
