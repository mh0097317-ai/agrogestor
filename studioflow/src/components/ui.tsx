"use client";
import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";
import { CircleNotch, Tray, X } from "@phosphor-icons/react/dist/ssr";
import { createPortal } from "react-dom";
import { initials, statusLabels } from "@/lib/utils";
export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}
export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, minWidth: size }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span>{initials(name)}</span>
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status}`}>
      <i />
      {statusLabels[status] || status}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Tray size={34} weight="duotone" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const identities: Record<string, [string, string]> = {
    Agenda: ["01", "Seu tempo, bem cuidado"],
    Clientes: ["02", "Relacionamento"],
    Conversas: ["03", "Atendimento"],
    Serviços: ["04", "Seu catálogo"],
    Produtos: ["05", "Sua vitrine"],
    Equipe: ["06", "Quem faz acontecer"],
    Financeiro: ["07", "Gestão de recebimentos"],
    "Clube de assinatura": ["08", "Planos e recorrência"],
    Relatórios: ["09", "A visão do negócio"],
    Divulgar: ["10", "Sua presença online"],
    Configurações: ["11", "Do seu jeito"],
  };
  const identity = identities[title];
  return (
    <div className={`page-heading ${identity ? "sf-module-header" : ""}`}>
      <div className="page-heading-copy">
        {identity && (
          <span className="sf-module-eyebrow">
            <span aria-hidden="true">{identity[0]}</span>
            {identity[1]}
          </span>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Spinner() {
  return <CircleNotch className="spin" size={20} />;
}
export function Modal({
  open,
  onClose,
  title,
  children,
  presentation = "dialog",
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  presentation?: "dialog" | "panel";
  description?: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = previous;
      previousFocus?.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div
      className={`modal-backdrop ${presentation === "panel" ? "detail-backdrop" : ""}`}
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        className={`modal ${presentation === "panel" ? "detail-panel" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p className="panel-description">{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
export function DetailPanel(
  props: Omit<Parameters<typeof Modal>[0], "presentation">,
) {
  return <Modal {...props} presentation="panel" />;
}
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="form-section-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
export function MetricStrip({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode; detail?: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={`metric-strip ${className}`}>
      {items.map((item) => (
        <div className="metric-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small>{item.detail}</small>}
        </div>
      ))}
    </div>
  );
}
