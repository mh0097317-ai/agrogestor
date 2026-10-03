"use client";

import { useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { storedImagePattern } from "@/lib/image";
import { SegmentIcon } from "@/lib/segments";
import { money } from "@/lib/utils";

type PreviewProps = {
  category: string;
  name: string;
  cover: string;
  services: { id: string; name: string; duration: string; price: string }[];
  professionals: string[];
  days: number[];
  start: string;
  end: string;
};

export function OnboardingPreview(props: PreviewProps) {
  const [failedCover, setFailedCover] = useState("");
  const services = props.services.filter((service) => service.name.trim());
  const professionals = props.professionals.filter((name) => name.trim());
  const hasCover =
    storedImagePattern.test(props.cover) && failedCover !== props.cover;

  return (
    <aside
      className="onboarding-preview"
      aria-label="Prévia do estabelecimento"
    >
      <span className="onboarding-step-label">PRÉVIA DA SUA PÁGINA</span>
      <p className="onboarding-preview-intro">É assim que o cliente vai ver.</p>
      <div className="onboarding-preview-page">
        <div className="onboarding-preview-cover">
          {hasCover ? (
            <img
              src={props.cover}
              alt="Capa do estabelecimento"
              onError={() => setFailedCover(props.cover)}
            />
          ) : (
            <SegmentIcon category={props.category} size={60} weight="thin" />
          )}
          <span>{props.category}</span>
        </div>
        <div className="onboarding-preview-body">
          <h2>{props.name.trim() || "Seu estabelecimento"}</h2>
          <p>Agende seu horário online.</p>
          <div className="onboarding-preview-cta">
            <CalendarBlank size={16} weight="duotone" /> Agendar horário
          </div>
          <h3>Serviços</h3>
          {services.length ? (
            services.slice(0, 3).map((service) => (
              <div className="onboarding-preview-service" key={service.id}>
                <div>
                  <strong>{service.name}</strong>
                  <span>{Number(service.duration) || 0} min</span>
                </div>
                <b>
                  {service.price && Number.isFinite(Number(service.price))
                    ? money(Number(service.price))
                    : "A definir"}
                </b>
              </div>
            ))
          ) : (
            <p className="onboarding-preview-empty">
              Os serviços cadastrados aparecerão aqui.
            </p>
          )}
          {professionals.length > 0 && (
            <>
              <h3>Quem vai cuidar de você</h3>
              <p>{professionals.join(" · ")}</p>
            </>
          )}
          <div className="onboarding-preview-hours">
            <CalendarBlank size={16} weight="duotone" />
            <span>
              {props.days.length} dias por semana · {props.start} às {props.end}
            </span>
          </div>
        </div>
      </div>
      <p className="onboarding-preview-note">
        Prévia ilustrativa com as informações que você preencheu. Você poderá
        ajustar cada detalhe depois.
      </p>
    </aside>
  );
}
