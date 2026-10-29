"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleNotch,
  Eye,
  EyeSlash,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { inviteRedirect } from "@/lib/invite-redirect";
import "./login.css";
import "@/components/auth-card.css";
export function LoginForm({
  initialSignup = false,
}: {
  initialSignup?: boolean;
}) {
  const router = useRouter();
  const [signup, setSignup] = useState(initialSignup),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
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
  function switchMode(next: boolean) {
    if (busy) return;
    setSignup(next);
    setVisible(false);
    setError("");
    setMessage("");
  }
  const feedback = (
    <>
      {error && (
        <p role="alert" className="ac-alert is-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="ac-alert is-ok">
          {message}
        </p>
      )}
    </>
  );
  const credentials = (mode: "login" | "register") => (
    <>
      <label className="ac-field">
        E-mail
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail de acesso"
          tabIndex={(mode === "register") === signup ? 0 : -1}
        />
      </label>
      <label className="ac-field">
        Senha
        <span className="ac-password">
          <input
            required
            type={visible ? "text" : "password"}
            minLength={8}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "register"
                ? "Crie uma senha com 8 ou mais caracteres"
                : "Digite sua senha"
            }
            tabIndex={(mode === "register") === signup ? 0 : -1}
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
    </>
  );
  return (
    <main className="ac-page">
      <Link href="/" className="ac-home" aria-label="StudioFlow">
        <Brand tone="on-dark" size={34} animated />
        <span className="ac-home-caption">GESTÃO COM MAIS FLUXO</span>
      </Link>
      <div className={`ac-card ${signup ? "is-register" : ""}`}>
        <div className="ac-bg" aria-hidden="true">
          <span className="ac-photo-caption">
            Seu espaço.
            <br />
            <em>Seu próximo capítulo.</em>
            <small>BARBEARIAS · SALÕES · ESTÚDIOS</small>
          </span>
        </div>

        <div className="ac-hero is-register" aria-hidden={!signup}>
          <span className="ac-hero-eyebrow">Já é da casa?</span>
          <h2>Bom ter você de volta.</h2>
          <p>
            Entre para ver a agenda do dia, o caixa e o que a recepcionista
            resolveu.
          </p>
          <button
            type="button"
            className="ac-switch"
            onClick={() => switchMode(false)}
            tabIndex={signup ? 0 : -1}
          >
            Entrar
          </button>
        </div>
        <div className="ac-hero is-login" aria-hidden={signup}>
          <span className="ac-hero-eyebrow">Primeira vez por aqui?</span>
          <h2>Mais tempo para o que você faz de melhor.</h2>
          <p>
            Agenda, clientes e atendimento em um espaço feito para o seu
            negócio.
          </p>
          <button
            type="button"
            className="ac-switch"
            onClick={() => switchMode(true)}
            tabIndex={signup ? -1 : 0}
          >
            Criar conta
          </button>
        </div>

        <form
          className="ac-form is-login"
          onSubmit={submit}
          aria-busy={busy}
          aria-hidden={signup}
          inert={signup}
        >
          <span className="ac-eyebrow">Entrar</span>
          <h1>Bom ter você aqui.</h1>
          <p className="ac-sub">
            Entre para acompanhar sua agenda, atender seus clientes e cuidar do negócio.
          </p>
          {credentials("login")}
          {!signup && feedback}
          <button
            disabled={busy || !configured}
            className="ac-submit"
            tabIndex={signup ? -1 : 0}
          >
            {busy && !signup ? (
              <CircleNotch size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            Entrar no painel
          </button>
          <button
            type="button"
            className="ac-mobile-switch"
            onClick={() => switchMode(true)}
          >
            Primeira vez por aqui? <b>Criar conta</b>
          </button>
        </form>

        <form
          className="ac-form is-register"
          onSubmit={submit}
          aria-busy={busy}
          aria-hidden={!signup}
          inert={!signup}
        >
          <span className="ac-eyebrow">Criar conta</span>
          <h1>Seu espaço começa aqui.</h1>
          <p className="ac-sub">
            Crie seu acesso. Depois, vamos organizar o seu estabelecimento.
          </p>
          <label className="ac-field">
            Seu nome
            <input
              required={signup}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como podemos chamar você?"
              tabIndex={signup ? 0 : -1}
            />
          </label>
          {credentials("register")}
          {signup && feedback}
          <button
            disabled={busy || !configured}
            className="ac-submit"
            tabIndex={signup ? 0 : -1}
          >
            {busy && signup ? (
              <CircleNotch size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            Criar minha conta
          </button>
          <p className="ac-terms">
            Ao criar a conta, você concorda com os{" "}
            <Link href="/termos" target="_blank">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank">
              Política de Privacidade
            </Link>
            .
          </p>
          <button
            type="button"
            className="ac-mobile-switch"
            onClick={() => switchMode(false)}
          >
            Já tem uma conta? <b>Entrar</b>
          </button>
        </form>
      </div>

      {!configured && (
        <div className="ac-demo">
          <p>
            O acesso por conta está em preparação.
            {dev
              ? " Explore a demonstração para conhecer o painel."
              : " Entre em contato com o responsável pelo sistema para habilitar seu acesso."}
          </p>
          {dev && (
            <Link href="/dashboard" className="ac-demo-link">
              Explorar demonstração <ArrowRight size={16} />
            </Link>
          )}
        </div>
      )}
      <p className="ac-foot">
        <ShieldCheck size={15} /> Os dados de cada estabelecimento ficam
        separados e protegidos.
        <Link href="/barber-011">Ver a experiência do cliente</Link>
        <Link href="/admin/login">Acesso administrativo</Link>
      </p>
    </main>
  );
}
