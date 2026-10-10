import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/features/legal/legal-page";
import { legal } from "@/features/legal/legal";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso do StudioFlow por estabelecimentos e seus clientes.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Documento"
      title="Termos de Uso"
      summary="O StudioFlow é um sistema de agenda e gestão para barbearias, salões e estúdios. Quem contrata é o estabelecimento; o cliente final usa a página e o agendamento do estabelecimento. Ao criar uma conta ou fazer um agendamento, você concorda com estes termos e com a Política de Privacidade."
    >
      <h2>1. Quem é quem</h2>
      <ul>
        <li><b>StudioFlow</b>: fornece o sistema ({legal.site}).</li>
        <li><b>Estabelecimento</b>: a barbearia, salão ou estúdio que contrata o StudioFlow e oferece seus serviços.</li>
        <li><b>Cliente</b>: a pessoa que agenda um horário com o estabelecimento pela página, pelo WhatsApp ou pelo Instagram.</li>
      </ul>

      <h2>2. O que o StudioFlow oferece</h2>
      <p>
        Página do estabelecimento, agendamento online, agenda da equipe, cadastro de clientes, lembretes por WhatsApp
        e e-mail, cobrança de sinal e assinaturas por meio de parceiro de pagamento, controle financeiro, venda de
        produtos e recepcionista com inteligência artificial, conforme o plano contratado. Os módulos disponíveis podem
        variar por plano.
      </p>

      <h2>3. Conta do estabelecimento</h2>
      <ul>
        <li>O responsável deve informar dados verdadeiros e manter a senha em sigilo.</li>
        <li>O estabelecimento responde pelos serviços que presta, pelos preços, pela política de cancelamento e pelo atendimento aos seus clientes.</li>
        <li>O estabelecimento só deve cadastrar dados de clientes que tenha obtido de forma legítima e deve atender os pedidos deles sobre seus dados.</li>
        <li>É proibido usar o StudioFlow para envio de mensagens em massa não solicitadas, conteúdo ilegal ou que viole direitos de terceiros.</li>
      </ul>

      <h2>4. Agendamentos</h2>
      <ul>
        <li>O horário só fica garantido depois da confirmação na tela, no comprovante ou na mensagem.</li>
        <li>Quando o estabelecimento exige sinal, o horário fica reservado pelo prazo informado e é liberado se o pagamento não for concluído.</li>
        <li>Cancelamento e remarcação seguem a política do estabelecimento, mostrada no agendamento.</li>
        <li>Reembolsos de sinal e assinaturas são tratados diretamente com o estabelecimento.</li>
      </ul>

      <h2>5. Recepcionista com inteligência artificial</h2>
      <p>
        Quando ativada pelo estabelecimento, a recepcionista responde mensagens, consulta horários livres e pode marcar
        horários com a confirmação do cliente. As respostas são geradas automaticamente e podem conter erros; o cliente
        pode pedir para falar com a equipe a qualquer momento. Informações de preço e horário valem conforme o sistema
        do estabelecimento.
      </p>

      <h2>6. Pagamentos</h2>
      <p>
        Cobranças de sinal, assinaturas de clientes e mensalidade do StudioFlow são processadas por parceiros de
        pagamento. O StudioFlow não armazena dados completos de cartão.
      </p>

      <h2>7. Mensalidade e acesso</h2>
      <p>
        O estabelecimento paga a mensalidade do plano contratado. Em caso de atraso, o acesso pode ser pausado depois de
        aviso. Os dados do estabelecimento ficam preservados durante a pausa e podem ser exportados a pedido.
      </p>

      <h2>8. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o sistema no ar e com cópias de segurança, mas podem ocorrer interrupções por manutenção
        ou por falhas de terceiros (hospedagem, WhatsApp, Instagram, pagamentos). Não nos responsabilizamos por perdas
        indiretas decorrentes dessas interrupções.
      </p>

      <h2>9. Privacidade</h2>
      <p>
        O tratamento de dados pessoais segue a <Link href="/privacidade">Política de Privacidade</Link> e a Lei Geral de
        Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>10. Mudanças e contato</h2>
      <p>
        Podemos atualizar estes termos; mudanças relevantes serão avisadas no painel. Dúvidas:{" "}
        <a href={`mailto:${legal.email}`}>{legal.email}</a>. Fica eleito o foro do domicílio do consumidor, quando
        aplicável, para resolver eventuais conflitos.
      </p>
    </LegalPage>
  );
}
