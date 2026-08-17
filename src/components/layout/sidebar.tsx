"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS } from "./nav-items";
import { logoutAction } from "@/modules/auth/actions";

export function Sidebar({ nome, perfil }: { nome: string; perfil: string }) {
  const pathname = usePathname();
  const iniciais = nome.trim().charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] flex-col gap-1.5 bg-navy-900 p-[14px_14px] lg:flex">
      <div className="px-2 pb-4 pt-1.5">
        <Logo />
      </div>

      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const emBreve = Boolean(item.fase);
          return (
            <Link
              key={item.href}
              href={emBreve ? "#" : item.href}
              aria-disabled={emBreve}
              className={cn(
                "flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-primary-500 text-white shadow-[0_6px_16px_rgba(22,163,74,.3)]"
                  : "text-[#AFC4D4] hover:bg-navy-800 hover:text-white",
                emBreve && "cursor-default opacity-55 hover:bg-transparent hover:text-[#AFC4D4]",
              )}
              onClick={emBreve ? (e) => e.preventDefault() : undefined}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {emBreve && (
                <span className="rounded-full bg-navy-800 px-1.5 py-0.5 text-[9.5px] font-semibold text-[#6E8AA0]">
                  em breve
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/10 pt-3">
        <Link
          href="/configuracoes"
          className="flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-[13.5px] font-medium text-[#AFC4D4] transition-colors hover:bg-navy-800 hover:text-white"
        >
          <Settings size={18} />
          Configurações
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-[13.5px] font-medium text-[#AFC4D4] transition-colors hover:bg-navy-800 hover:text-white cursor-pointer"
          >
            <LogOut size={18} />
            Sair
          </button>
        </form>
        <div className="mt-1 flex items-center gap-2.5 rounded-[10px] px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2C7A4B] to-primary-500 text-[13px] font-bold text-white">
            {iniciais}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">{nome}</div>
            <div className="text-[11.5px] capitalize text-[#6E8AA0]">{perfil.toLowerCase()}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
