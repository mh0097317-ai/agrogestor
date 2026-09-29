"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Painel deslizante: bottom sheet no celular, gaveta lateral no desktop. */
export function Gaveta({
  aberta,
  aoFechar,
  titulo,
  children,
  largura = "max-w-md",
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: React.ReactNode;
  children: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-[surgir_.2s_ease-out] bg-ink/40 backdrop-blur-[2px]" onClick={aoFechar} />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-papel shadow-flutuante",
          "animate-[subir_.3s_cubic-bezier(.2,.8,.2,1)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:rounded-none sm:rounded-l-3xl sm:animate-[deslizar_.3s_cubic-bezier(.2,.8,.2,1)]",
          largura,
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-linha-forte sm:hidden" />
        <div className="flex items-center justify-between gap-4 border-b border-linha px-5 py-4">
          <div className="min-w-0 font-display text-lg font-bold text-ink">{titulo}</div>
          <button onClick={aoFechar} className="grid size-9 place-items-center rounded-full hover:bg-fundo" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
