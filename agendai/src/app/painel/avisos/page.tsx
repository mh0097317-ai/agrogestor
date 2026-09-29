import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Mail, MessageCircle, Send } from "lucide-react";
import type { CanalNotificacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cn, formatarTelefone, linkWhatsapp } from "@/lib/utils";
import { formatarNoFuso } from "@/lib/tempo";
import { exigirSessao } from "@/modules/auth/guard";
import { provedorEmail, provedorWhatsapp } from "@/modules/notificacoes/provedores";
import { Cartao, Selo, Vazio } from "@/components/ui";
import { Cabecalho } from "@/components/painel/cabecalho";
import { MarcarLidos } from "@/components/painel/marcar-lidos";

export const metadata: Metadata = { title: "Avisos" };

const CANAIS: { valor: CanalNotificacao | "TODOS"; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "PAINEL", rotulo: "Painel" },
  { valor: "WHATSAPP", rotulo: "WhatsApp" },
  { valor: "EMAIL", rotulo: "E-mail" },
];

const ICONE = { PAINEL: Bell, WHATSAPP: MessageCircle, EMAIL: Mail };

export default async function PaginaAvisos(props: PageProps<"/painel/avisos">) {
  const { negocio } = await exigirSessao();
  const { canal } = await props.searchParams;
  const filtro = CANAIS.find((c) => c.valor === canal)?.valor ?? "TODOS";

  const avisos = await prisma.notificacao.findMany({
    where: { negocioId: negocio.id, ...(filtro !== "TODOS" ? { canal: filtro } : {}) },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  const naoLidas = avisos.some((a) => a.canal === "PAINEL" && !a.lida);
  const whats = provedorWhatsapp();
  const email = provedorEmail();

  return (
    <div>
      {naoLidas && <MarcarLidos />}
      <Cabecalho titulo="Avisos" subtitulo="Tudo o que foi enviado para você e para seus clientes" />

      {(!whats || !email) && (
        <Cartao className="mb-5 flex gap-4 border-info/20 bg-info-bg/60 p-5">
          <Send className="mt-0.5 size-5 shrink-0 text-info" />
          <div className="text-sm text-ink">
            <p className="font-semibold">
              {!whats ? "Envio automático de WhatsApp ainda não conectado" : "Envio automático de e-mail ainda não conectado"}
            </p>
            <p className="mt-1 text-texto/80">
              As mensagens marcadas como <strong>“para enviar”</strong> estão prontas: toque em <strong>Enviar</strong> e o WhatsApp abre com o texto preenchido.
              Para envio 100% automático, configure Z-API/Twilio (WhatsApp) e Resend (e-mail) — veja o README.
            </p>
          </div>
        </Cartao>
      )}

      <div className="sem-barra mb-4 flex gap-2 overflow-x-auto">
        {CANAIS.map((c) => (
          <Link
            key={c.valor}
            href={c.valor === "TODOS" ? "/painel/avisos" : `/painel/avisos?canal=${c.valor}`}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              filtro === c.valor ? "bg-ink text-white" : "bg-papel text-suave hover:text-ink",
            )}
          >
            {c.rotulo}
          </Link>
        ))}
      </div>

      <Cartao className="overflow-hidden">
        {avisos.length === 0 ? (
          <Vazio icone={<Bell className="size-6" />} titulo="Nenhum aviso ainda" texto="Quando alguém agendar, cancelar ou receber lembrete, aparece aqui." />
        ) : (
          <ul className="divide-y divide-linha">
            {avisos.map((a) => {
              const Icone = ICONE[a.canal];
              return (
                <li key={a.id} className={cn("flex gap-4 px-4 py-4 sm:px-5", a.canal === "PAINEL" && !a.lida && "bg-marca-50/40")}>
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      a.canal === "WHATSAPP" ? "bg-[#25D366]/10 text-[#128C4B]" : a.canal === "EMAIL" ? "bg-info-bg text-info" : "bg-marca-50 text-marca-600",
                    )}
                  >
                    <Icone className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{a.titulo}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-suave">
                      {a.destinatario === "CLIENTE" ? "Para o cliente" : "Para você"}
                      {a.para && ` · ${a.canal === "WHATSAPP" ? formatarTelefone(a.para) : a.para}`} · {formatarNoFuso(a.createdAt, negocio.fusoHorario, "dd/MM 'às' HH:mm")}
                    </p>
                    {a.canal !== "PAINEL" && (
                      <details className="group mt-2">
                        <summary className="cursor-pointer list-none text-xs font-semibold text-suave hover:text-ink">
                          <span className="group-open:hidden">Ver mensagem</span>
                          <span className="hidden group-open:inline">Ocultar mensagem</span>
                        </summary>
                        <p className="mt-2 whitespace-pre-line rounded-xl bg-fundo p-3 text-sm text-texto">{a.mensagem}</p>
                      </details>
                    )}
                    {a.erro && <p className="mt-1 truncate text-xs text-erro">{a.erro}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {a.canal !== "PAINEL" &&
                      (a.status === "ENVIADA" ? (
                        <Selo tom="ok">Enviada</Selo>
                      ) : a.status === "FALHOU" ? (
                        <Selo tom="erro">Falhou</Selo>
                      ) : a.status === "SIMULADA" ? (
                        <Selo tom="alerta">Para enviar</Selo>
                      ) : (
                        <Selo>Na fila</Selo>
                      ))}
                    {a.canal === "WHATSAPP" && a.para && a.status !== "ENVIADA" && (
                      <a
                        href={linkWhatsapp(a.para, a.mensagem)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#1ebe5a]"
                      >
                        <MessageCircle className="size-3.5" /> Enviar
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
