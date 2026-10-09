import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Run on the VPS. Secrets are generated locally and never printed.
const [host, email, origin] = process.argv.slice(2);
if (
  !host ||
  !/^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(
    host,
  ) ||
  host.includes("..")
)
  throw new Error(
    "Informe somente o domínio público da Evolution, sem protocolo ou caminho.",
  );
if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/i.test(email))
  throw new Error("Informe um e-mail válido para o certificado HTTPS.");
const studioflow = new URL(origin);
if (
  studioflow.protocol !== "https:" ||
  studioflow.username ||
  studioflow.password ||
  studioflow.search ||
  studioflow.hash ||
  studioflow.pathname !== "/"
)
  throw new Error("Informe somente a origem HTTPS do StudioFlow.");
const destination = resolve(".env");
await writeFile(
  destination,
  [
    `EVOLUTION_HOST=${host.toLowerCase()}`,
    `ACME_EMAIL=${email}`,
    `STUDIOFLOW_ORIGIN=${studioflow.origin}`,
    "EVOLUTION_IMAGE=evoapicloud/evolution-api:v2.3.7",
    `AUTHENTICATION_API_KEY=${randomBytes(32).toString("hex")}`,
    `POSTGRES_PASSWORD=${randomBytes(32).toString("hex")}`,
    "",
  ].join("\n"),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Configuração criada em .env. As chaves não foram exibidas. Arquivo existente nunca é sobrescrito.",
);
