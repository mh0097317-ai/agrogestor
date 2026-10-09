import { randomBytes } from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { DomainError } from "@/lib/availability";
import {
  createSupabaseAdmin,
  createSupabaseServer,
  requireMembership,
} from "@/lib/supabase/server";
import { sha256 } from "./server-secrets";
import { isDemo } from "./server-demo";

export const professionalInviteSchema = z.object({
  professionalId: z.string().uuid(),
  email: z.email().trim().max(254),
});
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const hash = (token: string) => `\\x${sha256(token).toString("hex")}`;
export async function createProfessionalInvite(
  input: z.infer<typeof professionalInviteSchema>,
  origin: string,
) {
  if (isDemo())
    throw new DomainError("Crie acessos reais no ambiente publicado.", 409);
  const member = await requireMembership();
  if (!["owner", "admin", "manager"].includes(member.role))
    throw new DomainError("Só o responsável pela barbearia cria acessos.", 403);
  const token = randomBytes(32).toString("base64url");
  const { error } = await createSupabaseAdmin().rpc(
    "create_professional_invite",
    {
      p_business: member.businessId,
      p_professional: input.professionalId,
      p_actor: member.user.id,
      p_email: input.email,
      p_hash: hash(token),
    },
  );
  if (error)
    throw new DomainError(
      error.message === "already-linked"
        ? "Este profissional já possui um acesso vinculado."
        : "Não foi possível criar o convite. Confira o profissional e tente novamente.",
      409,
    );
  return { url: `${origin}/equipe/convite/${token}`, expiresInDays: 7 };
}
export async function professionalInviteView(token: string) {
  const admin = createSupabaseAdmin();
  const { data: invite, error } = await admin
    .from("professional_access_invites")
    .select("business_id,professional_id,expires_at,accepted_at")
    .eq("token_hash", hash(inviteTokenSchema.parse(token)))
    .maybeSingle();
  if (error)
    throw new DomainError("Não foi possível consultar o convite.", 503);
  if (
    !invite ||
    invite.accepted_at ||
    Date.parse(invite.expires_at) <= Date.now()
  )
    return null;
  const [business, person] = await Promise.all([
    admin
      .from("businesses")
      .select("name")
      .eq("id", invite.business_id)
      .maybeSingle(),
    admin
      .from("professionals")
      .select("name")
      .eq("business_id", invite.business_id)
      .eq("id", invite.professional_id)
      .eq("active", true)
      .maybeSingle(),
  ]);
  if (business.error || person.error)
    throw new DomainError("Não foi possível consultar o convite.", 503);
  return business.data && person.data
    ? {
        businessName: business.data.name as string,
        professionalName: person.data.name as string,
      }
    : null;
}
export async function acceptProfessionalInvite(token: string) {
  const client = await createSupabaseServer();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user)
    throw new DomainError(
      "Entre com sua própria conta antes de aceitar o convite.",
      401,
    );
  const { data: businessId, error } = await createSupabaseAdmin().rpc(
    "accept_professional_invite",
    {
      p_hash: hash(inviteTokenSchema.parse(token)),
      p_user: user.id,
      p_email: user.email || "",
      p_confirmed: !!user.email_confirmed_at,
    },
  );
  if (error) {
    const errors: Record<string, string> = {
      "wrong-account":
        "Entre com o e-mail indicado pelo responsável no convite e confirme essa conta.",
      "existing-team-account":
        "Esta conta já pertence à gerência. Use a conta individual do profissional.",
      "already-linked":
        "O profissional ou esta conta já possui um acesso vinculado.",
      "invalid-invite":
        "Este convite expirou ou já foi utilizado. Peça um novo ao responsável.",
    };
    throw new DomainError(
      errors[error.message] || "Não foi possível aceitar o convite.",
      409,
    );
  }
  (await cookies()).set("studioflow-business", businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}
