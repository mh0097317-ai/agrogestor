import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PlatformAdmin } from "@/features/platform/platform-admin";
import { requirePlatformAdmin } from "@/services/platform";

export const metadata: Metadata = {
  title: "Plataforma",
  robots: { index: false, follow: false },
};

/** Só a equipe StudioFlow vê esta tela; o dono de um estabelecimento volta para o painel dele. */
export default async function AdminPage() {
  await connection();
  let status = 0;
  try {
    await requirePlatformAdmin();
  } catch (cause) {
    status = (cause as { status?: number }).status || 403;
  }
  if (status === 401) redirect("/login");
  if (status) redirect("/dashboard");
  return <PlatformAdmin />;
}
