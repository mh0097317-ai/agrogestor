# StudioFlow: guia do usuário

Versão de 25/11/2026 (commit `dc1ff6f`). Endereço: **https://app.studioflowapp.tech**. Demonstração sem cadastro: botão "Ver demonstração ao vivo" no site.

Funções marcadas com 🔑 dependem de uma conta externa (Asaas, Meta etc.) ou de um módulo do plano.

---

## Parte A: para o dono da barbearia

### 1. Criar a conta e a página
1. Entre em `app.studioflowapp.tech` e toque em **Testar grátis**.
2. Crie a conta com e-mail e senha. Não é preciso confirmar o e-mail para começar.
3. Siga o cadastro:

   | Etapa | O que preencher |
   | --- | --- |
   | Negócio | Tipo (barbearia, salão…) e nome |
   | Contato | WhatsApp, endereço, frase de apresentação, Instagram |
   | Identidade | Foto de capa (obrigatória), logo, cor dos botões, fotos dos trabalhos, comodidades |
   | Serviços | Nome, preço, duração, foto, descrição |
   | Equipe | Profissionais com foto e WhatsApp |
   | Horários | Dias e horário de funcionamento |

4. A conta nova fica **aguardando liberação** pela equipe StudioFlow. O painel abre sozinho quando é liberado.

### 2. Antes da primeira reserva
- Abra **Ativação** (`/dashboard/ativacao`). Ela confere catálogo, equipe, horários e canal.
- O Início mostra **"Complete sua página"** com o que ainda falta.

### 3. Configurações (menu → Configurações)

| Seção | O que dá para fazer |
| --- | --- |
| Empresa e aparência | Dados, CNPJ (preenche sozinho), fotos, cor, link do Google Maps, Instagram |
| Agendamento online | Ligar/desligar o link; dias e horários; antecedência mínima; até quantos dias à frente; intervalo entre atendimentos; prazo para cancelar |
| Fidelidade | Ligar o cartão; quantos atendimentos; qual prêmio |
| Pagamentos 🔑 | Conectar a conta Asaas da barbearia; cobrar sinal no Pix (valor fixo ou %) e prazo para pagar |
| WhatsApp e atendimento automático | Conectar o WhatsApp lendo o QR Code (Aparelhos conectados); ligar a recepcionista; horário de atendimento da IA; avisos aos profissionais; "Atendeu?"; mensagem de retorno para quem sumiu; WhatsApp de cada profissional |
| Notificações | Lembretes automáticos de agendamento |
| Plano | Seu plano, módulos, validade e faturas |

### 4. Início
- **Hoje: Salão ao vivo.** Cada cadeira mostra quem está atendendo, o tempo que falta e o próximo cliente. Toque numa cadeira para iniciar ou **concluir e cobrar** (escolha Pix, Dinheiro, Crédito ou Débito).
- **Precisa de você.** Aparece só quando há algo para resolver:
  - WhatsApp desconectado → **Reconectar**;
  - recepcionista parada por chave da IA → **Avisar o StudioFlow** / **Ver detalhes**;
  - conversas esperando a equipe → **Abrir conversas**;
  - horários passados sem finalizar → **Finalizar**.
- **Outros cartões:** Atendimento no WhatsApp (contagens), Resultados do StudioFlow, retrospectiva do mês, lembretes de amanhã (botão "Lembrar" abre o WhatsApp com a mensagem pronta) e lista de espera.

### 5. Agenda
- **Visões:** Dia, Semana e Mês. Filtre por profissional e mude a data pelas setas, pelo calendário ou por "Hoje".
- **Novo agendamento:** escolha cliente, serviços, profissional e horário. A agenda confere conflitos sozinha.
- **Bloquear horário:** reserva um período para folga, almoço ou compromisso.
- **Detalhe do horário:**
  - **Confirmar** (pendente);
  - **Iniciar**;
  - **Concluir e cobrar** (já pergunta a forma de pagamento; também dá para "Concluir sem registrar pagamento");
  - Editar ou reagendar, **Marcar falta**, Cancelar horário, Vender produto 🔑, Conversar no WhatsApp.
- **Dica:** finalize todos os atendimentos do dia. Sem isso, o financeiro e os relatórios ficam errados.

### 6. Conversas 🔑 (módulo Recepcionista)
- **Filas:** Precisam de você, Com a IA, Com a equipe, Todas.
- **Assumir:** a IA para de responder naquela conversa e você responde pelo número da barbearia. **Devolver** entrega a conversa de volta para a IA.
- A aba **Contatos** mostra os contatos do WhatsApp conectado.

### 7. Recepcionista IA 🔑
- Veja se o atendimento está ativo e quantos números estão conectados.
- **Converse com a sua recepcionista:** teste como ela responde, sem mandar mensagem a ninguém.
- **Treinamento:** escreva as instruções da casa (formas de pagamento, estacionamento, regras).
- **Como ela trabalha:**
  - responde a qualquer mensagem escrita;
  - mostra listas numeradas, e o cliente responde só com o número;
  - marca, cancela e remarca;
  - nunca inventa preço nem horário;
  - chama a equipe quando precisa.

