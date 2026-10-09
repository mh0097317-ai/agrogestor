import { z } from "zod";
import { requireModule } from "@/services/modules-guard";
import {
  contactSyncSchema,
  listWhatsAppContacts,
  openWhatsAppContact,
  syncWhatsAppContacts,
} from "@/services/whatsapp/contacts";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    await requireModule("recepcionista");
    const url = new URL(request.url);
    return respond(
      await listWhatsAppContacts({
        professionalId: url.searchParams.get("professionalId")
          ? z.string().uuid().parse(url.searchParams.get("professionalId"))
          : undefined,
        offset: z.coerce
          .number()
          .int()
          .min(0)
          .max(250000)
          .parse(url.searchParams.get("offset") || 0),
        search: (url.searchParams.get("search") || "").slice(0, 100),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireModule("recepcionista");
    assertSameOrigin(request);
    const input = z
      .object({
        action: z.enum(["open"]).optional(),
        id: z.string().uuid().optional(),
        professionalId: z.string().uuid().optional(),
        page: z.number().optional(),
      })
      .parse(await request.json());
    if (input.action === "open")
      return respond(
        await openWhatsAppContact(z.string().uuid().parse(input.id)),
      );
    return respond(await syncWhatsAppContacts(contactSyncSchema.parse(input)));
  } catch (error) {
    return failure(error);
  }
}
