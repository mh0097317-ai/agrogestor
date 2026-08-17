import { Bell, Search } from "lucide-react";

export function Topbar({ nome }: { nome: string }) {
  const iniciais = nome.trim().charAt(0).toUpperCase();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-surface/85 px-5 backdrop-blur lg:px-7">
      <label className="flex max-w-[360px] flex-1 items-center gap-2.5 rounded-[10px] border border-border bg-bg px-3 py-2 text-muted">
        <Search size={16} />
        <input
          placeholder="Buscar talhão, safra, operação…"
          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-subtle"
        />
      </label>
      <div className="ml-auto flex items-center gap-2.5">
        <button className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-border bg-surface text-muted transition-colors hover:text-ink">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full border-2 border-surface bg-danger" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface py-[5px] pl-[6px] pr-3">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#2C7A4B] to-primary-500 text-[12px] font-bold text-white">
            {iniciais}
          </div>
          <b className="hidden text-[13px] text-ink sm:block">{nome.split(" ")[0]}</b>
        </div>
      </div>
    </header>
  );
}
