"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleNotch,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { accessError } from "../login-form";
import "@/components/auth-card.css";

/** Where the reset link from the e-mail lands, already signed in. */
export function NewPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const client = createSupabaseBrowser();
    if (!client) return queueMicrotask(() => setReady(false));
    client.auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== repeat) {
      setError("As duas senhas não estão iguais.");
      return;
    }
    const client = createSupabaseBrowser();
    if (!client) return;
    setBusy(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      const {
        data: { user },
      } = await client.auth.getUser();
      const { data } = await client
        .from("business_members")
        .select("business_id")
        .eq("user_id", user!.id)
        .eq("active", true)
        .limit(1);
      router.push(data?.length ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (failure) {
      setError(accessError(failure, "Não foi possível salvar a senha."));
      setBusy(false);
    }
  }
  return (
    <main className="ac-page">
      <Link href="/" className="ac-home" aria-label="StudioFlow">
        <Brand tone="on-dark" size={34} animated />
        <span className="ac-home-caption">GESTÃO COM MAIS FLUXO</span>
      </Link>
      {ready === false ? (
        <div className="ac-solo">
          <span className="ac-eyebrow">Nova senha</span>
          <h1>Esse link expirou.</h1>
          <p className="ac-sub">
            Por segurança, o link vale por pouco tempo e só uma vez. Peça um
            novo na tela de login.
          </p>
          <Link href="/login" className="ac-submit">
            <ArrowRight size={18} /> Voltar para o login
          </Link>
        </div>
      ) : (
        <form className="ac-solo" onSubmit={submit} aria-busy={busy}>
          <span className="ac-eyebrow">Nova senha</span>
          <h1>Escolha sua nova senha.</h1>
          <p className="ac-sub">
            Use 8 ou mais caracteres. Depois de salvar, você já entra no painel.
          </p>
          <label className="ac-field">
            Nova senha
            <span className="ac-password">
              <input
                required
                minLength={8}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 ou mais caracteres"
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          <label className="ac-field">
            Repita a nova senha
            <input
              required
              minLength={8}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="Digite de novo"
            />
          </label>
          {error && (
            <p role="alert" className="ac-alert is-error">
              {error}
            </p>
          )}
          <button className="ac-submit" disabled={busy || ready === null}>
            {busy ? (
              <CircleNotch size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            Salvar e entrar
          </button>
        </form>
      )}
    </main>
  );
}
