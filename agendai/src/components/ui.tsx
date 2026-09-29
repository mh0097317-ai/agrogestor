import { forwardRef } from "react";
import type { StatusAgendamento } from "@prisma/client";
import { cn, iniciais } from "@/lib/utils";

type Variante = "primario" | "escuro" | "secundario" | "fantasma" | "perigo";
type Tamanho = "sm" | "md" | "lg";

const variantes: Record<Variante, string> = {
  primario: "bg-marca-500 text-white hover:bg-marca-600 shadow-sm shadow-marca-500/20",
  escuro: "bg-ink text-white hover:bg-ink-2",
  secundario: "bg-papel text-ink border border-linha-forte hover:bg-papel-2 hover:border-apagado/50",
  fantasma: "text-texto hover:bg-ink/5",
  perigo: "bg-erro-bg text-erro hover:bg-erro hover:text-white",
};

const tamanhos: Record<Tamanho, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2 rounded-2xl",
};

export function classesBotao(variante: Variante = "primario", tamanho: Tamanho = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all [&_svg]:shrink-0 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
    variantes[variante],
    tamanhos[tamanho],
    extra,
  );
}

export const Botao = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: Tamanho }
>(function Botao({ variante, tamanho, className, ...props }, ref) {
  return <button ref={ref} className={classesBotao(variante, tamanho, className)} {...props} />;
});

const campoBase =
  "w-full rounded-xl border border-linha-forte bg-papel px-3.5 text-[15px] text-ink placeholder:text-apagado transition focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5";

export const Campo = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Campo(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(campoBase, "h-11", className)} {...props} />;
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AreaTexto({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(campoBase, "py-2.5 min-h-20 resize-y", className)} {...props} />;
  },
);

export const Selecao = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Selecao(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        campoBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236E6873%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    />
  );
});

export function Rotulo({ children, dica, htmlFor }: { children: React.ReactNode; dica?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
      <span>{children}</span>
      {dica && <span className="text-xs font-normal text-suave">{dica}</span>}
    </label>
  );
}

export function Cartao({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-linha bg-papel shadow-cartao", className)} {...props} />;
}

export function Selo({
  children,
  tom = "neutro",
  className,
}: {
  children: React.ReactNode;
  tom?: "neutro" | "ok" | "alerta" | "erro" | "info" | "marca";
  className?: string;
}) {
  const tons = {
    neutro: "bg-ink/5 text-suave",
    ok: "bg-ok-bg text-ok",
    alerta: "bg-alerta-bg text-alerta",
    erro: "bg-erro-bg text-erro",
    info: "bg-info-bg text-info",
    marca: "bg-marca-50 text-marca-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tons[tom], className)}>
      {children}
    </span>
  );
}

export const STATUS_INFO: Record<StatusAgendamento, { rotulo: string; tom: "ok" | "alerta" | "erro" | "info" | "neutro" }> = {
  PENDENTE: { rotulo: "Aguardando", tom: "alerta" },
  CONFIRMADO: { rotulo: "Confirmado", tom: "info" },
  CONCLUIDO: { rotulo: "Concluído", tom: "ok" },
  CANCELADO: { rotulo: "Cancelado", tom: "erro" },
  NAO_COMPARECEU: { rotulo: "Faltou", tom: "neutro" },
};

export function SeloStatus({ status }: { status: StatusAgendamento }) {
  const s = STATUS_INFO[status];
  return (
    <Selo tom={s.tom}>
      <span className="size-1.5 rounded-full bg-current" />
      {s.rotulo}
    </Selo>
  );
}

export function Avatar({ nome, cor, tamanho = 40, className }: { nome: string; cor?: string; tamanho?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-white", className)}
      style={{ width: tamanho, height: tamanho, background: cor ?? "var(--color-ink)", fontSize: tamanho * 0.38 }}
    >
      {iniciais(nome)}
    </span>
  );
}

export function Vazio({ icone, titulo, texto, children }: { icone: React.ReactNode; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-marca-50 text-marca-500">{icone}</div>
      <h3 className="font-display text-lg font-bold text-ink">{titulo}</h3>
      {texto && <p className="mt-1 max-w-sm text-sm text-suave">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Logo({ className, claro }: { className?: string; claro?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight", claro ? "text-white" : "text-ink", className)}>
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-marca-500 text-white shadow-sm shadow-marca-500/40">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M8.5 13l2.5 2.5 4.5-5" />
        </svg>
      </span>
      <span>
        Agenda<span className="text-marca-500">í</span>
      </span>
    </span>
  );
}
