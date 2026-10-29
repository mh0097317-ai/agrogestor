import { requireMembership } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { assertPlatformAiEnabled } from "@/services/platform-ai-control";
import { businessCreate } from "@/services/assistant/provider";
import { getWorkspace } from "@/services/server-store";
import { isDemo } from "@/services/server-demo";
import {
  allowRate,
  assertSameOrigin,
  failure,
  respond,
} from "@/services/server-http";
import { improveShareCopy, shareCopySchema } from "@/services/share-copy";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (isDemo())
      throw new DomainError(
        "A revisão com IA funciona no ambiente publicado.",
        409,
      );
    const member = await requireMembership();
    if (!["owner", "admin", "manager"].includes(member.role))
      throw new DomainError("Só a gestão pode gerar publicações com IA.", 403);
    await assertPlatformAiEnabled();
    const input = shareCopySchema.parse(await request.json());
    if (!allowRate(`share-copy:${member.businessId}`, 4))
      throw new DomainError(
        "Aguarde um minuto antes de gerar outra sugestão.",
        429,
      );
    const create = await businessCreate(member.businessId);
    if (!create)
      throw new DomainError(
        "Configure a credencial de IA do estabelecimento.",
        409,
      );
    const store = await getWorkspace();
    try {
      const draft = await improveShareCopy(input, store.business, create);
      await assertPlatformAiEnabled();
      return respond(draft);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "Não foi possível melhorar o texto. Confira a credencial e o saldo da IA.",
        502,
      );
    }
  } catch (error) {
    return failure(error);
  }
}
