import type { Store } from "@/types";
import { money } from "@/lib/utils";
import { activityWhen } from "./activity";

const verbs = { create: "Criou", update: "Editou", delete: "Removeu" } as const;
const statusWords: Record<string, string> = {
  confirmed: "Confirmou o agendamento",
  in_progress: "Iniciou o atendimento",
  completed: "Concluiu o atendimento",
  cancelled: "Cancelou o agendamento",
  no_show: "Marcou que o cliente faltou",
  pending: "Deixou o agendamento pendente",
};
const methods: Record<string, string> = { pix: "Pix", cash: "dinheiro", card: "cartão", credit: "crédito", debit: "débito" };
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Frase curta para a auditoria de cada mudança feita no painel. */
export function describeMutation(
  entity: string,
  action: "create" | "update" | "delete",
  data: Record<string, unknown>,
  store: Store,
): { action: string; detail: string } {
  const id = text(data.id);
  const verb = verbs[action];
  switch (entity) {
    case "services": {
      const name = text(data.name) || store.services.find((item) => item.id === id)?.name || "";
      const price = typeof data.price === "number" ? ` · ${money(data.price)}` : "";
      return { action: `${verb} o serviço`, detail: `${name}${price}`.trim() };
    }
    case "professionals": {
      const name = text(data.name) || store.professionals.find((item) => item.id === id)?.name || "";
      return { action: `${verb} profissional`, detail: name };
    }
    case "customers": {
      const name = text(data.name) || store.customers.find((item) => item.id === id)?.name || "";
      return { action: `${verb} cliente`, detail: name };
    }
    case "appointments": {
      const item = store.appointments.find((row) => row.id === id);
      const who = text(data.customerName) || item?.customerName || "";
      const when = text(data.start) || item?.start || "";
      const detail = [who, when ? activityWhen(when) : ""].filter(Boolean).join(" · ");
      if (action === "create") return { action: "Marcou um horário pelo painel", detail };
      if (action === "delete") return { action: "Apagou um agendamento", detail };
      const status = text(data.status);
      if (status && statusWords[status] && Object.keys(data).length <= 3) return { action: statusWords[status], detail };
      return { action: "Alterou um agendamento", detail };
    }
    case "blockedTimes": {
      const when = text(data.start);
      const reason = text(data.reason);
      return {
        action: action === "delete" ? "Liberou um horário bloqueado" : "Bloqueou horário",
        detail: [when ? activityWhen(when) : "", reason].filter(Boolean).join(" · "),
      };
    }
    case "payments": {
      const amount = typeof data.amount === "number" ? money(data.amount) : "";
      const method = methods[text(data.method)] || text(data.method);
      return {
        action: action === "delete" ? "Estornou um pagamento" : "Registrou pagamento",
        detail: [amount, method].filter(Boolean).join(" · "),
      };
    }
    case "business":
      return { action: "Alterou os dados da empresa", detail: Object.keys(data).filter((key) => key !== "id").slice(0, 6).join(", ") };
    case "settings":
      return { action: "Alterou as regras da agenda", detail: "" };
    default:
      return { action: `${verb} ${entity}`, detail: "" };
  }
}
