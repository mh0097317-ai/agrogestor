import { CalendarX } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { businessWhatsAppLink } from "@/lib/online-booking";
import { publicAccentStyle } from "./public-branding";
import type { Business } from "@/types";
import "./public.css";
import "./booking-unavailable.css";

export function BookingUnavailable({ business }: { business: Business }) {
  const whatsapp = businessWhatsAppLink(business.phone);
  return (
    <main
      className="public-site booking-unavailable"
      style={publicAccentStyle(business.color)}
    >
      <section
        className="booking-unavailable-card"
        aria-labelledby="booking-unavailable-title"
      >
        {business.logo && (
          <img
            src={business.logo}
            alt=""
            className="booking-unavailable-logo"
          />
        )}
        <p className="booking-unavailable-business">{business.name}</p>
        <CalendarX size={36} weight="light" aria-hidden="true" />
        <h1 id="booking-unavailable-title">
          Agendamento online indisponível no momento.
        </h1>
        <p>
          Entre em contato diretamente com o estabelecimento para realizar seu
          agendamento.
        </p>
        {whatsapp && (
          <a
            className="public-button"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon size={20} /> Falar pelo WhatsApp
          </a>
        )}
      </section>
    </main>
  );
}
