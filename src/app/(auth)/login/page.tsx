import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return <LoginForm />;
}