### 8. Clientes
- Busca e abas (Todos, Em atraso, Novos, Ativos, Inativos).
- **Perfil:** histórico, quanto já gastou, cartão fidelidade, editar.

### 9. Serviços, Produtos 🔑 e Equipe
- **Serviços:** preço, duração, até 3 fotos, quem faz. Arquivar mantém o histórico.
- **Produtos:** preço, custo, estoque e estoque mínimo. Venda no balcão ou no atendimento.
- **Equipe:** expediente, pausas, folgas, serviços, comissão (%), convite de acesso ao painel e WhatsApp próprio.

### 10. Financeiro e Relatórios
- **Financeiro:** recebido, a receber, ticket médio, formas de pagamento, comissões (estimativa) e produtos. "Registrar pagamento" serve para lançamentos avulsos.
- **Relatórios:**
  - PDF do negócio, diário ou semanal, que chega no seu WhatsApp ou e-mail;
  - resultados por canal (link, recepcionista, painel);
  - exportação CSV.

### 11. Clube 🔑
- Crie planos (mensalidade, serviços inclusos, limite por mês).
- O cliente assina pela página `/<sua-loja>/clube` e paga pelo Asaas da barbearia.

### 12. Divulgar
- Copiar o link, QR Code, cartaz A4 e story com as **vagas reais** de hoje ou amanhã.
- Textos prontos para bio e status, e postar no Instagram 🔑.

### 13. Saúde da operação e Modo TV
- **Saúde da operação:** situação do WhatsApp, da recepcionista e dos avisos, falhas recentes e consumo da IA.
- **Modo TV** (`/tv`): abra numa TV da recepção. Mostra cadeiras, próximos clientes, chegadas, QR Codes e vitrine.

### 14. Mensalidade
- Nos últimos 5 dias aparece o aviso de renovação.
- O pagamento pelo app só aparece quando a cobrança automática estiver configurada. Senão, use **Falar com o StudioFlow**.

---

## Parte B: para o profissional
- **Aceite o convite** recebido por link. Seu acesso ao painel é **somente leitura**: agenda, clientes, relatórios e recepcionista.
- **Novo agendamento:** você recebe no WhatsApp o aviso com cliente, dia, hora, serviços, valor e se é a primeira vez.
- **"Atendeu?":** 15 minutos depois do horário sem início, chega um link: toque em **Atendi**, **Estou atendendo** ou **Cliente faltou**.

---

## Parte C: para o cliente final
1. Abra a página da barbearia, pelo link na bio, QR Code ou WhatsApp.
2. Toque em **Agendar**:
   - escolha os serviços (pode combinar);
   - escolha o profissional ou "Qualquer profissional";
   - escolha o dia e o horário;
   - informe nome e WhatsApp.
3. Guarde o **comprovante**. Nele você:
   - remarca ou cancela (até o prazo da casa);
   - paga o sinal no Pix (se houver);
   - avisa "Cheguei";
   - adiciona à agenda do celular;
   - avalia depois do atendimento.
4. **Pelo WhatsApp:** mande qualquer mensagem. A recepcionista mostra opções numeradas; responda com o número.
5. **Lembretes:** chegam 12 h, 2 h e 1 h antes, se você aceitou.
6. **Para parar as mensagens de retorno,** responda **PARAR**.
7. **Instale o app da casa** pelo convite "Instalar" da página.

---

## Parte D: para a equipe StudioFlow (`/admin`)

| Visão | Para que serve |
| --- | --- |
| Central de controle | Chave geral da IA e situação dos canais por cliente |
| Visão geral | Indicadores e receita mensal combinada |
| Estabelecimentos | Liberar acesso (dias, data, sem prazo, teste grátis), plano e módulos, mensalidade, cofre de IA e modo da IA, recepcionista, auditoria e funil |
| StudioFlow no WhatsApp | Número da plataforma (QR) e teste da recepcionista de cada loja |
| Cobranças | Mensalidades e faturas manuais |
| Captação | Buscar barbearias no Google Maps, dar nota e abrir conversa |
| Marketing | Posts com IA no Instagram da StudioFlow (Zernio) e piloto automático |
| E-mails | Mensagens aos donos (Resend) com rascunho por IA |
| Histórico | O que a equipe alterou |

---

## Perguntas frequentes
- **A IA não respondeu?** Veja a faixa "Precisa de você" e a Saúde da operação. As causas mais comuns são o WhatsApp desconectado (leia o QR de novo) ou a chave da IA recusada (fale com o StudioFlow).
- **Dois clientes no mesmo horário?** O sistema não deixa: a trava fica no banco.
- **O dinheiro do sinal vai para onde?** Direto para a conta Asaas da barbearia. O StudioFlow não toca no valor.
