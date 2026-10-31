import type { ConversationMessage, Store } from "@/types";
import { exactPriceSelection } from "./routine-reply";

// Customers often split one request over a few quick messages.
export const whatsappBurstDelayMs = 1500;
/** A person who wrote in the chat keeps it for this long. */
export const manualPauseMs = 30 * 60_000;

/** Only a fresh, exact catalog question may end a stale mirrored manual pause. */
export function idlePriceResumeCursor(input: {
  text: string;
  createdAt: string;
  messages: ConversationMessage[];
  store: Store;
  runState?: string;
  now?: number;
}) {
  const at = Date.parse(input.createdAt);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(at) || at > now || now - at > 120_000) return null;
  if (!exactPriceSelection(input.text, input.store)) return null;
  if (input.runState && !["SENT", "SILENT"].includes(input.runState))
    return null;
  const previous = input.messages
    .filter((m) => Date.parse(m.createdAt) < at)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const staff = previous.findLast((m) => m.role === "staff");
  if (!staff || at - Date.parse(staff.createdAt) < manualPauseMs) return null;
  // Explicit human takeover, booking trouble and uncertain delivery keep their
  // hold. An outgoing WhatsApp echo alone has no such control event.
  const control = previous.findLast((m) => m.role === "event");
  if (
    control &&
    ![
      "Conversa devolvida para a atendente virtual.",
      "Atendimento retomado após pausa manual para uma nova consulta de preço.",
    ].includes(control.body)
  )
    return null;
  // Exclude older personal traffic and handled requests from the pending turn.
  return new Date(at - 1).toISOString();
}
