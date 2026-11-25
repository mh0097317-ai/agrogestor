# StudioFlow: auditoria visual e de experiência

Auditoria de 25/11/2026.

**Como as capturas foram feitas**
- Playwright (Chromium), com "reduzir movimento" ligado para tirar animações de entrada. Telas em desktop 1440×900 e em celular iPhone 13 (390×844, densidade 3).
- Ambiente: modo demonstração local (`barber-011`), sem dados reais.
- Duas capturas de produção: `P0-producao-site` e `P1-producao-login`, ambas com HTTP 200.
- **Ficaram de fora:** as telas internas da produção, porque exigiriam login de cliente real.

**Onde estão os arquivos**
- Capturas: pasta `capturas/` do pacote, com o nome `NN-tela-desktop.jpg` / `NN-tela-mobile.jpg`.
- Folhas de contato: `capturas/_folha-*.jpg`.
- Capturas anteriores do projeto: `docs/capturas-antes/` (fase editorial branco + navy, 02/10/2026) e `docs/capturas-depois/` (03/10/2026).

> **Artefatos de captura, não erros do produto:**
> - nas capturas de página inteira, a navegação inferior fixa do celular aparece no meio da imagem;
> - no desktop, o menu lateral fixo termina na altura da janela (900 px);
> - o selo "1 Issue" que aparece em algumas telas é o indicador de desenvolvimento do Next.js e não existe em produção.

---

## 1. Identidade (fatos do código)

**Direção "Cartaz"**, escolhida em 04/10/2026 entre três propostas internas (Cartaz, Noir, Gráfico).

| Elemento | Valor |
| --- | --- |
| Papel (fundo) | `#F4F0E8` |
| Cartões | `#FFFDF9` |
| Tinta (texto e botões) | `#16130F` |
| Texto de apoio | `#6E655B` |
| Linhas | `#E2D9CA` / `#DCD2C2` |
| Latão | `#8A6430` (texto) e `#A47A3C` (detalhes e estrelas) |
| Menu lateral | Tinta escura com destaque em latão |
| Cor da loja | Substitui a tinta nos botões da página pública e do agendamento (cor chapada) |

- **Off-white:** sim. O papel quente substitui o branco puro em todo o app.
- **Tipografia:** Fraunces (serifa variável; títulos, nomes e preços) e Hanken Grotesk (interface). As duas ficam hospedadas localmente com licença OFL.
- **Componentes:** `src/components/ui.tsx` (botões, campos, modal, painéis laterais, selos de status, avatar, spinner), `brand.tsx`, `brand-icons.tsx`, `image-upload.tsx`, `photo-scrub.tsx` e calendário.
  - **Não existe uma biblioteca de design formal.** Não há Storybook, tokens num arquivo único nem documentação dos componentes.
  - Os tokens estão espalhados pelas variáveis CSS de `globals.css` e pelos ~33 mil linhas de CSS por módulo.
- **Ícones:** Phosphor. O Lucide continua instalado, mas não é usado.
- **Movimento:** `src/styles/motion.css` e `components/motion.tsx`, com transições de 150 a 250 ms. Todas respeitam `prefers-reduced-motion`.
  - Agendamento: abertura com monograma, carimbo "Horário confirmado", vídeo do barbeiro ao ir para os horários, foto que "voa" até a barra.
  - Painel: indicador que desliza no menu e contadores animados.
- **Regras de estilo registradas:** sem degradês decorativos, brilho, luz que segue o mouse, ondulação ou ícones em quadradinhos coloridos; cantos de 2 a 4 px; linhas finas no lugar de sombras.

### Referências "Paper Design" e "ProfitizeBuild"
**Não há nenhuma evidência no repositório, na documentação ou no histórico de commits** de que essas referências tenham sido usadas. A busca por "paper design", "profitize" e "premium experience" em código, documentos e no histórico desta sessão não encontrou nada.

As referências que existem de fato:
- `docs/reference/Foto-1.jpg`: referência de agendamento e página pública;
- as três direções internas (Cartaz, Noir, Gráfico);
- o commit "Sync StudioFlow: design foundation" (30/10).

**Se houve uma missão "StudioFlow Premium Experience" com essas referências, ela não deixou rastro verificável.** O que existe é o conjunto de evoluções visuais de 03/10 a 13/11 descritas abaixo.

