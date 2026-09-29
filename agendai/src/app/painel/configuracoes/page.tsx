import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { appUrl, formatarTelefone } from "@/lib/utils";
import { minParaHora } from "@/lib/tempo";
import { exigirSessao } from "@/modules/auth/guard";
import { provedorEmail, provedorWhatsapp } from "@/modules/notificacoes/provedores";
import { FormConfiguracoes } from "@/components/painel/configuracoes";
import { LinksExtrasMobile } from "@/components/painel/navegacao";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  const { negocio } = await exigirSessao();
  const horarios = await prisma.horarioFuncionamento.findMany({ where: { negocioId: negocio.id }, orderBy: { inicioMin: "asc" } });

  return (
    <>
      <LinksExtrasMobile />
      <FormConfiguracoes
        baseUrl={appUrl()}
        provedores={{ whatsapp: provedorWhatsapp(), email: provedorEmail() }}
        inicial={{
          nome: negocio.nome,
          slug: negocio.slug,
          descricao: negocio.descricao ?? "",
          whatsapp: formatarTelefone(negocio.whatsapp),
          email: negocio.email ?? "",
          endereco: negocio.endereco ?? "",
          cidade: negocio.cidade ?? "",
          instagram: negocio.instagram ?? "",
          corPrimaria: negocio.corPrimaria,
          antecedenciaMinutos: String(negocio.antecedenciaMinutos),
          janelaDias: String(negocio.janelaDias),
          intervaloSlotMinutos: String(negocio.intervaloSlotMinutos),
          cancelamentoAteHoras: String(negocio.cancelamentoAteHoras),
          lembreteHorasAntes: String(negocio.lembreteHorasAntes),
          confirmacaoAutomatica: negocio.confirmacaoAutomatica,
          notificarDonoWhatsapp: negocio.notificarDonoWhatsapp,
          notificarDonoEmail: negocio.notificarDonoEmail,
          notificarClienteWhatsapp: negocio.notificarClienteWhatsapp,
          notificarClienteEmail: negocio.notificarClienteEmail,
          horarios: horarios.map((h) => ({ diaSemana: h.diaSemana, inicio: minParaHora(h.inicioMin), fim: minParaHora(h.fimMin) })),
        }}
      />
    </>
  );
}
