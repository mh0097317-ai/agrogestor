"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  House,
  CalendarBlank,
  UsersThree,
  Scissors,
  IdentificationBadge,
  Wallet,
  ChartLineUp,
  GearSix,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Bell,
  ArrowSquareOut,
  Plus,
  DotsThree,
  Question,
  Copy,
  Storefront,
  SignOut,
  ArrowUpRight,
  ShieldCheck,
  QrCode,
  Seal,
  ChatsCircle,
  Crown,
  ShoppingBagOpen,
  Television,
} from "@phosphor-icons/react/dist/ssr";
import { useWorkspace, WorkspaceProvider } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { Avatar, Card, Modal } from "@/components/ui";
import { AppointmentForm } from "@/features/agenda/appointment-form";
import { businessDay } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { SegmentIcon } from "@/lib/segments";
import { Brand } from "@/components/brand";
import { AccessGate } from "./access-gate";
import { daysLeft } from "@/lib/access";
import { hasModule, type ModuleKey } from "@/lib/modules";
import { format } from "date-fns";
const links = [
  { path: "/dashboard", label: "Início", icon: House },
  { path: "/dashboard/agenda", label: "Agenda", icon: CalendarBlank },
  { path: "/dashboard/clientes", label: "Clientes", icon: UsersThree },
  {
    path: "/dashboard/conversas",
    label: "Conversas",
    icon: ChatsCircle,
    module: "recepcionista" as ModuleKey,
  },
  { path: "/dashboard/servicos", label: "Serviços", icon: Scissors },
  {
    path: "/dashboard/produtos",
    label: "Produtos",
    icon: ShoppingBagOpen,
    module: "produtos" as ModuleKey,
  },
  { path: "/dashboard/equipe", label: "Equipe", icon: IdentificationBadge },
  { path: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  {
    path: "/dashboard/clube",
    label: "Clube",
    icon: Seal,
    module: "clube" as ModuleKey,
  },
  {
    path: "/dashboard/relatorios",
    label: "Relatórios",
    icon: ChartLineUp,
  },
  { path: "/dashboard/divulgar", label: "Divulgar", icon: QrCode },
  { path: "/dashboard/configuracoes", label: "Configurações", icon: GearSix },
];
export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Gate>{children}</Gate>
    </WorkspaceProvider>
  );
}
/** Sem acesso liberado, o painel dá lugar à tela de liberação. */
function Gate({ children }: { children: ReactNode }) {
  const { blocked, refresh } = useWorkspace();
  if (blocked) return <AccessGate access={blocked} onRetry={refresh} />;
  return <Shell>{children}</Shell>;
}
const support = (process.env.NEXT_PUBLIC_STUDIOFLOW_WHATSAPP || "").replace(
  /\D/g,
  "",
);
/** Aviso para o dono quando faltam poucos dias de acesso. */
function RenewBanner() {
  const { data } = useWorkspace();
  const access = data?.access;
  if (
    !access ||
    access.state !== "expiring" ||
    !access.until ||
    !["owner", "admin"].includes(data?.viewer?.role || "")
  )
    return null;
  const left = daysLeft(access) ?? 0;
  const ask = `Olá! Quero renovar o acesso do ${data.business.name} no StudioFlow.`;
  return (
    <div className="renew-banner" role="status">
      <span>
        Seu acesso vai até <b>{format(new Date(access.until), "dd/MM")}</b>
        {left <= 1 ? " (último dia)" : ` (faltam ${left} dias)`}. Renove para a
        agenda online continuar aberta.
      </span>
      {support && (
        <a
          href={`https://wa.me/${support}?text=${encodeURIComponent(ask)}`}
          target="_blank"
          rel="noreferrer"
        >
          Falar com o StudioFlow
        </a>
      )}
    </div>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  // Slide one highlight between menu items instead of swapping backgrounds.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const current = nav.querySelector<HTMLElement>(".nav-link.active");
      if (!current) {
        nav.removeAttribute("data-indicator");
        return;
      }
      nav.style.setProperty("--ind-y", `${current.offsetTop}px`);
      nav.style.setProperty("--ind-h", `${current.offsetHeight}px`);
      nav.setAttribute("data-indicator", "");
    };
    measure();
    // Badges load later and change item heights; keep the highlight aligned.
    const observer = new ResizeObserver(measure);
    nav.querySelectorAll(".nav-link").forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [pathname]);
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const { data, refresh, refreshing, refreshError } = useWorkspace();
  const { toast } = useToast();
  const { canMutate } = usePermissions();
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [more, setMore] = useState(false);
  const [create, setCreate] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok)
        throw new Error("Não foi possível sair. Tente novamente.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível sair.");
      setSigningOut(false);
    }
  }
  const page = links.find((l) => l.path === pathname)?.label || "Início";
  // Only what the business's plan includes shows up in the menu.
  const menu = links.filter(
    (link) =>
      !("module" in link && link.module) ||
      hasModule(data?.access?.modules, link.module),
  );
  const ownerName = data?.viewer?.name || "Seu perfil";
  const ownerRole =
    data?.viewer?.role === "owner"
      ? "Proprietário"
      : data?.viewer?.role === "admin"
        ? "Administrador"
        : "Equipe";
  const slug = data?.business.slug || "barber-011";
  async function copyLink() {
    const url = `${location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link da sua página copiado.");
    } catch {
      toast(`Sua página: ${url}`);
    }
  }
  const active = (path: string) =>
    path === "/dashboard" ? pathname === path : pathname.startsWith(path);
  return (
    <div
      className="app-shell"
      data-home={pathname === "/dashboard" ? "" : undefined}
    >
      <aside className="sidebar">
        <Link className="sidebar-brand" href="/dashboard" aria-label="Início">
          <Brand tone="on-dark" size={30} />
        </Link>
        <nav aria-label="Navegação principal" ref={navRef} className="side-nav">
          {menu.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`nav-link ${active(link.path) ? "active" : ""}`}
            >
              <link.icon
                size={20}
                weight={active(link.path) ? "fill" : "duotone"}
              />
              {link.label}
              {link.label === "Agenda" && data && (
                <span className="nav-badge">
                  {
                    data.appointments.filter(
                      (a) =>
                        a.status === "confirmed" &&
                        businessDay(a.start) === businessDay(),
                    ).length
                  }
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-business">
            <span
              className={`sidebar-business-mark ${data?.business.logo ? "has-logo" : ""}`}
            >
              {data?.business.logo || data?.business.cover ? (
                <img src={data.business.logo || data.business.cover} alt="" />
              ) : (
                <SegmentIcon
                  category={data?.business.category}
                  size={24}
                  weight="duotone"
                />
              )}
            </span>
            <span className="sidebar-business-name">
              <strong>{data?.business.name || "Seu estabelecimento"}</strong>
              <small>{data?.business.category || "Agenda e gestão"}</small>
            </span>
            <div className="sidebar-business-actions">
              <Link href={`/${slug}`} target="_blank">
                Ver página pública <ArrowUpRight size={13} weight="bold" />
              </Link>
              <button
                type="button"
                onClick={() => void copyLink()}
                aria-label="Copiar link de agendamento"
                title="Copiar link de agendamento"
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
          {hasModule(data?.access?.modules, "recepcao") && (
            <Link className="sidebar-support" href="/tv" target="_blank">
              <Television size={16} /> Modo TV da recepção
            </Link>
          )}
          {data?.viewer?.platformAdmin && (
            <Link className="sidebar-support" href="/admin">
              <Crown size={16} /> Plataforma
            </Link>
          )}
          <button className="sidebar-support" onClick={() => setHelp(true)}>
            <Question size={16} /> Central de ajuda
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Storefront size={13} />
            <span>{data?.mode === "demo" ? "Demonstração" : "Seu espaço"}</span>
            <CaretRight size={11} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <form
              className="top-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(
                  `/dashboard/clientes?q=${encodeURIComponent(search)}`,
                );
              }}
            >
              <MagnifyingGlass size={14} />
              <input
                aria-label="Pesquisar cliente"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <Link href={`/${slug}`} target="_blank" className="my-page">
              <ArrowSquareOut size={13} /> Minha página
            </Link>
            <button
              className="icon-button notification-toggle"
              aria-label="Notificações"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} weight="duotone" />
            </button>
            <span className="topbar-separator" />
            <Link className="top-profile" href="/dashboard/configuracoes">
              <Avatar
                src={
                  data?.mode === "demo"
                    ? data.professionals[1]?.photo
                    : undefined
                }
                name={ownerName}
                size={33}
              />
              <div>
                <strong>{ownerName}</strong>
                <small>{ownerRole}</small>
              </div>
              <CaretDown size={12} color="#a8a5a0" style={{ marginLeft: 6 }} />
            </Link>
          </div>
          {notifications && (
            <Card className="notification-panel">
              <h3>Seu negócio hoje</h3>
              <p>
                {data?.appointments.filter((a) => a.status === "pending")
                  .length || 0}{" "}
                agendamentos aguardam confirmação.
              </p>
              <p>
                {data?.customers.filter(
                  (c) =>
                    c.lastVisit &&
                    (now - new Date(c.lastVisit).getTime()) / 86400000 >
                      (c.returnInterval || 30),
                ).length || 0}{" "}
                clientes podem estar na hora de voltar.
              </p>
              <Link
                href="/dashboard/agenda"
                className="quiet-link"
                onClick={() => setNotifications(false)}
              >
                Ver agenda <CaretRight size={12} />
              </Link>
            </Card>
          )}
        </header>
        <header className="mobile-top">
          <Link className="mobile-top-business" href="/dashboard">
            {data?.business.logo || data?.business.cover ? (
              <Avatar
                src={data.business.logo || data.business.cover}
                name={data.business.name}
                size={30}
              />
            ) : (
              <SegmentIcon
                category={data?.business.category}
                size={18}
                weight="duotone"
              />
            )}
            <span>{data?.business.name || "Seu estabelecimento"}</span>
          </Link>
          <Link href={`/${slug}`}>
            <ArrowSquareOut size={13} /> Sua página
          </Link>
        </header>
        <main className="dashboard-content" key={pathname}>
          {refreshError && (
            <div className="workspace-refresh-message" role="status">
              <span>{refreshError} Seus últimos dados continuam visíveis.</span>
              <button disabled={refreshing} onClick={() => void refresh()}>
                {refreshing ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          )}
          <RenewBanner />
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Menu mobile">
        <Link
          href="/dashboard"
          className={active("/dashboard") ? "active" : ""}
        >
          <House size={24} weight={active("/dashboard") ? "fill" : "regular"} />
          Início
        </Link>
        <Link
          href="/dashboard/agenda"
          className={active("/dashboard/agenda") ? "active" : ""}
        >
          <CalendarBlank
            size={24}
            weight={active("/dashboard/agenda") ? "fill" : "regular"}
          />
          Agenda
        </Link>
        {canMutate("appointments") && (
          <button
            className="mobile-add"
            onClick={() => setCreate(true)}
            aria-label="Novo agendamento"
          >
            <Plus size={24} weight="bold" />
          </button>
        )}
        <Link
          href="/dashboard/clientes"
          className={active("/dashboard/clientes") ? "active" : ""}
        >
          <UsersThree
            size={24}
            weight={active("/dashboard/clientes") ? "fill" : "regular"}
          />
          Clientes
        </Link>
        <button onClick={() => setMore(!more)} aria-label="Mais opções">
          <DotsThree size={24} weight="bold" />
          Mais
        </button>
      </nav>
      {more && (
        <Card className="mobile-more">
          {menu.slice(3).map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setMore(false)}
            >
              <link.icon size={19} weight="duotone" />
              {link.label}
            </Link>
          ))}
          {data?.viewer?.platformAdmin && (
            <Link href="/admin" onClick={() => setMore(false)}>
              <Crown size={19} weight="duotone" /> Plataforma
            </Link>
          )}
          <Link href="/login" onClick={() => setMore(false)}>
            <SignOut size={17} /> Conta
          </Link>
          {data?.mode === "live" && (
            <button
              className="mobile-signout"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <SignOut size={17} />
              {signingOut ? "Saindo…" : "Sair da conta"}
            </button>
          )}
        </Card>
      )}
      <AppointmentForm open={create} onClose={() => setCreate(false)} />
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="Vamos organizar seu dia"
      >
        <div className="help-content">
          <p>
            O StudioFlow conecta sua agenda à página de agendamento do seu
            estabelecimento.
          </p>
          <ol>
            <li>Cadastre serviços e os profissionais que os realizam.</li>
            <li>Configure o expediente e os intervalos da equipe.</li>
            <li>Compartilhe o link público com seus clientes.</li>
            <li>Acompanhe atendimentos e pagamentos pelo painel.</li>
          </ol>
          <div className="support-contact">
            <ShieldCheck
              size={18}
              style={{ verticalAlign: "middle", marginRight: 6 }}
            />{" "}
            As reservas são verificadas no servidor e os dados de cada empresa
            são isolados.
          </div>
        </div>
      </Modal>
    </div>
  );
}
