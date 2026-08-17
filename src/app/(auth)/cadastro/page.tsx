import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage() {
  if (await getSession()) redirect("/dashboard");
  return <RegisterForm />;
}
