import * as React from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-border-strong bg-surface-2 px-6 py-14 text-center">
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-600">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
