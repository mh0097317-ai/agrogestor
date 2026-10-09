import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { DomainError } from "@/lib/availability";

/**
 * Key for the businesses' payment API keys. `PAYMENTS_ENCRYPTION_KEY`
 * (32 bytes, base64) when set; otherwise derived from the Supabase server
 * secret, which never leaves the server either. Changing the source key
 * means every business reconnects its account.
 */
function encryptionKey() {
  const explicit = process.env.PAYMENTS_ENCRYPTION_KEY;
  if (explicit) {
    const key = Buffer.from(explicit, "base64");
    if (key.length !== 32)
      throw new DomainError(
        "PAYMENTS_ENCRYPTION_KEY precisa ter 32 bytes em base64.",
        503,
      );
    return key;
  }
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret)
    throw new DomainError("Configure as credenciais de servidor.", 503);
  return Buffer.from(
    hkdfSync("sha256", secret, "studioflow", "payments-api-key:v1", 32),
  );
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(":");
}

export function decryptSecret(sealed: string) {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data)
    throw new DomainError("Reconecte sua conta de pagamentos.", 409);
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new DomainError("Reconecte sua conta de pagamentos.", 409);
  }
}

/** Dedicated authenticated encryption for the admin vault. Tenant/purpose
 * binding prevents a ciphertext copied to another customer from decrypting. */
export function sealVault(plain: string, scope: string) {
  const iv = randomBytes(12);
  const key = Buffer.from(
    hkdfSync("sha256", encryptionKey(), "studioflow", "admin-vault:v1", 32),
  );
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(scope));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "vault1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(":");
}
export function openVault(sealed: string, scope: string) {
  try {
    const [version, iv, tag, data] = sealed.split(":");
    if (version !== "vault1" || !iv || !tag || !data) throw new Error();
    const key = Buffer.from(
      hkdfSync("sha256", encryptionKey(), "studioflow", "admin-vault:v1", 32),
    );
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    cipher.setAAD(Buffer.from(scope));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      cipher.update(Buffer.from(data, "base64")),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw new DomainError(
      "A credencial precisa ser configurada novamente no cofre.",
      409,
    );
  }
}

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest();

/** Constant-time comparison of a received token with a stored hash. */
export function matchesHash(value: string | null, hash: Uint8Array | null) {
  if (!value || !hash) return false;
  const received = sha256(value);
  const stored = Buffer.from(hash);
  return stored.length === received.length && timingSafeEqual(received, stored);
}

/** Hex token of 256 bits (booking, club), only its hash is stored. */
export const newToken = () => randomBytes(32).toString("hex");
