import Link from "next/link";
import { CalendarCheck2, MessageCircle, Smartphone } from "lucide-react";
import { Logo } from "@/components/ui";

export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col">
        <div className="grao absolute inset-0" />
        <div className="absolute -bottom-32 -left-24 size-[28rem] rounded-full bg-marca-500/40 blur-3xl" />
        <Link href="/" className="relative">
          <Logo claro />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-4xl font-extrabold leading-tight tracking-tight">
            Sua cadeira cheia.
            <br />
            <span className="text-marca-400">Seu WhatsApp em paz.</span>
          </p>
          <ul className="mt-8 space-y-4 text-white/80">
            <li className="flex gap-3">
              <Smartphone className="mt-0.5 size-5 shrink-0 text-marca-400" /> O cliente marca sozinho, pelo celular, 24h por dia.
            </li>
            <li className="flex gap-3">
              <MessageCircle className="mt-0.5 size-5 shrink-0 text-marca-400" /> Confirmação e lembrete automáticos no WhatsApp.
            </li>
            <li className="flex gap-3">
              <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-marca-400" /> Você recebe cada novo horário na hora.
            </li>
          </ul>
        </div>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
