import { money } from "@/lib/utils";
import type { Store, ConversationMessage } from "@/types";
import type { Interpretation } from "./understanding";
import { offeredChoice } from "./offered-choice";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function productQuestion(text: string, store: Store) {
  const value = normalize(text.trim()).replace(/^cliente:\s*/, "");
  const names = (store.products || [])
    .filter(
      (p) => p.businessId === store.business.id && p.active && p.showPublic,
    )
    .map((p) => normalize(p.name));
  return (
    /^(?:(?:vc|voces|voce|a barbearia) )?(?:tem|temos|vende|vendem|vcs tem|quanto custa|qual (?:o )?(?:valor|preco)(?: d[oa])?)\b/.test(
      value,
    ) &&
    (/\b(?:produtos?|pomadas?|shampoo|condicionador|gel|oleo para barba)\b/.test(
      value,
    ) ||
      names.some((name) => value.includes(name)))
  );
}

/** Public inventory only. Product questions are commercial, even during a booking. */
export function productSelection(
  text: string,
  store: Store,
  recent: ConversationMessage[],
  at?: string,
): Interpretation | null {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^Cliente:\s*/i, "").trim())
    .filter(Boolean);
  if (!lines.length || !productQuestion(lines.at(-1)!, store)) return null;
  if (
    lines.slice(0, -1).some((line) => !offeredChoice(line, store, recent, at))
  )
    return null;
  return {
    intent: "INFORMATION",
    stage: "QUALIFYING",
    confidence: 1,
    serviceIds: [],
    professionalId: "",
    date: "",
    time: "",
    missing: [],
    nextAction: "ANSWER",
  };
}

export function productReply(
  text: string,
  store: Store,
  recent: ConversationMessage[],
  now = new Date(),
) {
  if (!productSelection(text, store, recent, now.toISOString())) return null;
  const value = normalize(text.split("\n").at(-1)!);
  const products = (store.products || []).filter(
    (p) =>
      p.businessId === store.business.id &&
      p.active &&
      p.showPublic &&
      p.stock > 0,
  );
  const named = products.filter((p) => value.includes(normalize(p.name)));
  const terms = ["pomada", "shampoo", "condicionador", "gel", "oleo"].filter(
    (term) => new RegExp(`\\b${term}s?\\b`).test(value),
  );
  const matches = named.length
    ? named
    : terms.length
      ? products.filter((p) =>
          terms.some((term) =>
            normalize(`${p.name} ${p.description}`).includes(term),
          ),
        )
      : products;
  let reply = matches.length
    ? `Temos sim! ${matches
        .slice(0, 3)
        .map((p) => `${p.name} por ${money(p.price)}`)
        .join(
          "; ",
        )}. ${matches.length > 3 ? "Tem outras opções também. " : ""}Você procura algo para modelar ou cuidar do cabelo?`
    : "Não encontrei esse produto disponível no nosso catálogo agora. A equipe pode conferir se há outras opções na barbearia.";
  // Keep a just-chosen slot visible without booking while a second question is answered.
  const lines = text
    .split("\n")
    .slice(0, -1)
    .map((line) => line.replace(/^Cliente:\s*/i, "").trim());
  let choice = lines
    .map((line) => offeredChoice(line, store, recent, now))
    .find(Boolean);
  if (!choice) {
    const index = recent.findLastIndex((m) => m.role === "customer");
    if (
      index >= 0 &&
      !recent
        .slice(index + 1)
        .some((m) => /confirmado|reservado|registrado/i.test(m.body))
    )
      choice = offeredChoice(
        recent[index].body,
        store,
        recent.slice(0, index),
        now,
      );
  }
  if (choice) {
    const service = store.services.find((s) => s.id === choice.serviceIds[0])!;
    reply = reply.replace(
      / Você procura algo para modelar ou cuidar do cabelo\?$/,
      "",
    );
    reply += ` Sobre o ${service.name}: posso confirmar em ${choice.date.split("-").reverse().join("/")} às ${choice.time}?`;
  }
  return reply;
}
