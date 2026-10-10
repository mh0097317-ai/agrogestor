import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { legal } from "@/features/legal/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o StudioFlow trata dados pessoais de estabelecimentos e clientes.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="LGPD"
      title="Política de Privacidade"
      summary="Usamos só os dados necessários para agendar, lembrar e atender. Não vendemos dados. O estabelecimento é quem decide sobre os dados dos clientes dele (controlador); o StudioFlow trata esses dados em nome do estabelecimento (operador). Você pode pedir acesso, correção ou exclusão a qualquer momento."
    >
      <h2>1. Quais dados tratamos</h2>
      <ul>
        <li><b>Clientes dos estabelecimentos</b>: nome, telefone, e-mail (opcional), CPF quando o sinal por Pix exige, serviços agendados, histórico de atendimentos, avaliações e mensagens trocadas com a recepcionista no WhatsApp, Instagram ou chat da página.</li>
        <li><b>Estabelecimentos e equipe</b>: nome, e-mail, telefone, dados do negócio (endereço, CNPJ, fotos), dados de acesso e registros de uso do painel.</li>
        <li><b>Navegação</b>: páginas e etapas visitadas na página do estabelecimento, de forma agregada, para medir o funil de agendamento e evitar abusos.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Fazer, confirmar, lembrar, remarcar e cancelar agendamentos.</li>
        <li>Enviar avisos do agendamento por WhatsApp e e-mail.</li>
        <li>Responder mensagens pela recepcionista com inteligência artificial, quando ativada.</li>
        <li>Cobrar sinal, assinaturas e mensalidades por meio de parceiros de pagamento.</li>
        <li>Mostrar relatórios ao estabelecimento e manter a segurança do sistema (registros de acesso, prevenção de fraude).</li>
        <li>Mensagens de retorno ou promoção só quando o estabelecimento ativar e o cliente não tiver pedido para parar.</li>
      </ul>

      <h2>3. Bases legais</h2>
      <p>
        Execução do contrato e de procedimentos a pedido do titular (agendar e atender), cumprimento de obrigação legal,
        legítimo interesse (segurança, melhoria do serviço e lembretes) e consentimento quando exigido (por exemplo,
        mensagens de marketing). O consentimento pode ser revogado a qualquer momento.
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>Somente com fornecedores necessários para o serviço funcionar, sob contrato e com segurança:</p>
      <ul>
        <li>Hospedagem e banco de dados (Vercel e Supabase).</li>
        <li>Servidor do WhatsApp e automações (VPS própria com Evolution API e n8n) e a Meta (WhatsApp e Instagram).</li>
        <li>Inteligência artificial (Anthropic ou OpenAI, conforme o estabelecimento), apenas com o conteúdo da conversa necessário para responder.</li>
        <li>Pagamentos (Asaas) e envio de e-mails (Resend).</li>
      </ul>
      <p>Alguns desses fornecedores processam dados fora do Brasil, com as garantias previstas na LGPD.</p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Enquanto o estabelecimento usar o StudioFlow e pelo tempo necessário para obrigações legais. Registros de
        navegação são guardados por até 12 meses. Ao fim do contrato, os dados são excluídos ou devolvidos ao
        estabelecimento, salvo obrigação legal de guarda.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade, exclusão, informação
        sobre compartilhamento e revogação do consentimento (art. 18 da LGPD). Clientes podem falar direto com o
        estabelecimento ou com a gente pelo e-mail <a href={`mailto:${legal.email}`}>{legal.email}</a>; repassamos ao
        estabelecimento quando a decisão for dele.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Conexões criptografadas, isolamento dos dados de cada estabelecimento no banco, chaves e tokens guardados
        cifrados, controle de acesso por perfil e cópias de segurança. Em caso de incidente relevante, avisaremos os
        afetados e a ANPD conforme a lei.
      </p>

      <h2>8. Cookies e armazenamento no navegador</h2>
      <p>
        Usamos cookies essenciais para manter o login e o armazenamento do navegador para lembrar seus dados de
        agendamento neste aparelho (para você não digitar de novo). Não usamos cookies de publicidade.
      </p>

      <h2>9. Contato do encarregado</h2>
      <p>
        Encarregado pelo tratamento de dados: equipe {legal.company}, <a href={`mailto:${legal.email}`}>{legal.email}</a>.
      </p>
    </LegalPage>
  );
}
