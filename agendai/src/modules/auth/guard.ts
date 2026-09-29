import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lerSessao } from "./session";

/** Exige usuário logado e devolve sessão + negócio. Use em páginas e actions do painel. */
export const exigirSessao = cache(async () => {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  const negocio = await prisma.negocio.findUnique({ where: { id: sessao.negocioId } });
  if (!negocio) redirect("/sair");
  return { sessao, negocio };
});
