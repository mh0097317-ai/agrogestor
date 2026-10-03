export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
export type PaymentMethod = "pix" | "cash" | "credit" | "debit" | "other";
export interface Business {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  instagram: string;
  cover: string;
  logo?: string;
  color?: string;
  cnpj?: string;
  photos?: string[];
  amenities: string[];
}
export interface Service {
  id: string;
  businessId: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  image: string;
  active: boolean;
  professionalIds: string[];
}
export interface Professional {
  id: string;
  businessId: string;
  name: string;
  photo: string;
  phone: string;
  specialties: string[];
  commission: number;
  active: boolean;
  days: number[];
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
}
export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string;
  visits: number;
  totalSpent: number;
  lastVisit?: string;
  favoriteService?: string;
  favoriteProfessional?: string;
  returnInterval?: number;
  createdAt: string;
}
export interface Appointment {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceIds: string[];
  professionalId: string;
  start: string;
  end: string;
  price: number;
  status: AppointmentStatus;
  reminder: boolean;
  token?: string;
  createdAt: string;
}
export interface Payment {
  id: string;
  businessId: string;
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
}
export interface BlockedTime {
  id: string;
  businessId: string;
  professionalId: string;
  start: string;
  end: string;
  reason: string;
}
export interface Settings {
  businessId: string;
  minNotice: number;
  maxDays: number;
  buffer: number;
  cancellationHours: number;
  openDays: number[];
  openStart: string;
  openEnd: string;
  notifications: boolean;
}
export interface Store {
  business: Business;
  services: Service[];
  professionals: Professional[];
  customers: Customer[];
  appointments: Appointment[];
  payments: Payment[];
  blockedTimes: BlockedTime[];
  settings: Settings;
  viewer?: { name: string; role: string };
  mode?: "demo" | "live";
}
export interface Slot {
  time: string;
  professionalId: string;
  start: string;
  end: string;
}
