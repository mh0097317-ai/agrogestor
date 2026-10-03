"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
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
    /^https?:\/\//.test(props.cover) && failedCover !== props.cover;

  return (
    <aside
      className="onboarding-preview"
      aria-label="Prévia do estabelecimento"
    >
      <span className="onboarding-step-label">UM PRIMEIRO OLHAR</span>
      <p className="onboarding-preview-intro">
        Seu espaço começa a ganhar forma.
      </p>
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
          <p>Um espaço para cuidar de você.</p>
          <div className="onboarding-preview-cta">
            <CalendarDays size={16} /> Agendar horário
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
            <CalendarDays size={16} />
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
