import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { format } from "date-fns";
import { appUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { brandEmail } from "./email/brand-email";
import { emailConfigured, sendEmail } from "./email/resend";
import { requirePlatformAdmin } from "./platform";
import { isDemo } from "./server-demo";

/** Dias de teste grátis de quem se cadastra; 0 = espera a equipe liberar. */
export const DEFAULT_TRIAL_DAYS = 30;
export const trialSchema = z.object({
  days: z
    .number()
    .int("Use um número inteiro de dias.")
    .min(0, "Use de 0 a 365 dias.")
    .max(365, "Use de 0 a 365 dias."),
});

const demoFile = () => join(process.cwd(), ".data", "platform-settings.json");

export async function trialDays(): Promise<number> {
  if (isDemo()) {
    try {
      const saved = JSON.parse(await readFile(demoFile(), "utf8"));
      return trialSchema.parse({ days: saved.trialDays }).days;
    } catch {
      return DEFAULT_TRIAL_DAYS;
    }
  }
  const { data } = await createSupabaseAdmin()
    .from("platform_settings")
    .select("trial_days")
    .eq("id", "default")
    .maybeSingle();
  return typeof data?.trial_days === "number"
    ? data.trial_days
    : DEFAULT_TRIAL_DAYS;
}

export async function setTrialDays(days: number) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo()) {
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    await writeFile(demoFile(), JSON.stringify({ trialDays: days }));
    return;
  }
  const { error } = await createSupabaseAdmin()
    .from("platform_settings")
    .upsert({
      id: "default",
      trial_days: days,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error("Não foi possível salvar o teste grátis.");
}

/** E-mails da equipe StudioFlow. */
export async function platformEmails() {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("platform_admins").select("user_id");
  const emails = await Promise.all(
    (data || []).map(async (row) => {
      const user = await admin.auth.admin.getUserById(row.user_id as string);
      return user.data.user?.email || "";
    }),
  );
  return [...new Set(emails.filter(Boolean))];
}

/** Avisa a equipe que entrou estabelecimento novo; nunca derruba o cadastro. */
export async function notifyNewBusiness(business: {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  phone: string;
}) {
  try {
    if (isDemo() || !(await emailConfigured())) return;
    const { data } = await createSupabaseAdmin()
      .from("platform_access")
      .select("status,access_until")
      .eq("business_id", business.id)
      .maybeSingle();
    const access =
      data?.status === "active" && data.access_until
        ? `Em teste grátis até ${format(new Date(data.access_until), "dd/MM/yyyy")}.`
        : "Aguardando você liberar o acesso no /admin.";
    for (const [i, to] of (await platformEmails()).entries())
      await sendEmail(
        brandEmail({
          to,
          subject: `Nova barbearia cadastrada: ${business.name}`,
          preview: access,
          title: `${business.name} acabou de se cadastrar`,
          paragraphs: [
            access,
            `Conta: ${business.ownerEmail}`,
            business.phone ? `WhatsApp da loja: ${business.phone}` : "",
            `Página: ${appUrl}/${business.slug}`,
          ].filter(Boolean),
          cta: { label: "Abrir o /admin", url: `${appUrl}/admin` },
        }),
        `new-business-${business.id}-${i}`,
      ).catch(() => undefined);
  } catch {
    // Aviso é extra; o cadastro já foi feito.
  }
}
