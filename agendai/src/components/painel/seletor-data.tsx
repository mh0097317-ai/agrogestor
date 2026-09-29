"use client";

import { useRouter } from "next/navigation";
import { CalendarSearch } from "lucide-react";

export function SeletorData({ valor }: { valor: string }) {
  const router = useRouter();
  return (
    <label className="relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-fundo" aria-label="Escolher data">
      <CalendarSearch className="size-5 text-suave" />
      <input
        type="date"
        value={valor}
        onChange={(e) => e.target.value && router.push(`/painel/agenda?data=${e.target.value}`)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
