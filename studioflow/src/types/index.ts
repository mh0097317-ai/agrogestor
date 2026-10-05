import type { AccessEvent, AccessState, BusinessAccess } from "@/lib/access";
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
  /** Link do perfil no Google Maps; sem ele, o mapa usa o endereço. */
  mapsUrl?: string;
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
  /** Até mais duas fotos, além da principal (`image`). */
  photos?: string[];
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
  /** O cliente avisou que chegou (check-in pelo QR Code da recepção). */
  checkedInAt?: string | null;
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
export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  /** Custo de compra, opcional, para a margem. */
  cost?: number | null;
  stock: number;
  /** Abaixo disso aparece o alerta de estoque baixo. */
  minStock: number;
  image: string;
  /** Aparece na página do estabelecimento. */
  showPublic: boolean;
  active: boolean;
  createdAt: string;
}
export interface ProductSaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}
export interface ProductSale {
  id: string;
  businessId: string;
  appointmentId?: string | null;
  customerId?: string | null;
  customerName: string;
  items: ProductSaleItem[];
  total: number;
  method: PaymentMethod;
  status: "paid" | "cancelled";
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
  /** Loyalty card: every `loyaltyGoal` completed visits earn `loyaltyReward`. */
  loyaltyEnabled: boolean;
  loyaltyGoal: number;
  loyaltyReward: string;
  /** Pix deposit at booking: fixed value or percent of the price. */
  depositMode: DepositMode;
  depositValue: number;
  /** Minutes the slot waits for the Pix. */
  depositHold: number;
  /** WhatsApp para o profissional quando entra um agendamento. */
  notifyProfessionals?: boolean;
  /** AI receptionist (web chat and WhatsApp). */
  assistantEnabled: boolean;
  assistantName: string;
  assistantInstructions: string;
  assistantDailyLimit: number;
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
export type ConversationChannel = "web" | "whatsapp" | "instagram";
export type ConversationStatus = "ai" | "human" | "closed";
export interface ConversationMessage {
  id: string;
  role: "customer" | "assistant" | "staff" | "event";
  body: string;
  createdAt: string;
}
export interface ConversationSummary {
  id: string;
  channel: ConversationChannel;
  contactName: string;
  contactPhone: string;
  status: ConversationStatus;
  unread: number;
  lastMessageAt: string;
  preview?: string;
}
/** Demo only: the live database keeps these in their own tables. */
export interface DemoConversation extends ConversationSummary {
  tokenHash?: string;
  /** Instagram: id de quem escreveu. */
  contactRef?: string;
  history: unknown[];
  aiCursor: string;
  messages: ConversationMessage[];
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
  products?: Product[];
  productSales?: ProductSale[];
  paymentAccount?: PaymentAccount | null;
  demoCharges?: DemoCharge[];
  conversations?: DemoConversation[];
  /** WhatsApp connection (never the token). */
  whatsapp?: { displayPhone: string; phoneNumberId: string } | null;
  /** Instagram Direct connection (never the token). */
  instagram?: { username: string; igUserId: string } | null;
  /** WhatsApp da loja conectado por QR Code (Evolution API do StudioFlow). */
  whatsappLink?: WhatsAppLink | null;
  /** O servidor tem a Evolution API configurada. */
  evolutionReady?: boolean;
  /** Demonstração: mensagens que sairiam pelo WhatsApp. */
  outbox?: { to: string; body: string; kind: string; at: string }[];
  /** Conta que mostra os posts na página (dela mesma ou da recepcionista). */
  instagramFeed?: { username: string; source: "page" | "assistant" } | null;
  /** Áudios do WhatsApp/Instagram viram texto (serviço de transcrição configurado). */
  transcriptionReady?: boolean;
  /** The server has Claude credentials for the AI receptionist. */
  aiReady?: boolean;
  viewer?: { name: string; role: string; platformAdmin?: boolean };
  mode?: "demo" | "live";
  /** Liberação pela equipe StudioFlow (no modo demonstração, guardada no arquivo). */
  access?: BusinessAccess & { state?: AccessState };
  /** Histórico de liberações no modo demonstração. */
  accessEvents?: AccessEvent[];
}
export interface WhatsAppLink {
  status: "connecting" | "open" | "close";
  phone: string;
  profileName: string;
}
export interface Slot {
  time: string;
  professionalId: string;
  start: string;
  end: string;
}
