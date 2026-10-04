import { DomainError } from "@/lib/availability";

export type AsaasEnvironment = "sandbox" | "production";

const baseUrl: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

/** Payment statuses that mean the money arrived. */
export const paidStatuses = new Set([
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);

export interface ProviderPayment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  subscription?: string | null;
  externalReference?: string | null;
}
export interface PixCode {
  /** PNG, base64 without the data: prefix. */
  image: string;
  /** Pix "copia e cola". */
  payload: string;
  expiresAt?: string;
}
export interface CustomerInput {
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  reference: string;
}

/** Minimal Asaas v3 client used with each business's own API key. */
export class AsaasClient {
  constructor(
    private readonly apiKey: string,
    readonly environment: AsaasEnvironment,
  ) {}

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl[this.environment]}${path}`, {
        method: init.method || "GET",
        headers: {
          access_token: this.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "StudioFlow",
        },
        // The Pix QR endpoint refuses a GET with a body.
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new DomainError(
        "O Asaas não respondeu. Tente novamente em instantes.",
        502,
      );
    }
    if (response.status === 401)
      throw new DomainError(
        "A chave do Asaas foi recusada. Confira se copiou a chave completa e o ambiente certo.",
        400,
      );
    const data = (await response.json().catch(() => ({}))) as {
      errors?: { description?: string }[];
    };
    if (!response.ok) {
      const detail = data.errors?.[0]?.description;
      throw new DomainError(
        detail ? `Asaas: ${detail}` : "O Asaas recusou a operação.",
        response.status >= 500 ? 502 : 400,
      );
    }
    return data as T;
  }

  /** Any authenticated read proves the key and the environment. */
  async check() {
    await this.request("/customers?limit=1");
  }

  async findOrCreateCustomer(input: CustomerInput) {
    const found = await this.request<{ data: { id: string }[] }>(
      `/customers?cpfCnpj=${encodeURIComponent(input.cpf)}&limit=1`,
    );
    if (found.data?.[0]?.id) return found.data[0].id;
    const created = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: {
        name: input.name,
        cpfCnpj: input.cpf,
        mobilePhone: input.phone,
        email: input.email || undefined,
        externalReference: input.reference,
      },
    });
    return created.id;
  }

  createPixCharge(input: {
    customer: string;
    value: number;
    dueDate: string;
    description: string;
    reference: string;
  }) {
    return this.request<ProviderPayment>("/payments", {
      method: "POST",
      body: {
        customer: input.customer,
        billingType: "PIX",
        value: input.value,
        dueDate: input.dueDate,
        description: input.description.slice(0, 500),
        externalReference: input.reference,
      },
    });
  }

  async pixCode(paymentId: string): Promise<PixCode> {
    const data = await this.request<{
      encodedImage: string;
      payload: string;
      expirationDate?: string;
    }>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
    return {
      image: data.encodedImage,
      payload: data.payload,
      expiresAt: data.expirationDate,
    };
  }

  payment(paymentId: string) {
    return this.request<ProviderPayment>(
      `/payments/${encodeURIComponent(paymentId)}`,
    );
  }

  async deletePayment(paymentId: string) {
    await this.request(`/payments/${encodeURIComponent(paymentId)}`, {
      method: "DELETE",
    });
  }

  /** Monthly subscription; the customer picks Pix, boleto or card on the invoice. */
  createSubscription(input: {
    customer: string;
    value: number;
    nextDueDate: string;
    description: string;
    reference: string;
  }) {
    return this.request<{ id: string; status: string; nextDueDate: string }>(
      "/subscriptions",
      {
        method: "POST",
        body: {
          customer: input.customer,
          billingType: "UNDEFINED",
          cycle: "MONTHLY",
          value: input.value,
          nextDueDate: input.nextDueDate,
          description: input.description.slice(0, 500),
          externalReference: input.reference,
        },
      },
    );
  }

  async subscriptionPayments(subscriptionId: string) {
    const data = await this.request<{ data: ProviderPayment[] }>(
      `/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=20`,
    );
    return data.data || [];
  }

  async cancelSubscription(subscriptionId: string) {
    await this.request(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
    });
  }

  async createWebhook(input: { url: string; email: string; token: string }) {
    const data = await this.request<{ id: string }>("/webhooks", {
      method: "POST",
      body: {
        name: "StudioFlow",
        url: input.url,
        email: input.email,
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken: input.token,
        sendType: "SEQUENTIALLY",
        events: [
          "PAYMENT_CREATED",
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
          "PAYMENT_OVERDUE",
          "PAYMENT_DELETED",
          "PAYMENT_REFUNDED",
        ],
      },
    });
    return data.id;
  }

  async deleteWebhook(webhookId: string) {
    await this.request(`/webhooks/${encodeURIComponent(webhookId)}`, {
      method: "DELETE",
    });
  }
}
