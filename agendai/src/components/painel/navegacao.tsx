"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, Scissors, Settings, Users, UserSquare2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const ITENS = [
  { href: "/painel", rotulo: "Início", icone: Home },
  { href: "/painel/agenda", rotulo: "Agenda", icone: CalendarDays },
  { href: "/painel/clientes", rotulo: "Clientes", icone: Users },
  { href: "/painel/servicos", rotulo: "Serviços", icone: Scissors },
  { href: "/painel/equipe", rotulo: "Equipe", icone: UserSquare2 },
  { href: "/painel/avisos", rotulo: "Avisos", icone: Bell },
  { href: "/painel/configuracoes", rotulo: "Ajustes", icone: Settings },
];

function ativo(pathname: string, href: string) {
  return href === "/painel" ? pathname === href : pathname.startsWith(href);
}

export function MenuLateral({ naoLidas }: { naoLidas: number }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {ITENS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
            ativo(pathname, i.href) ? "bg-white text-ink shadow-sm" : "text-white/60 hover:bg-white/5 hover:text-white",
          )}
        >
          <i.icone className="size-[18px]" />
          <span className="flex-1">{i.rotulo === "Ajustes" ? "Configurações" : i.rotulo}</span>
          {i.href === "/painel/avisos" && naoLidas > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-marca-500 px-1.5 text-[11px] font-bold text-white">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

const MOBILE = ["/painel", "/painel/agenda", "/painel/clientes", "/painel/avisos", "/painel/configuracoes"];

export function BarraInferior({ naoLidas }: { naoLidas: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {ITENS.filter((i) => MOBILE.includes(i.href)).map((i) => {
          const on = ativo(pathname, i.href);
          return (
            <Link key={i.href} href={i.href} className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", on ? "text-ink" : "text-apagado")}>
              <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", on && "bg-marca-50 text-marca-600")}>
                <i.icone className="size-5" />
              </span>
              {i.rotulo}
              {i.href === "/painel/avisos" && naoLidas > 0 && (
                <span className="absolute right-[calc(50%-20px)] top-1.5 size-2.5 rounded-full border-2 border-papel bg-marca-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function LinksExtrasMobile() {
  const pathname = usePathname();
  const extras = ITENS.filter((i) => !MOBILE.includes(i.href));
  if (!["/painel", "/painel/configuracoes"].includes(pathname)) return null;
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 lg:hidden">
      {extras.map((i) => (
        <Link key={i.href} href={i.href} className="flex items-center gap-2 rounded-xl border border-linha bg-papel px-3 py-2.5 text-sm font-semibold text-ink">
          <i.icone className="size-4 text-suave" /> {i.rotulo}
        </Link>
      ))}
    </div>
  );
}
