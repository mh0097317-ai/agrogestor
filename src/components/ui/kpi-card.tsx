import * as React from "react";
import { cn } from "@/lib/utils";

type IconTone = "green" | "blue" | "amber";

const iconTones: Record<IconTone, string> = {
  green: "bg-primary-50 text-primary-600",
  blue: "bg-info-bg text-info",
  amber: "bg-warning-bg text-warning",
};

export function KpiCard({
  icon,
  iconTone = "green",
  label,
  value,
  footer,
}: {
  icon: React.ReactNode;
  iconTone?: IconTone;
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[16px] border border-border bg-surface p-[18px] shadow-[var(--shadow-card)]">
      <div className={cn("grid h-[38px] w-[38px] place-items-center rounded-[11px]", iconTones[iconTone])}>
        {icon}
      </div>
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className="tnum text-[22px] font-bold leading-tight tracking-[-.02em] text-ink">{value}</div>
      {footer && <div className="flex items-center gap-1.5 text-xs text-muted">{footer}</div>}
    </div>
  );
}

export function Delta({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        up ? "text-success bg-success-bg" : "text-danger bg-danger-bg",
      )}
    >
      {up ? "▲" : "▼"} {children}
    </span>
  );
}
