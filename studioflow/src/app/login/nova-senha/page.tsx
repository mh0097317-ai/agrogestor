import type { Metadata } from "next";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha · StudioFlow" };

export default function NewPasswordPage() {
  return <NewPasswordForm />;
}
