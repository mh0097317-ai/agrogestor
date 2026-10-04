import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Store } from "@/types";
import { createSeed } from "@/lib/seed";
import { DomainError } from "@/lib/availability";
import { expireHolds } from "@/lib/payments";

export function isDemo() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.STUDIOFLOW_DEMO_MODE !== "false" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}
const directory = join(process.cwd(), ".data");
async function transaction<T>(
  operation: (store: Store) => T | Promise<T>,
  persist: boolean,
  slug = "barber-011",
  initial?: Store,
): Promise<T> {
  if (!isDemo())
    throw new DomainError(
      "Configure o Supabase para utilizar o ambiente de produção.",
      503,
    );
  if (!/^[a-z0-9-]{3,80}$/.test(slug))
    throw new DomainError("Estabelecimento não encontrado.", 404);
  const filename = join(directory, `business-${slug}.json`);
  const lock = join(directory, `business-${slug}.lock`);
  await mkdir(directory, { recursive: true });
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await mkdir(lock);
      await writeFile(
        join(lock, "owner.json"),
        JSON.stringify({ pid: process.pid }),
      );
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const owner = JSON.parse(
          await readFile(join(lock, "owner.json"), "utf8"),
        ) as { pid: number };
        if (Number.isSafeInteger(owner.pid) && owner.pid > 0)
          try {
            process.kill(owner.pid, 0);
          } catch (processError) {
            if ((processError as NodeJS.ErrnoException).code === "ESRCH")
              await rm(lock, { recursive: true, force: true });
          }
      } catch {
        try {
          if (Date.now() - (await stat(lock)).mtimeMs > 60_000)
            await rm(lock, { recursive: true, force: true });
        } catch {
          /* Another request has released the lock. */
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  if (!acquired)
    throw new DomainError(
      "O sistema está ocupado. Tente novamente em alguns segundos.",
      503,
    );
  try {
    let store: Store;
    try {
      const contents = await readFile(filename, "utf8");
      if (initial)
        throw new DomainError(
          "Este endereço já está em uso. Tente novamente.",
          409,
        );
      store = JSON.parse(contents);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (slug !== "barber-011" && !initial)
        throw new DomainError("Estabelecimento não encontrado.", 404);
      store = initial || createSeed();
    }
    // Fields added after a demo file was written.
    store.settings.loyaltyEnabled ??= false;
    store.settings.loyaltyGoal ??= 10;
    store.settings.loyaltyReward ??= "";
    store.settings.depositMode ??= "off";
    store.settings.depositValue ??= 0;
    store.settings.depositHold ??= 15;
    store.settings.assistantEnabled ??= false;
    store.settings.assistantName ??= "Recepção";
    store.settings.assistantInstructions ??= "";
    store.settings.assistantDailyLimit ??= 300;
    expireHolds(store);
    const result = await operation(store);
    if (persist) {
      const temporary = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(store), "utf8");
      await rename(temporary, filename);
    }
    return result;
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
export function readDemo(slug?: string) {
  return transaction((store) => store, false, slug);
}
export function mutateDemo<T>(
  operation: (store: Store) => T | Promise<T>,
  slug?: string,
) {
  return transaction(operation, true, slug);
}
export function createDemoBusiness(store: Store) {
  return transaction(() => store, true, store.business.slug, store);
}
export async function findDemoToken(token: string) {
  const { readdir } = await import("node:fs/promises");
  await mkdir(directory, { recursive: true });
  const files = await readdir(directory);
  for (const file of files.filter((file) =>
    /^business-[a-z0-9-]+\.json$/.test(file),
  )) {
    const slug = file.slice(9, -5);
    const store = await readDemo(slug);
    const appointment = store.appointments.find((item) => item.token === token);
    if (appointment) return { store, appointment, slug };
  }
  throw new DomainError("Agendamento não encontrado.", 404);
}
