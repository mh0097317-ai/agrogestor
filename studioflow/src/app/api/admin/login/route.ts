import { z } from "zod";
import { isPlatformAdmin } from "@/lib/supabase/server";
import { signInPlatform } from "@/lib/supabase/platform-auth";
import { createPlatformServer } from "@/services/server-platform-auth";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";

const schema = z
  .object({
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    password: z.string().min(1, "Informe sua senha.").max(1024),
  })
  .strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const input = schema.parse(await request.json());
    await signInPlatform(await createPlatformServer(), input, isPlatformAdmin);
    return respond({ ok: true });
  } catch (cause) {
    return failure(cause);
  }
}
