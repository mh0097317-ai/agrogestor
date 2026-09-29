import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/utils";
import { TIPOS_NEGOCIO } from "@/lib/tipos-negocio";
import { exigirSessao } from "@/modules/auth/guard";
import { Avatar, Logo } from "@/components/ui";
import { BarraInferior, MenuLateral } from "@/components/painel/navegacao";
import { CopiarLink } from "@/components/painel/copiar-link";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { sessao, negocio } = await exigirSessao();
  const naoLidas = await prisma.notificacao.count({
    where: { negocioId: negocio.id, canal: "PAINEL", lida: false },
  });
  const link = `${appUrl()}/${negocio.slug}`;

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink p-4 lg:flex">
        <Link href="/painel" className="px-2 py-2">
          <Logo claro />
        </Link>
        <div className="mt-5 rounded-2xl bg-white/5 p-3">
          <p className="truncate font-display font-bold text-white">{negocio.nome}</p>
          <p className="text-xs text-white/50">{TIPOS_NEGOCIO[negocio.tipo].rotulo}</p>
          <div className="mt-3 flex gap-1.5">
            <CopiarLink url={link} rotulo="Copiar link" className="flex-1 justify-center rounded-lg bg-white/10 py-1.5 text-xs text-white hover:bg-white/15" />
            <a href={`/${negocio.slug}`} target="_blank" className="grid place-items-center rounded-lg bg-white/10 px-2.5 text-white hover:bg-white/15" aria-label="Abrir minha página">
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
        <div className="mt-6 flex-1">
          <MenuLateral naoLidas={naoLidas} />
        </div>
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar nome={sessao.nome} cor={negocio.corPrimaria} tamanho={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{sessao.nome}</p>
            <p className="truncate text-xs text-white/50">{sessao.email}</p>
          </div>
          <a href="/sair" className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Sair">
            <LogOut className="size-4" />
          </a>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-linha bg-fundo/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <a href={`/${negocio.slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-papel px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
          Minha página <ExternalLink className="size-3.5" />
        </a>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</div>
      <BarraInferior naoLidas={naoLidas} />
    </div>
  );
}
