import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { matchesHash } from "../server-secrets";
import type { Store } from "@/types";
import { professionalStore, runTool } from "./agent";

// Each credential has a server-selected business and professional scope.
// Neither the model nor a customer's message can change that scope.
const integrationSchema = z
  .object({
    slug: z.string().min(1),
    businessId: z.string().min(1),
    professionalId: z.string().min(1).optional(),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type N8nIntegration = z.infer<typeof integrationSchema>;

export function n8nIntegration(
  token: string | null,
  configuration: string | undefined,
) {
  let integrations: N8nIntegration[];
  try {
    integrations = z
      .array(integrationSchema)
      .max(100)
      .parse(JSON.parse(configuration || "[]"));
  } catch {
    throw new DomainError("Integração indisponível.", 503);
  }
  const matches = integrations.filter((item) =>
    matchesHash(token, Buffer.from(item.tokenHash, "hex")),
  );
  if (matches.length !== 1)
    throw new DomainError("Integração não autorizada.", 401);
  return matches[0];
}

const ids = z.array(z.string().min(1).max(100)).min(1).max(5);
const period = z
  .enum(["all", "morning", "afternoon", "evening"])
  .default("all");
const professional = z.string().min(1).max(100).default("any");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const n8nConsultationSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("catalogo") }).strict(),
  z
    .object({
      acao: z.literal("horarios_livres"),
      servicos: ids,
      data: date,
      profissional: professional,
      periodo: period,
    })
    .strict(),
  z
    .object({
      acao: z.literal("dias_disponiveis"),
      servicos: ids,
      profissional: professional,
      periodo: period,
      excluir_data: date.or(z.literal("")).default(""),
    })
    .strict(),
  z
    .object({
      acao: z.literal("proximos_horarios"),
      servicos: ids,
      periodo: period,
    })
    .strict(),
]);

export async function n8nConsultation(
  input: z.infer<typeof n8nConsultationSchema>,
  integration: N8nIntegration,
  loadStore: () => Promise<Store>,
  now = new Date(),
) {
  const scopedStore = async () => {
    const store = await loadStore();
    if (
      store.business.id !== integration.businessId ||
      store.business.slug !== integration.slug
    )
      throw new DomainError("Integração não autorizada.", 403);
    if (!store.settings.assistantEnabled)
      throw new DomainError(
        "Atendimento automático desativado neste estabelecimento.",
        409,
      );
    return professionalStore(store, integration.professionalId);
  };
  // Validate tenant/access before delegating even a read-only tool.
  const store = await scopedStore();
  if (input.acao === "catalogo") {
    const professionals = store.professionals.filter(
      (p) => p.active && p.businessId === store.business.id,
    );
    return {
      consultado_em: now.toISOString(),
      fuso_horario: "America/Sao_Paulo",
      estabelecimento: {
        nome: store.business.name,
        descricao: store.business.description,
        endereco: store.business.address,
      },
      servicos: store.services
        .filter((s) => s.active && s.businessId === store.business.id)
        .map((s) => ({
          id: s.id,
          nome: s.name,
          descricao: s.description,
          preco: s.price,
          duracao_minutos: s.duration,
          profissionais: s.professionalIds.filter((id) =>
            professionals.some((p) => p.id === id),
          ),
        })),
      profissionais: professionals.map((p) => ({ id: p.id, nome: p.name })),
      funcionamento: {
        dias: store.settings.openDays,
        inicio: store.settings.openStart,
        fim: store.settings.openEnd,
      },
      aviso:
        "Funcionamento não significa disponibilidade. Consulte horários antes de oferecer ou reservar. Esta integração permite apenas consultas.",
    };
  }
  if (
    "profissional" in input &&
    input.profissional !== "any" &&
    !store.professionals.some((p) => p.id === input.profissional && p.active)
  )
    throw new DomainError("Profissional fora do escopo desta integração.", 400);
  const result = await runTool(
    input.acao,
    input,
    {
      channel: "whatsapp",
      professionalId: integration.professionalId,
      origin: "",
      payments: false,
      bookingAllowed: false,
      now,
      loadStore: async () => store,
      book: async () => {
        throw new DomainError("Reservas indisponíveis nesta integração.", 403);
      },
    },
    {},
  );
  if (result.isError) throw new DomainError(result.content, 400);
  let resultado: unknown;
  try {
    resultado = JSON.parse(result.content);
  } catch {
    resultado = result.content;
  }
  return {
    consultado_em: now.toISOString(),
    fuso_horario: "America/Sao_Paulo",
    resultado,
    reserva_realizada: false,
  };
}
