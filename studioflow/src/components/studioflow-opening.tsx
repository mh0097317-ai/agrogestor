import { BrandLogo } from "./brand";
import { openingSessionKey } from "@/lib/booking-intro-visit";
import "./studioflow-opening.css";

/** A lightweight signature, layered over the establishment's original opening. */
export function StudioFlowOpening() {
  return (
    <>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `try{sessionStorage.getItem("${openingSessionKey}")&&document.documentElement.setAttribute("data-sf-signature-seen","")}catch(e){}`,
        }}
      />
      <div className="sf-signature" aria-hidden="true">
        <div className="sf-signature-body">
          <span className="sf-signature-kicker">Seu tempo, bem cuidado.</span>
          <BrandLogo size={86} className="sf-signature-mark" />
          <span className="sf-signature-name">
            Studio<i>Flow</i>
            <span className="sf-signature-dot">.</span>
          </span>
          <span className="sf-signature-line" />
          <span className="sf-signature-caption">
            Seu próximo momento começa aqui
          </span>
        </div>
      </div>
    </>
  );
}