## 2. Antes × depois (com evidência)

| Fase | Data | Como era | Evidência |
| --- | --- | --- | --- |
| Editorial (Codex) | 02/10 | Branco predominante, navegação navy, Geist, indicadores compactos | `docs/capturas-antes/*.jpg` (20 imagens) |
| Referência Foto-1 | 03/10 | Página pública com cartão sobreposto, painel com 4 indicadores, cabeçalho navy no celular | `docs/capturas-depois/*.png` (21 imagens) |
| Cartaz | 04/10 → hoje | Papel, tinta e latão; serifa; cardápio numerado; carimbo; Salão 3D (30/10); TV redesenhada (01/11); caixinhas do WhatsApp (13/11); faixa "Precisa de você" (24/11) | `capturas/` deste pacote |

**Leitura (inferência):** a mudança é grande e coerente. O produto deixou de parecer um template de SaaS (branco e azul-marinho) e ganhou uma personalidade de "barbearia de bairro premium". A paleta e a tipografia fazem a marca ser reconhecível.

## 3. Análise por área

### 3.1 Site institucional (`00`)
- **Pontos fortes:**
  - título serifado forte, "Sua barbearia agendando *sozinha*, 24 horas.";
  - mock de celular e do Salão 3D;
  - prova visual do produto;
  - dores bem escritas.
- **Fraquezas:**
  - sem preço;
  - sem depoimento ou logo de cliente;
  - sem vídeo;
  - a seção de planos é genérica;
  - aviso de hidratação no console (dev).
- **Nota visual: 8/10.**

### 3.2 Login, cadastro e onboarding (`01`, `02`)
- **Pontos fortes:** login dividido com foto de barbearia e lista de benefícios; onboarding com prévia ao vivo da página.
- **Fraqueza:** o onboarding é longo e tem formulário denso no celular.
- **Nota: 8/10.**

### 3.3 Página pública e agendamento (`10`–`18`)
- **Pontos fortes:**
  - é a parte mais madura do produto;
  - capa fotográfica, nome em serifa e ações claras;
  - etapas numeradas com checks desenhados;
  - barra "Continuar" com o resumo;
  - calendário com Manhã/Tarde/Noite;
  - confirmação com carimbo e ticket "mostre na recepção".
- **Fraquezas:**
  - **faixa escura vazia** acima do ticket na confirmação e no comprovante (`17`, `18`): provável bloco de foto/mapa sem imagem; conferir com uma loja real;
  - no desktop, a confirmação é uma coluna estreita com muito espaço vazio;
  - a etapa de profissional mostra avatares sem foto como círculos vazios.
- **Nota: 9/10.**

### 3.4 Painel: Início (`20`)
- **Pontos fortes:**
  - "Salão ao vivo" em 3D é um diferencial forte de demonstração;
  - indicadores com serifa;
  - cadeiras com estado;
  - feed do dia;
  - faixa "Precisa de você" (24/11) em âmbar.
- **Fraquezas:**
  - densidade alta: muitos cartões competindo;
  - o 3D carrega devagar e pesa em celulares simples (o esqueleto de carregamento fica visível por alguns segundos);
  - no celular, a cena 3D toma espaço de informação útil.
- **Nota: 8/10.**

### 3.5 Agenda (`21`–`23`)
- **Pontos fortes:**
  - grade por profissional;
  - janelas disponíveis por serviço;
  - lista por períodos no celular com faixa de dias;
  - selos de status coloridos e legíveis.
- **Fraquezas:**
  - sem arrastar e soltar;
  - a visão semanal fica apertada em 1440 px com 4 profissionais;
  - no celular, a página é muito longa (rolagem extensa).
- **Nota: 8/10.**

### 3.6 Conversas e Recepcionista IA (`25`, `26`)
- **Pontos fortes:** caixa de entrada com filas claras e cabeçalho de status da IA ("Atendimento pausado").
- **Fraquezas:**
  - o estado vazio é grande e pouco útil na demo;
  - o simulador fica escondido abaixo da dobra;
  - não há mídia nem respostas rápidas.
- **Nota: 7,5/10.**

