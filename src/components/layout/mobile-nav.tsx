"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sprout, Wrench, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/safras", label: "Safras", icon: Sprout },
  { href: "/operacoes", label: "Operações", icon: Wrench },
  { href: "/configuracoes", label: "Mais", icon: Menu },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-surface/95 px-2 backdrop-blur lg:hidden">
      {ITEMS.slice(0, 2).map((it) => (
        <NavBtn key={it.href} {...it} active={pathname.startsWith(it.href)} />
      ))}

      <Link
        href="/operacoes"
        className="relative -mt-8 grid h-14 w-14 place-items-center rounded-full bg-primary-500 text-white shadow-[0_8px_20px_rgba(22,163,74,.4)] ring-4 ring-surface"
        aria-label="Nova operação"
      >
        <Plus size={26} />
      </Link>

      {ITEMS.slice(2).map((it) => (
        <NavBtn key={it.href} {...it} active={pathname.startsWith(it.href)} />
      ))}
    </nav>
  );
}

function NavBtn({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-16 flex-col items-center gap-1 text-[11px] font-medium",
        active ? "text-primary-600" : "text-subtle",
      )}
    >
      <Icon size={21} />
      {label}
    </Link>
  );
}
