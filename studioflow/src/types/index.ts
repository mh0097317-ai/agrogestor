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
  /** Pix deposit held at booking; `expired` frees the slot. */
  depositAmount?: number | null;
  depositStatus?: DepositStatus | null;
  depositChargeId?: string | null;
  depositExpiresAt?: string | null;
  /** Booked through the club: price 0, counted in the plan's month. */
  membershipId?: string | null;
}
export type DepositStatus = "pending" | "paid" | "expired";
export type DepositMode = "off" | "fixed" | "percent";
export interface Payment {
  id: string;
  businessId: string;
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  /** Set when the payment came from the provider (Pix deposit). */
  providerChargeId?: string | null;
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
  /** Loyalty card: every `loyaltyGoal` completed visits earn `loyaltyReward`. */
  loyaltyEnabled: boolean;
  loyaltyGoal: number;
  loyaltyReward: string;
  /** Pix deposit at booking: fixed value or percent of the price. */
  depositMode: DepositMode;
  depositValue: number;
  /** Minutes the slot waits for the Pix. */
  depositHold: number;
}
export interface MembershipPlan {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  serviceIds: string[];
  /** Visits per month; null means unlimited. */
  monthlyLimit: number | null;
  active: boolean;
  createdAt: string;
}
export type MembershipStatus = "pending" | "active" | "overdue" | "cancelled";
export interface Membership {
  id: string;
  businessId: string;
  planId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  price: number;
  status: MembershipStatus;
  providerSubscriptionId?: string | null;
  invoiceUrl?: string | null;
  nextDueDate?: string | null;
  createdAt: string;
  /** Demo only: the live database keeps just the hash. */
  token?: string;
}
/** Connection to the business's own payment account (never the key). */
export interface PaymentAccount {
  provider: "asaas";
  environment: "sandbox" | "production" | "demo";
  hint: string;
  webhook: boolean;
  createdAt: string;
}
/** Demo only: simulated provider charges. */
export interface DemoCharge {
  id: string;
  kind: "deposit" | "membership";
  value: number;
  status: "PENDING" | "RECEIVED" | "OVERDUE";
  reference: string;
  createdAt: string;
}
export type WaitlistPeriod = "any" | "morning" | "afternoon" | "evening";
export interface WaitlistEntry {
  id: string;
  businessId: string;
  serviceId: string;
  professionalId?: string | null;
  /** yyyy-MM-dd, business day. */
  desiredDate: string;
  period: WaitlistPeriod;
  customerName: string;
  customerPhone: string;
  status: "waiting" | "notified";
  createdAt: string;
}
export interface Review {
  id: string;
  businessId: string;
  appointmentId: string;
  professionalId: string;
  /** First name only. */
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
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
  /** Customer reviews of completed appointments. */
  reviews?: Review[];
  /** Customers waiting for a spot on a full day. */
  waitlist?: WaitlistEntry[];
  plans?: MembershipPlan[];
  memberships?: Membership[];
  paymentAccount?: PaymentAccount | null;
  demoCharges?: DemoCharge[];
  viewer?: { name: string; role: string };
  mode?: "demo" | "live";
}
export interface Slot {
  time: string;
  professionalId: string;
  start: string;
  end: string;
}
