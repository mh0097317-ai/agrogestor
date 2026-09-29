"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopiarLink({ url, className, rotulo = "Copiar" }: { url: string; className?: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          const t = document.createElement("textarea");
          t.value = url;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1800);
      }}
      className={cn("inline-flex items-center gap-1.5 font-semibold", className)}
    >
      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copiado ? "Copiado!" : rotulo}
    </button>
  );
}
