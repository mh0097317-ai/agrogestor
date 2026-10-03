"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
  LinkSimple,
  Copy,
  Storefront,
  SignOut,
  ArrowUpRight,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { useWorkspace, WorkspaceProvider } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { Avatar, Card, Modal } from "@/components/ui";
import { AppointmentForm } from "@/features/agenda/appointment-form";
import { businessDay } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { SegmentIcon } from "@/lib/segments";
import { Brand } from "@/components/brand";
const links = [
  { path: "/dashboard", label: "Início", icon: House },
  { path: "/dashboard/agenda", label: "Agenda", icon: CalendarBlank },
  { path: "/dashboard/clientes", label: "Clientes", icon: UsersThree },
  { path: "/dashboard/servicos", label: "Serviços", icon: Scissors },
  { path: "/dashboard/equipe", label: "Equipe", icon: IdentificationBadge },
  { path: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  {
    path: "/dashboard/relatorios",
    label: "Relatórios",
    icon: ChartLineUp,
  },
  { path: "/dashboard/configuracoes", label: "Configurações", icon: GearSix },
];
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
        <Link className="sidebar-business" href="/dashboard">
          <span className="sidebar-business-mark">
            {data?.business.logo ? (
              <Avatar
                src={data.business.logo}
                name={data.business.name}
                size={40}
              />
            ) : (
              <SegmentIcon
                category={data?.business.category}
                size={22}
                weight="duotone"
              />
            )}
          </span>
          <span className="sidebar-business-name">
            <strong>{data?.business.name || "Seu estabelecimento"}</strong>
            <small>{data?.business.category || "Agenda e gestão"}</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          {links.map((link) => (
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
          <div className="sidebar-plan">
            <div className="sidebar-plan-title">
              <LinkSimple size={14} /> Seu link de agendamento
            </div>
            <p>Divulgue para seus clientes marcarem sozinhos.</p>
            <div className="sidebar-plan-actions">
              <button onClick={() => void copyLink()}>
                <Copy size={13} /> Copiar
              </button>
              <Link href={`/${slug}`} target="_blank">
                Abrir <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
          <button className="sidebar-support" onClick={() => setHelp(true)}>
            <Question size={16} /> Central de ajuda
          </button>
          <div className="sidebar-foot">
            <Brand tone="on-dark" size={26} />
          </div>
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
              <CaretDown size={12} color="#99a7b8" style={{ marginLeft: 6 }} />
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
            <SegmentIcon
              category={data?.business.category}
              size={18}
              weight="duotone"
            />
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
          {links.slice(3).map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setMore(false)}
            >
              <link.icon size={19} weight="duotone" />
              {link.label}
            </Link>
          ))}
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
