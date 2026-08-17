-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'PROPRIETARIO', 'GERENTE', 'AGRONOMO', 'OPERADOR', 'FINANCEIRO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "PlanoTenant" AS ENUM ('TRIAL', 'BASICO', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('ATIVA', 'INADIMPLENTE', 'CANCELADA', 'TRIAL');

-- CreateEnum
CREATE TYPE "StatusTalhao" AS ENUM ('DISPONIVEL', 'EM_PLANTIO', 'EM_MANEJO', 'EM_PRODUCAO', 'EM_COLHEITA', 'ATENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusSafra" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'COLHIDA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "EtapaSafra" AS ENUM ('PLANEJAMENTO', 'PLANTIO', 'MANEJO', 'COLHEITA', 'COMERCIALIZACAO');

-- CreateEnum
CREATE TYPE "StatusEtapa" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "NivelAlerta" AS ENUM ('INFO', 'ATENCAO', 'CRITICO');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('ESTOQUE', 'MANUTENCAO', 'FINANCEIRO', 'OPERACAO', 'CUSTO', 'PRODUCAO', 'GERAL');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "plano" "PlanoTenant" NOT NULL DEFAULT 'TRIAL',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plano" "PlanoTenant" NOT NULL DEFAULT 'TRIAL',
    "status" "StatusAssinatura" NOT NULL DEFAULT 'TRIAL',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'PROPRIETARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "contato" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "produtores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fazendas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produtorId" TEXT,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "municipio" TEXT,
    "estado" TEXT,
    "areaTotal" DECIMAL(12,2),
    "areaProdutiva" DECIMAL(12,2),
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "fazendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culturas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidadeProducao" TEXT NOT NULL DEFAULT 'sc',
    "cicloDias" INTEGER,
    "cor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "culturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talhoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT,
    "area" DECIMAL(12,2) NOT NULL,
    "culturaAtualId" TEXT,
    "status" "StatusTalhao" NOT NULL DEFAULT 'DISPONIVEL',
    "geojson" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "talhoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safras" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fazendaId" TEXT,
    "culturaId" TEXT,
    "nome" TEXT NOT NULL,
    "status" "StatusSafra" NOT NULL DEFAULT 'PLANEJADA',
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "precoVendaPrevisto" DECIMAL(12,2),
    "produtividadeEstimada" DECIMAL(12,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "safras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safra_talhoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "safraId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "areaPlantada" DECIMAL(12,2) NOT NULL,
    "produtividadeEstimada" DECIMAL(12,2),

    CONSTRAINT "safra_talhoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safra_etapas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "safraId" TEXT NOT NULL,
    "etapa" "EtapaSafra" NOT NULL,
    "status" "StatusEtapa" NOT NULL DEFAULT 'PENDENTE',
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "safra_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL DEFAULT 'GERAL',
    "nivel" "NivelAlerta" NOT NULL DEFAULT 'INFO',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "registroId" TEXT,
    "valorAnterior" JSONB,
    "valorNovo" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_tenantId_key" ON "assinaturas"("tenantId");

-- CreateIndex
CREATE INDEX "usuarios_tenantId_idx" ON "usuarios"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");

-- CreateIndex
CREATE INDEX "produtores_tenantId_idx" ON "produtores"("tenantId");

-- CreateIndex
CREATE INDEX "fazendas_tenantId_idx" ON "fazendas"("tenantId");

-- CreateIndex
CREATE INDEX "culturas_tenantId_idx" ON "culturas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "culturas_tenantId_nome_key" ON "culturas"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "talhoes_tenantId_idx" ON "talhoes"("tenantId");

-- CreateIndex
CREATE INDEX "talhoes_fazendaId_idx" ON "talhoes"("fazendaId");

-- CreateIndex
CREATE UNIQUE INDEX "talhoes_tenantId_fazendaId_codigo_key" ON "talhoes"("tenantId", "fazendaId", "codigo");

-- CreateIndex
CREATE INDEX "safras_tenantId_idx" ON "safras"("tenantId");

-- CreateIndex
CREATE INDEX "safra_talhoes_tenantId_idx" ON "safra_talhoes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "safra_talhoes_safraId_talhaoId_key" ON "safra_talhoes"("safraId", "talhaoId");

-- CreateIndex
CREATE INDEX "safra_etapas_tenantId_idx" ON "safra_etapas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "safra_etapas_safraId_etapa_key" ON "safra_etapas"("safraId", "etapa");

-- CreateIndex
CREATE INDEX "alertas_tenantId_idx" ON "alertas"("tenantId");

-- CreateIndex
CREATE INDEX "alertas_tenantId_lido_idx" ON "alertas"("tenantId", "lido");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entidade_idx" ON "audit_logs"("tenantId", "entidade");

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtores" ADD CONSTRAINT "produtores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fazendas" ADD CONSTRAINT "fazendas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fazendas" ADD CONSTRAINT "fazendas_produtorId_fkey" FOREIGN KEY ("produtorId") REFERENCES "produtores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culturas" ADD CONSTRAINT "culturas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhoes" ADD CONSTRAINT "talhoes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhoes" ADD CONSTRAINT "talhoes_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhoes" ADD CONSTRAINT "talhoes_culturaAtualId_fkey" FOREIGN KEY ("culturaAtualId") REFERENCES "culturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safras" ADD CONSTRAINT "safras_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safras" ADD CONSTRAINT "safras_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "fazendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safras" ADD CONSTRAINT "safras_culturaId_fkey" FOREIGN KEY ("culturaId") REFERENCES "culturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safra_talhoes" ADD CONSTRAINT "safra_talhoes_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "safras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safra_talhoes" ADD CONSTRAINT "safra_talhoes_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "talhoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safra_etapas" ADD CONSTRAINT "safra_etapas_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "safras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
