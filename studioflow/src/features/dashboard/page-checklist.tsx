"use client";
import { onlineBookingEnabled } from "@/lib/online-booking";
import { OnlineBookingNotice } from "@/features/management/online-booking-settings";

import Link from "next/link";
import { ArrowRight, Check, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { Store } from "@/types";

interface Item {
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

/** What the public page still lacks, each with a link to where it is filled in. */
export function pageChecklist(data: Store): Item[] {
  const { business } = data;
  const active = data.services.filter((service) => service.active);
  const settings = "/dashboard/configuracoes";
  return [
    {
      label: "WhatsApp da loja",
      hint: "Vira o botão WhatsApp da página.",
      done: business.phone.replace(/\D/g, "").length >= 10,
      href: `${settings}?aba=business`,
    },
    {
      label: "Endereço",
      hint: "Abre o mapa e a rota no Google Maps e no Waze.",
      done: business.address.trim().length >= 8,
      href: `${settings}?aba=business`,
    },
    {
      label: "Instagram",
      hint: "Mostra seu perfil e seus posts dentro da página.",
      done: !!business.instagram.trim(),
      href: `${settings}?aba=business`,
    },
    {
      label: "Frase de apresentação",
      hint: "Uma linha embaixo do nome, do seu jeito.",
      done: !!business.description.trim(),
      href: `${settings}?aba=business`,
    },
    {
      label: "Foto de capa",
      hint: "A primeira coisa que o cliente vê.",
      done: !!business.cover,
      href: `${settings}?aba=identity`,
    },
    {
      label: "Logo",
      hint: "Aparece na abertura do agendamento e no comprovante.",
      done: !!business.logo,
      href: `${settings}?aba=identity`,
    },
    {
      label: "Fotos dos trabalhos",
      hint: "Cortes e ambiente: o que mais convence.",
      done: (business.photos?.length || 0) > 0,
      href: `${settings}?aba=identity`,
    },
    {
      label: "Fotos dos serviços",
      hint: "Até 3 por serviço, que o cliente passa com o dedo.",
      done: active.length > 0 && active.every((service) => !!service.image),
      href: "/dashboard/servicos",
    },
  ];
}

export function PageChecklist({ data }: { data: Store }) {
  if (!onlineBookingEnabled(data.settings)) return <OnlineBookingNotice />;
  const items = pageChecklist(data);
  const done = items.filter((item) => item.done).length;
  if (done === items.length) return null;
  const missing = items.filter((item) => !item.done);
  const score = Math.round((done / items.length) * 100);
  return (
    <section className="ov-card ov-checklist" aria-label="Complete sua página">
      <div className="ov-checklist-head">
        <span className="ov-checklist-icon" aria-hidden="true">
          <Sparkle size={18} weight="fill" />
        </span>
        <div>
          <strong>Complete sua página</strong>
          <span>
            Está <b>{score}%</b> pronta. Faltam {missing.length}{" "}
            {missing.length === 1 ? "detalhe" : "detalhes"} para o cliente ver
            tudo.
          </span>
        </div>
        <Link
          href={`/${data.business.slug}`}
          target="_blank"
          className="ov-checklist-view"
        >
          Ver página
        </Link>
      </div>
      <i className="ov-checklist-bar">
        <em style={{ width: `${score}%` }} />
      </i>
      <ul>
        {items.map((item) => (
          <li key={item.label} className={item.done ? "is-done" : ""}>
            {item.done ? (
              <span className="ov-checklist-row">
                <Check size={14} weight="bold" />
                <b>{item.label}</b>
              </span>
            ) : (
              <Link href={item.href} className="ov-checklist-row">
                <i aria-hidden="true" />
                <span>
                  <b>{item.label}</b>
                  <small>{item.hint}</small>
                </span>
                <ArrowRight size={15} weight="bold" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
