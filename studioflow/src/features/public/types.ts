import type {
  Appointment,
  Business,
  Professional,
  Service,
  Settings,
} from "@/types";
export type PublicProfessional = Pick<
  Professional,
  "id" | "businessId" | "name" | "photo" | "specialties" | "active"
>;

export interface PublicCatalog {
  business: Business;
  services: Service[];
  professionals: PublicProfessional[];
  settings: Settings;
}

export interface ManagedBooking {
  appointment: Appointment;
  business: Business;
  services: Service[];
  professional: PublicProfessional;
}
