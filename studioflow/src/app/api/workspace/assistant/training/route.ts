import { requireMembership } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { assertModule } from "@/lib/modules";
import { assertPlatformAiEnabled } from "@/services/platform-ai-control";
import { isDemo } from "@/services/server-demo";
import { businessCreate } from "@/services/assistant/provider";
import { draftTraining, trainingSchema } from "@/services/assistant/training";
import {
  allowRate,
  assertSameOrigin,
  failure,
  respond,
} from "@/services/server-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (isDemo())
      throw new DomainError(
        "A ajuda com IA funciona no ambiente publicado.",
        409,
      );
    const { role, businessId, access } = await requireMembership();
    if (!["owner", "admin", "manager"].includes(role))
      throw new DomainError(
        "Só o responsável pode treinar o atendimento.",
        403,
      );
    assertModule(access.modules, "recepcionista");
    await assertPlatformAiEnabled();
    const input = trainingSchema.parse(await request.json());
    if (!allowRate(`assistant-training:${businessId}`, 4))
      throw new DomainError(
        "Aguarde um minuto antes de pedir outra sugestão.",
        429,
      );
    const create = await businessCreate(businessId);
    if (!create)
      throw new DomainError(
        "Configure a credencial do atendimento para usar a ajuda da IA.",
        409,
      );
    try {
      const result = await draftTraining(input, create);
      await assertPlatformAiEnabled();
      return respond(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "Não foi possível gerar a sugestão. Confira a credencial e o saldo da IA do atendimento.",
        502,
      );
    }
  } catch (error) {
    return failure(error);
  }
}
