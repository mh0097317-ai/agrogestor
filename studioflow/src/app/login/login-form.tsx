"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  Eye,
  EyeSlash,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { inviteRedirect } from "@/lib/invite-redirect";
import { showcaseSlug } from "@/lib/showcase";
import "./login.css";
import "@/components/auth-card.css";

/** Supabase answers in English; the owner reads Portuguese. */
export function accessError(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message : "";
  if (/invalid login credentials/i.test(text))
    return "E-mail ou senha não conferem. Confira e tente de novo.";
  if (/email not confirmed/i.test(text))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered|already been registered/i.test(text))
    return "Já existe uma conta com esse e-mail. Entre ou crie uma nova senha.";
  if (/rate limit|too many|seconds/i.test(text))
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (/password should be|weak password/i.test(text))
    return "Escolha uma senha mais forte, com 8 ou mais caracteres.";
  if (/fetch|network/i.test(text))
    return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return text && !/^[A-Za-z0-9 ,.'"()_-]+$/.test(text) ? text : fallback;
}

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
  // "Esqueci minha senha" swaps the login form for the reset request.
  const [forgot, setForgot] = useState(false);
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
      if (forgot) {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login/nova-senha")}`,
        });
        if (error) throw error;
        setMessage(
          "Se esse e-mail tiver uma conta, o link para criar a nova senha chega em instantes. Confira também o spam.",
        );
      } else if (signup) {
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
        accessError(
          error,
          forgot
            ? "Não foi possível enviar o link. Tente de novo."
            : "Não foi possível entrar. Tente de novo.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function switchMode(next: boolean) {
    if (busy) return;
    setSignup(next);
    setForgot(false);
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
          <span className="ac-live">
            <CheckCircle size={20} weight="fill" />
            <span>
              <b>Novo agendamento pelo WhatsApp</b>
              Corte + barba · amanhã às 14:30
            </span>
          </span>
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
          <ul className="ac-perks">
            <li>
              <CalendarCheck size={18} weight="duotone" /> Agenda online aberta
              24 horas
            </li>
            <li>
              <ChatCircleText size={18} weight="duotone" /> Recepcionista com IA
              no WhatsApp
            </li>
            <li>
              <Wallet size={18} weight="duotone" /> Caixa e comissão sem
              planilha
            </li>
          </ul>
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
          {forgot ? (
            <>
              <span className="ac-eyebrow">Nova senha</span>
              <h1>Vamos criar uma nova senha.</h1>
              <p className="ac-sub">
                Digite o e-mail da sua conta. Mandamos um link para você
                escolher a nova senha.
              </p>
              <label className="ac-field">
                E-mail
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail de acesso"
                  tabIndex={signup ? -1 : 0}
                />
              </label>
            </>
          ) : (
            <>
              <span className="ac-eyebrow">Entrar</span>
              <h1>Bom ter você aqui.</h1>
              <p className="ac-sub">
                Entre para acompanhar sua agenda, atender seus clientes e
                cuidar do negócio.
              </p>
              {credentials("login")}
              <button
                type="button"
                className="ac-forgot"
                onClick={() => {
                  setForgot(true);
                  setError("");
                  setMessage("");
                }}
                tabIndex={signup ? -1 : 0}
              >
                Esqueci minha senha
              </button>
            </>
          )}
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
            {forgot ? "Enviar link" : "Entrar no painel"}
          </button>
          {forgot && (
            <button
              type="button"
              className="ac-back"
              onClick={() => {
                setForgot(false);
                setError("");
                setMessage("");
              }}
            >
              <ArrowLeft size={16} /> Voltar para o login
            </button>
          )}
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
        <Link href={`/${showcaseSlug}`}>Ver a experiência do cliente</Link>
        <Link href="/admin/login">Acesso administrativo</Link>
      </p>
    </main>
  );
}
