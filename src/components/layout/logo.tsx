import { cn } from "@/lib/utils";

export function Logo({ withText = true, className }: { withText?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-gradient-to-br from-primary-500 to-[#0EA55A] shadow-[0_4px_12px_rgba(22,163,74,.35)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 21c5-1 8-5 8-11V5l-5 1c-4 .8-7 3.6-7 8 0 2 .5 4 4 7Z" fill="#fff" />
          <path d="M12 21c-1-5 1-9 5-12" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      {withText && (
        <span className="text-[17px] font-bold tracking-[-.01em] text-white">
          Agro<span className="text-primary-500">gestor</span>
        </span>
      )}
    </div>
  );
}
