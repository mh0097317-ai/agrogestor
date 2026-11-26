#!/usr/bin/env node
/*
 * Confere se um arquivo de ambiente é seguro para homologação, sem imprimir
 * nenhum valor secreto. Uso: node scripts/staging/check-env.mjs .env.staging.local
 * Sai com código 1 se algo pode atingir produção ou pessoas reais.
 */
import { readFileSync } from "node:fs";

const PRODUCTION_REF = "dyukaebjntbfeqctyehi";
const file = process.argv[2] || ".env.staging.local";
let text;
try {
  text = readFileSync(file, "utf8");
} catch {
  console.error(`Arquivo não encontrado: ${file}`);
  process.exit(1);
}
const env = Object.fromEntries(
  text
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const problems = [];
const warnings = [];
const mode = (env.STUDIOFLOW_OUTBOUND_MODE || "").toLowerCase();
if (env.STUDIOFLOW_STAGING !== "1") problems.push("STUDIOFLOW_STAGING precisa ser 1.");
if (mode === "live") problems.push("STUDIOFLOW_OUTBOUND_MODE=live envia para pessoas reais.");
if (!["sandbox", "off"].includes(mode)) warnings.push("Defina STUDIOFLOW_OUTBOUND_MODE=sandbox ou off explicitamente.");
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url) problems.push("NEXT_PUBLIC_SUPABASE_URL vazio.");
if (url.includes(PRODUCTION_REF)) problems.push("NEXT_PUBLIC_SUPABASE_URL aponta para o banco de PRODUÇÃO.");
if ((env.STUDIOFLOW_ASAAS_ENV || "sandbox") !== "sandbox")
  problems.push("STUDIOFLOW_ASAAS_ENV precisa ser sandbox.");
if (env.STUDIOFLOW_ASAAS_API_KEY?.startsWith("$aact_prod"))
  problems.push("A chave do Asaas parece ser de produção.");
if ((env.EVOLUTION_PLATFORM_INSTANCE || "") === "sf-studioflow")
  problems.push("EVOLUTION_PLATFORM_INSTANCE é a instância de produção (sf-studioflow).");
if (env.ANTHROPIC_API_KEY) warnings.push("ANTHROPIC_API_KEY definida: cada conversa de teste gera custo.");
if (env.RESEND_API_KEY && mode !== "off" && !env.STUDIOFLOW_OUTBOUND_ALLOWLIST?.includes("@"))
  warnings.push("RESEND_API_KEY definida sem e-mail na lista de teste: nenhum e-mail sairá.");
for (const key of ["SUPABASE_SECRET_KEY", "PAYMENTS_ENCRYPTION_KEY", "CRON_SECRET"])
  if (!env[key]) warnings.push(`${key} vazio.`);
const allow = (env.STUDIOFLOW_OUTBOUND_ALLOWLIST || "").split(",").filter(Boolean);
console.log(`Arquivo: ${file}`);
console.log(`Modo de envio: ${mode || "(padrão: sandbox por STUDIOFLOW_STAGING=1)"}`);
console.log(`Destinos de teste liberados: ${allow.length}`);
for (const w of warnings) console.log(`AVISO  ${w}`);
for (const p of problems) console.log(`ERRO   ${p}`);
if (problems.length) {
  console.log("\nNão use este arquivo: pode atingir produção ou pessoas reais.");
  process.exit(1);
}
console.log("\nOK para homologação.");