### 3.7 Gestão (`24`, `27`–`35`)
- **Pontos fortes:** consistência alta (cabeçalho com "sobrancelha" em latão, título serifado, cartões de indicador, ação principal à direita); Financeiro com bloco escuro de destaque.
- **Fraquezas:**
  - Produtos na demo aparecem sem foto (ícone genérico);
  - Clube e Relatórios têm muito espaço vazio;
  - **no desktop 1440×900, o menu lateral corta itens:** "Recepcionista IA" fica parcialmente atrás do cartão da loja, e Divulgar, Saúde da operação e Configurações exigem rolar o menu.
- **Nota: 8/10.**

### 3.8 Configurações (`36`–`42`)
- **Ponto forte:** organização em 7 seções com descrição.
- **Fraqueza:** no celular a troca de seção é um `<select>` (pouco descobrível) e os formulários são longos.
- **Nota: 7,5/10.**

### 3.9 Modo TV (`43`)
- **Ponto forte:** excelente: leitura à distância, fotos, QR e relógio grande.
- **Nota: 9/10.**

### 3.10 /admin (`50`–`58`)
- **Ponto forte:** a mesma linguagem visual.
- **Fraquezas:**
  - muitas visões e muito texto explicativo;
  - no celular, a troca de visão é por `<select>`;
  - a visão "Recepcionistas" não estabiliza a rede (fica consultando sem parar).
- **Nota: 7/10.** Uso interno, então não é prioridade.

## 4. Microinterações e animações
- Presentes e cuidadosas: checks desenhados, títulos que sobem palavra por palavra, carimbo, foto que voa até a barra, vibração curta no celular, contadores animados.
- **Risco:** a quantidade de animação no agendamento (abertura com monograma, vídeo de 2,6 s, cortina) pode atrasar quem tem pressa. As duas primeiras aparecem uma vez por visita e podem ser puladas com um toque.

## 5. Acessibilidade
- **Fatos:**
  - contraste de texto ≥ 4,5:1 verificado em 04/10;
  - painéis com foco contido e Escape;
  - `aria-label` nos controles principais;
  - movimento reduzido respeitado;
  - `aria-current` no menu.
- **Lacunas (inferência):**
  - sem auditoria com leitor de tela real;
  - alvos de toque pequenos em alguns filtros;
  - textos auxiliares de 11–12 px em cinza;
  - o 3D não tem alternativa textual equivalente; o feed lateral cobre parte disso.

## 6. Responsividade
- **Fato:** 94 capturas (47 telas e estados × desktop e celular) sem rolagem horizontal. Nenhum overflow foi detectado pelo script (largura de rolagem ≤ largura da tela).
- **No celular:**
  - navegação inferior com 4 itens + botão "+";
  - "Mais" abre a grade de módulos, com contador de conversas esperando.
- **Pendentes:** teclado virtual e instalação do PWA em aparelho físico.

## 7. Onde o design ainda parece genérico ou incompleto
1. **Estados vazios** (Conversas, Clube, Lista de espera, Relatórios): grandes e iguais entre si, sem ação sugerida específica.
2. **/admin e Configurações:** formulários longos e muito texto explicativo; falta hierarquia.
3. **Menu lateral:** corta itens em telas de 900 px de altura.
4. **Produtos e profissionais sem foto:** o placeholder (ícone e círculo vazio) quebra a estética fotográfica.
5. **Confirmação no desktop:** coluna estreita e faixa escura vazia.
6. **Design system:** não está documentado, e por isso cada tela nova tende a reinventar espaçamentos.

## 8. Recomendações (sem mudar a identidade)
1. **Corrigir o menu lateral em telas baixas:** rolagem interna visível ou cartão da loja recolhível.
2. **Estados vazios com uma ação concreta e uma ilustração fotográfica coerente** (ex.: Clube → "Criar o primeiro plano em 1 minuto").
3. **Placeholder elegante para fotos ausentes:** monograma em latão, como o da confirmação.
4. **Configurações no celular:** lista de seções navegável em vez de `<select>`.
5. **Início em "modo leve":** 3D opcional em aparelhos fracos e prioridade para "Precisa de você", Agora e Próximos.
6. **Documentar o design system:** tokens + 10 componentes-base num arquivo `DESIGN.md` com exemplos.
7. **Revisar a faixa escura da confirmação** e usar a largura do desktop (ticket + mapa lado a lado).
