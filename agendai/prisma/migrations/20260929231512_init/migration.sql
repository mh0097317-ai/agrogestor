-- CreateEnum
CREATE TYPE "TipoNegocio" AS ENUM ('BARBEARIA', 'SALAO_FEMININO', 'SALAO_MASCULINO', 'SALAO_UNISSEX', 'ESTETICA', 'MANICURE', 'OUTRO');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DONO', 'EQUIPE');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU');

-- CreateEnum
CREATE TYPE "OrigemAgendamento" AS ENUM ('ONLINE', 'PAINEL');

-- CreateEnum
CREATE TYPE "Destinatario" AS ENUM ('CLIENTE', 'DONO');

-- CreateEnum
CREATE TYPE "CanalNotificacao" AS ENUM ('WHATSAPP', 'EMAIL', 'PAINEL');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('NOVO_AGENDAMENTO', 'CONFIRMACAO', 'LEMBRETE', 'CANCELAMENTO', 'STATUS');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('PENDENTE', 'ENVIADA', 'SIMULADA', 'FALHOU');

-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoNegocio" NOT NULL DEFAULT 'BARBEARIA',
    "descricao" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "instagram" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#E4572E',
    "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "antecedenciaMinutos" INTEGER NOT NULL DEFAULT 60,
    "janelaDias" INTEGER NOT NULL DEFAULT 30,
    "intervaloSlotMinutos" INTEGER NOT NULL DEFAULT 15,
    "confirmacaoAutomatica" BOOLEAN NOT NULL DEFAULT true,
    "cancelamentoAteHoras" INTEGER NOT NULL DEFAULT 2,
    "lembreteHorasAntes" INTEGER NOT NULL DEFAULT 24,
    "notificarDonoWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notificarDonoEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificarClienteWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notificarClienteEmail" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'DONO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioFuncionamento" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMin" INTEGER NOT NULL,
    "fimMin" INTEGER NOT NULL,

    CONSTRAINT "HorarioFuncionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profissional" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bio" TEXT,
    "cor" TEXT NOT NULL DEFAULT '#E4572E',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMin" INTEGER NOT NULL,
    "fimMin" INTEGER NOT NULL,

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "duracaoMin" INTEGER NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "profissionalId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'CONFIRMADO',
    "origem" "OrigemAgendamento" NOT NULL DEFAULT 'ONLINE',
    "precoCentavos" INTEGER NOT NULL,
    "observacao" TEXT,
    "token" TEXT NOT NULL,
    "lembreteEnviadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "agendamentoId" TEXT,
    "destinatario" "Destinatario" NOT NULL,
    "canal" "CanalNotificacao" NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "para" TEXT,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "enviadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProfissionalToServico" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfissionalToServico_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_slug_key" ON "Negocio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_negocioId_idx" ON "Usuario"("negocioId");

-- CreateIndex
CREATE INDEX "HorarioFuncionamento_negocioId_diaSemana_idx" ON "HorarioFuncionamento"("negocioId", "diaSemana");

-- CreateIndex
CREATE INDEX "Profissional_negocioId_idx" ON "Profissional"("negocioId");

-- CreateIndex
CREATE INDEX "Jornada_profissionalId_diaSemana_idx" ON "Jornada"("profissionalId", "diaSemana");

-- CreateIndex
CREATE INDEX "Servico_negocioId_idx" ON "Servico"("negocioId");

-- CreateIndex
CREATE INDEX "Bloqueio_negocioId_inicio_idx" ON "Bloqueio"("negocioId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_negocioId_telefone_key" ON "Cliente"("negocioId", "telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Agendamento_token_key" ON "Agendamento"("token");

-- CreateIndex
CREATE INDEX "Agendamento_negocioId_inicio_idx" ON "Agendamento"("negocioId", "inicio");

-- CreateIndex
CREATE INDEX "Agendamento_profissionalId_inicio_idx" ON "Agendamento"("profissionalId", "inicio");

-- CreateIndex
CREATE INDEX "Notificacao_negocioId_createdAt_idx" ON "Notificacao"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "Notificacao_negocioId_canal_lida_idx" ON "Notificacao"("negocioId", "canal", "lida");

-- CreateIndex
CREATE INDEX "_ProfissionalToServico_B_index" ON "_ProfissionalToServico"("B");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioFuncionamento" ADD CONSTRAINT "HorarioFuncionamento_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profissional" ADD CONSTRAINT "Profissional_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfissionalToServico" ADD CONSTRAINT "_ProfissionalToServico_A_fkey" FOREIGN KEY ("A") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfissionalToServico" ADD CONSTRAINT "_ProfissionalToServico_B_fkey" FOREIGN KEY ("B") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Impede dois agendamentos ativos sobrepostos para o mesmo profissional,
-- mesmo sob concorrência (dois clientes clicando no mesmo horário).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Agendamento"
  ADD CONSTRAINT "Agendamento_sem_sobreposicao"
  EXCLUDE USING gist (
    "profissionalId" WITH =,
    tsrange("inicio", "fim", '[)') WITH &&
  ) WHERE ("status" IN ('PENDENTE', 'CONFIRMADO'));
