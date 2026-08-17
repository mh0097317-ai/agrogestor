import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {breadcrumb && <div className="mb-1 text-xs text-subtle">{breadcrumb}</div>}
        <h1 className="text-2xl font-bold tracking-[-.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
