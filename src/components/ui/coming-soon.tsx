import { Construction } from "lucide-react";
import { PageHeader } from "./page-header";

export function ComingSoon({ title, fase, descricao }: { title: string; fase: number; descricao: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed border-border-strong bg-surface-2 px-6 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary-50 text-primary-600">
          <Construction size={26} />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1 text-[12px] font-semibold text-white">
            Fase {fase}
          </div>
          <h2 className="mt-3 text-lg font-bold text-ink">Em construção</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{descricao}</p>
        </div>
      </div>
    </div>
  );
}
