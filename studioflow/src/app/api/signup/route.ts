import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";
import { isDemo } from "@/services/server-demo";

/*
 * Conta do dono sem esperar e-mail de confirmação: o e-mail padrão do
 * Supabase é lento e limitado a poucos envios por hora, e o dono desistia
 * no meio. A conta já nasce confirmada e o navegador entra em seguida.
 * Convite de profissional continua pelo caminho com confirmação, porque
 * lá o e-mail confirmado é o que prova quem está aceitando.
 */
const schema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(100),
    email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
    password: z
      .string()
      .min(8, "Escolha uma senha com 8 ou mais caracteres.")
      .max(72, "Use uma senha de até 72 caracteres."),
  })
  .strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request, { scope: "signup", max: 5 });
    const input = schema.parse(await request.json());
    if (isDemo())
      throw new DomainError(
        "O cadastro de contas está desligado na demonstração.",
        409,
      );
    const { error } = await createSupabaseAdmin().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (error) {
      if (/already|exists|registered/i.test(error.message))
        throw new DomainError(
          "Já existe uma conta com esse e-mail. Entre ou crie uma nova senha.",
          409,
        );
      if (/password/i.test(error.message))
        throw new DomainError(
          "Escolha uma senha mais forte, com 8 ou mais caracteres.",
        );
      throw new DomainError(
        "Não foi possível criar sua conta agora. Tente de novo em instantes.",
        503,
      );
    }
    return respond({ ok: true }, 201);
  } catch (cause) {
    return failure(cause);
  }
}
