"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserRound,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  ExternalLink,
  Plus,
  Ellipsis,
  HelpCircle,
  Sparkles,
  Store as StoreIcon,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace, WorkspaceProvider } from "@/hooks/use-workspace";
import { Avatar, Card, Modal } from "@/components/ui";
import { AppointmentForm } from "@/features/agenda/appointment-form";
import { businessDay } from "@/lib/utils";
import { useToast } from "@/components/toast";
const links = [
  { path: "/dashboard", label: "Início", icon: LayoutDashboard },
  { path: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { path: "/dashboard/clientes", label: "Clientes", icon: Users },
  { path: "/dashboard/servicos", label: "Serviços", icon: Scissors },
  { path: "/dashboard/equipe", label: "Equipe", icon: UserRound },
  { path: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  {
    path: "/dashboard/relatorios",
    label: "Relatórios",
    icon: ChartNoAxesCombined,
  },
  { path: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];
function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="23" height="25" viewBox="0 0 24 26" fill="none">
        <path
          d="M18 5H10a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8H6"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const { data, refresh, refreshing, refreshError } = useWorkspace();
  const { toast } = useToast();
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
  const ownerName = data?.viewer?.name || "Seu perfil";
  const ownerRole =
    data?.viewer?.role === "owner"
      ? "Proprietário"
      : data?.viewer?.role === "admin"
        ? "Administrador"
        : "Equipe";
  const slug = data?.business.slug || "barber-011";
  const active = (path: string) =>
    path === "/dashboard" ? pathname === path : pathname.startsWith(path);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <BrandMark />
          <span className="brand-wordmark">
            studioflow<small>GESTÃO PARA BELEZA</small>
          </span>
        </Link>
        <Link href="/dashboard/configuracoes" className="business-switch">
          <div className="business-icon">
            <StoreIcon size={17} />
          </div>
          <div>
            <strong>{data?.business.name || "SEU ESTABELECIMENTO"}</strong>
            <small>{data?.business.category || "Seu espaço de beleza"}</small>
          </div>
          <ChevronRight size={13} />
        </Link>
        <p className="sidebar-caption">SEU NEGÓCIO</p>
        <nav aria-label="Navegação principal">
          {links.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`nav-link ${active(link.path) ? "active" : ""}`}
            >
              <link.icon strokeWidth={1.7} />
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
          <div className="sidebar-plan">
            <div className="sidebar-plan-title">
              <Sparkles size={13} /> Seu negócio em boa fase
            </div>
            <p>
              Mais organização. Mais tempo
              <br />
              para fazer o que você ama.
            </p>
            <Link href={`/${slug}`} target="_blank">
              Conheça sua página <ArrowUpRight size={12} />
            </Link>
          </div>
          <button className="sidebar-support" onClick={() => setHelp(true)}>
            <HelpCircle size={16} /> Central de ajuda
          </button>
          <div className="sidebar-foot">
            <span>Agenda e gestão</span>
            <span>StudioFlow</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <StoreIcon size={13} />
            <span>{data?.mode === "demo" ? "Demonstração" : "Seu espaço"}</span>
            <ChevronRight size={11} />
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
              <Search size={14} />
              <input
                aria-label="Pesquisar cliente"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <Link href={`/${slug}`} target="_blank" className="my-page">
              <ExternalLink size={13} /> Minha página
            </Link>
            <button
              className="icon-button notification-toggle"
              aria-label="Notificações"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={17} />
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
              <ChevronDown
                size={12}
                color="#99a7b8"
                style={{ marginLeft: 6 }}
              />
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
                Ver agenda <ChevronRight size={12} />
              </Link>
            </Card>
          )}
        </header>
        <header className="mobile-top">
          <Link className="brand" href="/dashboard">
            <BrandMark />
            <span className="brand-wordmark">studioflow</span>
          </Link>
          <Link href={`/${slug}`}>
            <ExternalLink size={13} /> Sua página
          </Link>
        </header>
        <main className="dashboard-content">
          {refreshError && (
            <div className="workspace-refresh-message" role="status">
              <span>{refreshError} Seus últimos dados continuam visíveis.</span>
              <button disabled={refreshing} onClick={() => void refresh()}>
                {refreshing ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Menu mobile">
        <Link
          href="/dashboard"
          className={active("/dashboard") ? "active" : ""}
        >
          <LayoutDashboard />
          Início
        </Link>
        <Link
          href="/dashboard/agenda"
          className={active("/dashboard/agenda") ? "active" : ""}
        >
          <CalendarDays />
          Agenda
        </Link>
        <button
          className="mobile-add"
          onClick={() => setCreate(true)}
          aria-label="Novo agendamento"
        >
          <Plus />
        </button>
        <Link
          href="/dashboard/clientes"
          className={active("/dashboard/clientes") ? "active" : ""}
        >
          <Users />
          Clientes
        </Link>
        <button onClick={() => setMore(!more)} aria-label="Mais opções">
          <Ellipsis />
          Mais
        </button>
      </nav>
      {more && (
        <Card className="mobile-more">
          {links.slice(3).map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setMore(false)}
            >
              <link.icon size={17} />
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setMore(false)}>
            <LogOut size={17} /> Conta
          </Link>
          {data?.mode === "live" && (
            <button
              className="mobile-signout"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
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
