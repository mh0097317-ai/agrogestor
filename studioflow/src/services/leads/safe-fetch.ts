import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/*
 * Lê a página de uma barbearia achada no Maps. O endereço vem de fora, então
 * só vale site público: o IP é conferido na hora da conexão (a cada
 * redirecionamento também), com tempo e tamanho limitados. Rede interna,
 * localhost e o endereço de metadados da nuvem são recusados.
 */

const MAX_BYTES = 600_000;
const TIMEOUT_MS = 7_000;
const MAX_REDIRECTS = 3;

function ipv4Blocked(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function blockedAddress(ip: string) {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Blocked(ip);
  if (kind !== 6) return true;
  const value = ip.toLowerCase();
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("ff")
  );
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string, family: number) => void;

/** DNS que só entrega endereço público para a conexão. */
function publicLookup(hostname: string, options: object, callback: LookupCallback) {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = Array.isArray(addresses) ? addresses : [];
    const allowed = list.find((item) => !blockedAddress(item.address));
    if (!allowed || list.some((item) => blockedAddress(item.address)))
      return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 4);
    callback(null, allowed.address, allowed.family);
  });
}

function once(url: URL): Promise<{ status: number; location?: string; body: string; type: string }> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && blockedAddress(host)) return reject(new Error("blocked address"));
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: publicLookup as never,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; StudioFlowBot/1.0; +https://app.studioflowapp.tech)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "pt-BR,pt;q=0.9",
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        const type = String(response.headers["content-type"] || "");
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          return resolve({ status, location: response.headers.location, body: "", type });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            response.destroy();
            return;
          }
          chunks.push(chunk);
        });
        response.on("close", () =>
          resolve({ status, body: Buffer.concat(chunks).toString("utf8"), type }),
        );
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
    request.end();
  });
}

/** HTML da página, ou o motivo de não ter aberto. */
export async function fetchPublicPage(raw: string) {
  let url: URL;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw))
    return { ok: false as const, error: "endereço não permitido" };
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false as const, error: "endereço inválido" };
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https?:$/.test(url.protocol) || (url.port && !["80", "443"].includes(url.port)))
      return { ok: false as const, error: "endereço não permitido" };
    try {
      const result = await once(url);
      if (result.location) {
        url = new URL(result.location, url);
        continue;
      }
      if (result.status >= 400) return { ok: false as const, error: `site respondeu ${result.status}` };
      if (result.type && !/html|text/i.test(result.type))
        return { ok: false as const, error: "não é uma página" };
      return { ok: true as const, html: result.body, url: url.toString() };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      return {
        ok: false as const,
        error: /blocked/.test(message)
          ? "endereço não permitido"
          : /timeout/.test(message)
            ? "site demorou demais"
            : "site não abriu",
      };
    }
  }
  return { ok: false as const, error: "redirecionamentos demais" };
}
