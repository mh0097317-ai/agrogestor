import type { Metadata } from "next";
import { MessageCircle, Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarPreco, formatarTelefone, linkWhatsapp } from "@/lib/utils";
import { formatarNoFuso } from "@/lib/tempo";
import { exigirSessao } from "@/modules/auth/guard";
import { Avatar, Cartao, Campo, Vazio } from "@/components/ui";
import { Cabecalho } from "@/components/painel/cabecalho";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaClientes(props: PageProps<"/painel/clientes">) {
  const { negocio } = await exigirSessao();
  const { q } = await props.searchParams;
  const busca = typeof q === "string" ? q.trim() : "";
  const digitos = busca.replace(/\D/g, "");

  const clientes = await prisma.cliente.findMany({
    where: {
      negocioId: negocio.id,
      ...(busca
        ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, ...(digitos.length >= 3 ? [{ telefone: { contains: digitos } }] : [])] }
        : {}),
    },
    include: { agendamentos: { select: { inicio: true, status: true, precoCentavos: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const agora = new Date();
  const linhas = clientes
    .map((c) => {
      const feitos = c.agendamentos.filter((a) => a.status === "CONCLUIDO" || (a.status === "CONFIRMADO" && a.inicio < agora));
      const ultima = feitos.map((a) => a.inicio).sort((a, b) => b.getTime() - a.getTime())[0];
      const proximo = c.agendamentos
        .filter((a) => (a.status === "CONFIRMADO" || a.status === "PENDENTE") && a.inicio > agora)
        .map((a) => a.inicio)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      return {
        ...c,
        visitas: feitos.length,
        faltas: c.agendamentos.filter((a) => a.status === "NAO_COMPARECEU").length,
        total: feitos.reduce((s, a) => s + a.precoCentavos, 0),
        ultima,
        proximo,
      };
    })
    .sort((a, b) => (b.ultima?.getTime() ?? b.createdAt.getTime()) - (a.ultima?.getTime() ?? a.createdAt.getTime()));

  const fuso = negocio.fusoHorario;

  return (
    <div>
      <Cabecalho titulo="Clientes" subtitulo={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"} na sua base`} />
      <form className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-apagado" />
        <Campo name="q" defaultValue={busca} placeholder="Buscar por nome ou telefone" className="pl-10" />
      </form>

      <Cartao className="overflow-hidden">
        {linhas.length === 0 ? (
          <Vazio
            icone={<Users className="size-6" />}
            titulo={busca ? "Ninguém encontrado" : "Sua base de clientes começa aqui"}
            texto={busca ? "Tente outro nome ou número." : "Cada cliente que agenda entra automaticamente nessa lista."}
          />
        ) : (
          <ul className="divide-y divide-linha">
            {linhas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <Avatar nome={c.nome} tamanho={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{c.nome}</p>
                  <p className="truncate text-sm text-suave">
                    {formatarTelefone(c.telefone)}
                    {c.proximo && <span className="text-marca-600"> · próximo {formatarNoFuso(c.proximo, fuso, "dd/MM HH:mm")}</span>}
                  </p>
                </div>
                <div className="hidden w-24 text-right sm:block">
                  <p className="text-sm font-semibold text-ink">{c.visitas}</p>
                  <p className="text-xs text-suave">visitas{c.faltas ? ` · ${c.faltas} falta${c.faltas > 1 ? "s" : ""}` : ""}</p>
                </div>
                <div className="hidden w-28 text-right md:block">
                  <p className="text-sm font-semibold text-ink">{c.ultima ? formatarNoFuso(c.ultima, fuso, "dd/MM/yy") : "—"}</p>
                  <p className="text-xs text-suave">última visita</p>
                </div>
                <div className="hidden w-24 text-right lg:block">
                  <p className="text-sm font-semibold text-ink">{formatarPreco(c.total)}</p>
                  <p className="text-xs text-suave">total</p>
                </div>
                <a
                  href={linkWhatsapp(c.telefone, `Olá, ${c.nome.split(" ")[0]}! Tudo bem? Aqui é da ${negocio.nome} 😊`)}
                  target="_blank"
                  rel="noreferrer"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25D366]/10 text-[#128C4B] hover:bg-[#25D366]/20"
                  aria-label={`WhatsApp de ${c.nome}`}
                >
                  <MessageCircle className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
