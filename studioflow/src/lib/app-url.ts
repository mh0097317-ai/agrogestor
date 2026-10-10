/** Endereço público do app, usado em links que saem por WhatsApp e e-mail. */
export const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL || "https://app.studioflowapp.tech"
).replace(/\/+$/, "");
