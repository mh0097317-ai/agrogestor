import {
  platformLinkView,
  startPlatformLink,
  unlinkPlatform,
} from "@/services/whatsapp/platform";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** WhatsApp do StudioFlow (lembretes de mensalidade). Só a equipe. */
export async function GET() {
  try {
    return respond(await platformLinkView());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await startPlatformLink());
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await unlinkPlatform());
  } catch (error) {
    return failure(error);
  }
}
