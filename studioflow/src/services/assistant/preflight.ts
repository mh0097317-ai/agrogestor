import { hasModule } from "@/lib/modules";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getPublicStore } from "../server-store";
import { platformAiEnabled } from "../platform-ai-control";
import { readWhatsAppLink } from "../whatsapp/link";
import { evolutionReady } from "../whatsapp/evolution";
import { businessCreate } from "./provider";
import { receptionistModel, receptionistV3 } from "./receptionist";

/*
 * "Checar antes de apresentar": tudo o que precisa estar de pé para a
 * recepcionista responder um cliente agora, conferido de verdade (inclusive
 * uma chamada curtinha à IA com a chave da loja). Nada é enviado a ninguém.
 */

export interface PreflightItem {
  label: string;
  ok: boolean;
  note: string;
}

export async function receptionistPreflight(slug: string) {
  const store = await getPublicStore(slug);
  const id = store.business.id;
  const admin = createSupabaseAdmin();
  const items: PreflightItem[] = [];
  const add = (label: string, ok: boolean, note = "") =>
    items.push({ label, ok, note });

  add(
    "Chave geral da IA da plataforma",
    await platformAiEnabled(),
    "Ligada em /admin → Controles.",
  );
  add(
    "Recepcionista ligada na loja",
    store.settings.assistantEnabled,
    "O dono liga em Recepcionista → Permitir atendimento automático.",
  );
  add(
    "Módulo Recepcionista no plano",
    hasModule(store.access?.modules, "recepcionista"),
  );
  add(
    "Motor novo (v3) respondendo no WhatsApp",
    receptionistV3(false),
    "STUDIOFLOW_ASSISTANT_ENGINE=v3 na Vercel.",
  );
  const link = await readWhatsAppLink(id);
  add(
    "WhatsApp da loja conectado",
    link?.status === "open" && (await evolutionReady()),
    link?.status === "open"
      ? ""
      : "Leia o QR Code em Configurações → WhatsApp.",
  );

  const create = await businessCreate(id, receptionistModel);
  if (!create) add("Chave de IA da loja", false, "Nenhuma chave configurada.");
  else {
    const started = Date.now();
    const answer = await create({
      model: receptionistModel,
      max_tokens: 16,
      messages: [{ role: "user", content: "Responda só: ok" }],
    }).then(
      () => "",
      (error: unknown) =>
        error && typeof error === "object" && "status" in error
          ? `A IA recusou (código ${String(error.status)}).`
          : "A IA não respondeu.",
    );
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    add(
      "Chave de IA da loja respondendo",
      !answer,
      answer || `Respondeu em ${seconds}s.`,
    );
  }

  const day = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: run }, { count: errors }, { count: waiting }] =
    await Promise.all([
      admin
        .from("assistant_eval_runs")
        .select("passed,total,created_at")
        .eq("business_id", id)
        .gt("total", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("app_errors")
        .select("id", { count: "exact", head: true })
        .eq("business_id", id)
        .gte("created_at", day),
      admin
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", id)
        .eq("status", "human")
        .gt("unread", 0),
    ]);
  add(
    "Último teste das conversas",
    !!run && run.passed === run.total,
    run
      ? `${run.passed} de ${run.total} em ${new Date(run.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
      : 'Rode "Rodar teste" acima.',
  );
  add(
    "Sem erros nas últimas 24 horas",
    !errors,
    errors ? `${errors} erro(s); veja a lista abaixo.` : "",
  );
  add(
    "Nenhuma conversa parada com a equipe",
    !waiting,
    waiting
      ? `${waiting} conversa(s) com a equipe e mensagem não lida. A recepcionista não responde conversa que está com a equipe.`
      : "",
  );
  return { ok: items.every((i) => i.ok), items };
}
