"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleNotch,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { inviteRedirect } from "@/lib/invite-redirect";
import "./login.css";
export function LoginForm() {
  const router = useRouter();
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    dev = process.env.NODE_ENV !== "production";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = createSupabaseBrowser();
      const next = inviteRedirect(
        new URLSearchParams(window.location.search).get("next"),
      );
      if (!client)
        throw new Error(
          "O acesso por conta está em preparação. Você já pode explorar a demonstração.",
        );
      if (signup) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
          },
        });
        if (error) throw error;
        if (data.session) router.push(next || "/onboarding");
        else
          setMessage(
            next
              ? "Confira seu e-mail para confirmar a conta e volte ao convite da sua barbearia."
              : "Confira seu e-mail para confirmar a conta e criar seu estabelecimento.",
          );
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
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
        router.push(next || (data?.length ? "/dashboard" : "/onboarding"));
        router.refresh();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="access-page">
      <div className="access-layout">
        <aside className="access-story">
          <Link href="/" className="access-brand" aria-label="StudioFlow">
            <Brand tone="on-dark" size={40} animated />
          </Link>
          <div>
            <p className="access-eyebrow">Para barbearias e salões</p>
            <h1>
              Agenda online
              <br />
              do seu salão.
            </h1>
            <p className="access-story-description">
              Seus clientes marcam pelo link. Você acompanha horários, equipe e
              caixa no painel, pelo celular ou computador.
            </p>
          </div>
          <p className="access-story-footer">
            <ShieldCheck size={16} />
            Os dados de cada estabelecimento ficam separados e protegidos.
          </p>
        </aside>
        <section className="access-form-section">
          <Link
            href="/"
            className="access-mobile-brand"
            aria-label="StudioFlow"
          >
            <Brand size={34} animated />
          </Link>
          <span className="access-form-eyebrow">
            {signup ? "CRIAR CONTA" : "ENTRAR"}
          </span>
          <h2>{signup ? "Seu espaço começa aqui." : "Bom ter você aqui."}</h2>
          <p className="access-form-description">
            {signup
              ? "Crie sua conta e organize seu próximo capítulo."
              : "Entre para acompanhar o seu estabelecimento."}
          </p>
          <form onSubmit={submit} className="access-form" aria-busy={busy}>
            {signup && (
              <label className="block text-sm text-slate-700">
                Seu nome
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-700"
                  placeholder="Como podemos chamar você?"
                />
              </label>
            )}
            <label className="block text-sm text-slate-700">
              E-mail
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-700"
                placeholder="voce@empresa.com"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Senha
              <input
                required
                type="password"
                minLength={8}
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-700"
                placeholder="Pelo menos 8 caracteres"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 text-red-700 p-3 text-sm"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm"
              >
                {message}
              </p>
            )}
            <button disabled={busy || !configured} className="access-submit">
              {busy ? (
                <CircleNotch size={18} className="animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}{" "}
              {signup ? "Criar minha conta" : "Entrar no painel"}
            </button>
          </form>
          <p className="access-switch">
            {signup ? "Já tem uma conta?" : "Primeira vez por aqui?"}{" "}
            <button
              className="access-link-button"
              onClick={() => {
                setSignup(!signup);
                setError("");
                setMessage("");
              }}
            >
              {signup ? "Entrar" : "Criar conta"}
            </button>
          </p>
          {!configured && (
            <div className="access-demo">
              <p>
                O acesso por conta está em preparação.
                {dev
                  ? " Explore a demonstração para conhecer o painel."
                  : " Entre em contato com o responsável pelo sistema para habilitar seu acesso."}
              </p>
              {dev && (
                <Link href="/dashboard" className="access-demo-link">
                  Explorar demonstração
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
          <Link href="/barber-011" className="access-customer-link">
            Conhecer a experiência do cliente
          </Link>
        </section>
      </div>
    </main>
  );
}
