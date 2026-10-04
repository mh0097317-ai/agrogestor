import type {
  Appointment,
  Business,
  Professional,
  Service,
  Settings,
} from "@/types";
import type { RatingSummary } from "@/lib/reviews";
/** Average of real customer reviews; absent until someone reviews. */
export type Rating = RatingSummary;
export type PublicProfessional = Pick<
  Professional,
  "id" | "businessId" | "name" | "photo" | "specialties" | "active"
> & { rating?: Rating };

export interface PublicCatalog {
  business: Business;
  services: Service[];
  professionals: PublicProfessional[];
  settings: Settings;
  rating?: Rating;
}

export interface CustomerReview {
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ManagedBooking {
  appointment: Appointment;
  business: Business;
  services: Service[];
  professional: PublicProfessional;
  review?: CustomerReview | null;
}
