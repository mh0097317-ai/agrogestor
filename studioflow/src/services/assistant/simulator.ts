import type Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage, Store } from "@/types";
import type { CreateMessage } from "./agent";
import type { BookingMenu } from "./booking-menu";
import { assistantMayAnswer } from "./contact-scope";
import {
  answerPending,
  simulatedToken,
  type Conversation,
  type ConversationRepo,
} from "./conversations";

type History = Anthropic.Beta.BetaMessageParam[];

export interface SimulatedReply {
  body: string;
  menu: BookingMenu | null;
}
export interface SimulatedTurn {
  /** What the customer would receive on WhatsApp, menus included. */
  replies: SimulatedReply[];
  /** Notes for the owner: why the receptionist stayed silent or handed off. */
  notes: string[];
  status: "ai" | "human";
  history: History;
  /** Every message of the test chat after this turn, to send back next time. */
  messages: ConversationMessage[];
}

const silentNote =
  "A recepcionista ficou em silêncio: no WhatsApp ela só responde mensagens sobre a barbearia (horários, preços, serviços).";

/**
 * One customer message through the same answer path as WhatsApp, in the
 * simulation mode of answerPending: nothing is sent and nothing is booked.
 * The caller keeps the transcript and history between turns.
 */
export async function simulateWhatsApp(input: {
  businessId: string;
  slug: string;
  origin: string;
  phone: string;
  name: string;
  text: string;
  messages: ConversationMessage[];
  history: History;
  create: CreateMessage | null;
  store: () => Promise<Store>;
  takeTurn: () => Promise<boolean>;
  addTokens: (input: number, output: number) => Promise<void>;
  now?: Date;
}): Promise<SimulatedTurn> {
  const previous = input.messages.slice(-60);
  let clock = Math.max(
    (input.now || new Date()).getTime(),
    ...previous.map((m) => Date.parse(m.createdAt) + 1000),
  );
  const tick = () => new Date((clock += 1000)).toISOString();
  const conversation: Conversation = {
    id: "simulacao",
    channel: "whatsapp",
    contactPhone: input.phone,
    contactName: input.name,
    status: "ai",
    unread: 0,
    history: input.history.slice(-40),
    aiCursor: previous.at(-1)?.createdAt || new Date(0).toISOString(),
  };
  const messages: ConversationMessage[] = [
    ...previous,
    {
      id: `cliente-${clock}`,
      role: "customer",
      body: input.text,
      createdAt: tick(),
    },
  ];
  const result = (notes: string[]): SimulatedTurn => ({
    replies,
    notes,
    status: conversation.status === "human" ? "human" : "ai",
    history: conversation.history as History,
    messages,
  });
  const replies: SimulatedReply[] = [];
  if (
    !(await assistantMayAnswer({
      text: input.text,
      store: input.store,
      messages: previous,
    }).catch(() => false))
  ) {
    return result([silentNote]);
  }
  const repo: ConversationRepo = {
    businessId: input.businessId,
    byToken: async () => null,
    byPhone: async () => null,
    byRef: async () => null,
    get: async () => structuredClone(conversation),
    create: async () => conversation,
    addMessage: async (_id, role, body) => {
      messages.push({ id: `${role}-${clock}`, role, body, createdAt: tick() });
      return true;
    },
    messages: async (_id, since) =>
      messages.filter((m) => !since || m.createdAt > since),
    lease: async () => true,
    release: async () => undefined,
    update: async (_id, patch) => {
      if (patch.history) conversation.history = patch.history;
      if (patch.aiCursor) conversation.aiCursor = patch.aiCursor;
      if (patch.status) conversation.status = patch.status;
    },
    takeTurn: input.takeTurn,
    addTokens: input.addTokens,
  };
  const before = messages.length;
  const receipt = `${input.origin}/booking/${simulatedToken}`;
  await answerPending(
    repo,
    conversation.id,
    {
      origin: input.origin,
      slug: input.slug,
      simulate: true,
      send: async (body, menu) => {
        replies.push({
          body: body.split(receipt).join("(link do comprovante)"),
          menu: menu || null,
        });
        return `simulacao-${replies.length}`;
      },
    },
    input.create,
  );
  // Stored replies carry the placeholder too, so the next turn reads the same text.
  for (const message of messages)
    if (message.role === "assistant")
      message.body = message.body.split(receipt).join("(link do comprovante)");
  const notes = messages
    .slice(before)
    .filter((m) => m.role === "event")
    .map((m) => m.body);
  if (!replies.length && !notes.length)
    notes.push(
      "A recepcionista não respondeu esta mensagem. No WhatsApp ela também ficaria em silêncio.",
    );
  return result(notes);
}
