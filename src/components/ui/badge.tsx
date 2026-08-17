import * as React from "react";
import { cn } from "@/lib/utils";

export type Tom = "green" | "amber" | "red" | "blue" | "gray";

const toms: Record<Tom, string> = {
  green: "text-success bg-success-bg",
  amber: "text-warning bg-warning-bg",
  red: "text-danger bg-danger-bg",
  blue: "text-info bg-info-bg",
  gray: "text-muted bg-[#EEF2F6]",
};

export function Badge({
  tom = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tom?: Tom }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold",
        toms[tom],
        className,
      )}
      {...props}
    />
  );
}
