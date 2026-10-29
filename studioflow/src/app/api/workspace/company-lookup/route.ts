import { requireMembership } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import {
  normalizeCnpj,
  validCnpj,
  companyRegistry,
} from "@/lib/company-registry";
import { failure, respond, limitPublicMutation } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const member = await requireMembership();
    if (!["owner", "admin", "manager"].includes(member.role))
      throw new DomainError(
        "Seu perfil não pode consultar o cadastro da empresa.",
        403,
      );
    limitPublicMutation(request, { scope: "company-lookup", max: 15 });
    const id = normalizeCnpj(
      new URL(request.url).searchParams.get("cnpj") || "",
    );
    if (!validCnpj(id))
      throw new DomainError(
        "Confira os 14 caracteres e os dígitos verificadores do CNPJ.",
        400,
      );
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${id}`, {
      headers: { Accept: "application/json", "User-Agent": "StudioFlow/1.0" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      redirect: "error",
    }).catch(() => null);
    if (!response)
      throw new DomainError(
        "A consulta está indisponível. Você pode preencher os dados manualmente.",
        503,
      );
    if (response.status === 404)
      throw new DomainError(
        "CNPJ não encontrado na base consultada. Confira o número ou preencha manualmente.",
        404,
      );
    if (!response.ok)
      throw new DomainError(
        "A base cadastral não respondeu. Tente novamente mais tarde.",
        503,
      );
    const raw = await response.json().catch(() => {
      throw new DomainError(
        "A base cadastral não retornou uma resposta válida. Você pode preencher os dados manualmente.",
        503,
      );
    });
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new DomainError("A base devolveu dados inválidos.", 502);
    const company = companyRegistry(raw);
    if (company.cnpj !== id || !company.legalName)
      throw new DomainError("A base não confirmou este CNPJ.", 502);
    return respond(company);
  } catch (e) {
    return failure(e);
  }
}
