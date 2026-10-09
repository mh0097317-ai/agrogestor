/** PN JIDs are phone numbers. LIDs, groups and newsletters are not phone numbers. */
export function realWhatsAppContacts(rows: unknown[], ownPhone = "") {
  const contacts = new Map<string, { phone: string; name: string }>();
  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const match =
      typeof row.remoteJid === "string"
        ? /^(\d{10,15})@s\.whatsapp\.net$/.exec(row.remoteJid)
        : null;
    if (
      !match ||
      match[1] === ownPhone.replace(/\D/g, "") ||
      row.isGroup === true
    )
      continue;
    const name =
      typeof row.pushName === "string" ? row.pushName.trim().slice(0, 100) : "";
    const previous = contacts.get(match[1]);
    contacts.set(match[1], {
      phone: match[1],
      name: name || previous?.name || "",
    });
  }
  return [...contacts.values()];
}

export interface WhatsAppContact {
  id: string;
  professionalId: string | null;
  name: string;
  phone: string;
  syncedAt: string;
}

export function whatsappDestination(conversation: {
  contactPhone: string;
  contactRef?: string;
}) {
  const match = /^wa:(\d{10,15})$/.exec(conversation.contactRef || "");
  return match ? `+${match[1]}` : conversation.contactPhone;
}
