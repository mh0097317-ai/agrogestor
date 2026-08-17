export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary-500">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 21c5-1 8-5 8-11V5l-5 1c-4 .8-7 3.6-7 8 0 2 .5 4 4 7Z" fill="#fff" />
            </svg>
          </div>
          <span className="text-xl font-bold">
            Agro<span className="text-primary-500">gestor</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-[-.02em]">
            Gestão rural do talhão ao resultado.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#AFC4D4]">
            Controle fazendas, safras, operações, estoque e financeiro num só lugar — com cada
            custo rastreável até a origem.
          </p>
        </div>

        <div className="text-sm text-[#6E8AA0]">Plataforma SaaS de gestão agrícola</div>

        {/* brilho decorativo */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
