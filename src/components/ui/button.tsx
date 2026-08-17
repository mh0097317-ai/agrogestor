import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-[0_6px_16px_rgba(22,163,74,.25)]",
  secondary:
    "bg-surface text-ink border border-border hover:border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[8px]",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-[12px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
