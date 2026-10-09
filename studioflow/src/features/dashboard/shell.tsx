"use client";
import "./experience.css";
import "./modules.css";
import { onlineBookingEnabled } from "@/lib/online-booking";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useLayoutEffect,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import {
  ArrowSquareOut,
  ArrowUpRight,
  Bell,
  CalendarDots,
  CaretDown,
  CaretRight,
  ChartLineUp,
  ChatCircleDots,
  Copy,
  Crown,
  DotsThree,
  GearSix,
  MagnifyingGlass,
  Megaphone,
  Money,
  Plus,
  Question,
  Scissors,
  ShieldCheck,
  ShoppingBagOpen,
  SignOut,
  SquaresFour,
  Storefront,
  Television,
  UserCircleGear,
  UsersThree,
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
import { FeePayment } from "./fee-payment";
import { daysLeft } from "@/lib/access";
import { hasModule, type ModuleKey } from "@/lib/modules";
import { format } from "date-fns";
const links = [
  { path: "/dashboard", label: "Início", icon: SquaresFour },
  { path: "/dashboard/agenda", label: "Agenda", icon: CalendarDots },
  { path: "/dashboard/clientes", label: "Clientes", icon: UsersThree },
  {
    path: "/dashboard/conversas",
    label: "Conversas",
    icon: ChatCircleDots,
    module: "recepcionista" as ModuleKey,
  },
  { path: "/dashboard/servicos", label: "Serviços", icon: Scissors },
  {
    path: "/dashboard/produtos",
    label: "Produtos",
    icon: ShoppingBagOpen,
    module: "produtos" as ModuleKey,
  },
  { path: "/dashboard/equipe", label: "Equipe", icon: UserCircleGear },
  { path: "/dashboard/financeiro", label: "Financeiro", icon: Money },
  {
    path: "/dashboard/clube",
    label: "Clube",
    icon: Crown,
    module: "clube" as ModuleKey,
  },
  {
    path: "/dashboard/relatorios",
    label: "Relatórios",
    icon: ChartLineUp,
  },
  { path: "/dashboard/divulgar", label: "Divulgar", icon: Megaphone },
  { path: "/dashboard/configuracoes", label: "Configurações", icon: GearSix },
];
const navigationGroups: Record<string, string> = {
  "/dashboard": "Dia a dia",
  "/dashboard/agenda": "Dia a dia",
  "/dashboard/clientes": "Dia a dia",
  "/dashboard/conversas": "Dia a dia",
  "/dashboard/servicos": "Seu negócio",
  "/dashboard/produtos": "Seu negócio",
  "/dashboard/equipe": "Seu negócio",
  "/dashboard/financeiro": "Seu negócio",
  "/dashboard/relatorios": "Seu negócio",
  "/dashboard/clube": "Crescimento",
  "/dashboard/divulgar": "Crescimento",
  "/dashboard/configuracoes": "Preferências",
};
const navigationOrder = [
  "Dia a dia",
  "Seu negócio",
  "Crescimento",
  "Preferências",
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
  const { data, refresh } = useWorkspace();
  const { toast } = useToast();
  const [paying, setPaying] = useState(false);
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
      {access.price ? (
        <button type="button" onClick={() => setPaying(true)}>
          Pagar agora
        </button>
      ) : (
        support && (
          <a
            href={`https://wa.me/${support}?text=${encodeURIComponent(ask)}`}
            target="_blank"
            rel="noreferrer"
          >
            Falar com o StudioFlow
          </a>
        )
      )}
      <Modal
        open={paying}
        onClose={() => setPaying(false)}
        title="Mensalidade StudioFlow"
        description="Pague no Pix, boleto ou cartão. Quando o pagamento cair, o acesso renova sozinho."
      >
        {paying && (
          <FeePayment
            demo={data.mode === "demo"}
            onPaid={async () => {
              toast("Pagamento recebido. Seu acesso foi renovado.");
              await refresh();
            }}
          />
        )}
      </Modal>
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
      (data?.viewer?.role !== "professional" ||
        [
          "/dashboard",
          "/dashboard/agenda",
          "/dashboard/clientes",
          "/dashboard/conversas",
          "/dashboard/configuracoes",
        ].includes(link.path)) &&
      (!("module" in link && link.module) ||
        (!!data && hasModule(data.access?.modules, link.module))),
  );
  const ownerName = data?.viewer?.name || "Seu perfil";
  const mobileInbox = menu.some((link) => link.path === "/dashboard/conversas");
  const mobileContactPath = mobileInbox
    ? "/dashboard/conversas"
    : "/dashboard/clientes";
  const ownerRole =
    data?.viewer?.role === "owner"
      ? "Proprietário"
      : data?.viewer?.role === "admin"
        ? "Administrador"
        : "Equipe";
  const slug = data?.business.slug || "barber-011";
  const online = !!data && onlineBookingEnabled(data.settings);
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
      className={`app-shell ${pathname === "/dashboard/conversas" ? "is-conversations" : ""}`}
      data-home={pathname === "/dashboard" ? "" : undefined}
    >
      <aside className="sidebar">
        <Link className="sidebar-brand" href="/dashboard" aria-label="Início">
          <Brand tone="on-dark" size={30} />
        </Link>
        <nav aria-label="Navegação principal" ref={navRef} className="side-nav">
          {[...menu]
            .sort(
              (a, b) =>
                navigationOrder.indexOf(navigationGroups[a.path]) -
                navigationOrder.indexOf(navigationGroups[b.path]),
            )
            .map((link, index, visible) => (
              <Fragment key={link.path}>
                {(index === 0 ||
                  navigationGroups[link.path] !==
                    navigationGroups[visible[index - 1].path]) && (
                  <span className="nav-section-label">
                    {navigationGroups[link.path]}
                  </span>
                )}
                <Link
                  key={link.path}
                  href={link.path}
                  className={`nav-link ${active(link.path) ? "active" : ""}`}
                  aria-current={active(link.path) ? "page" : undefined}
                >
                  <link.icon
                    size={20}
                    weight={active(link.path) ? "fill" : "regular"}
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
              </Fragment>
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
              {online ? (
                <>
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
                </>
              ) : (
                <Link href="/dashboard/configuracoes?aba=onlineBooking">
                  Agendamento online desativado
                </Link>
              )}
            </div>
          </div>
          {data && hasModule(data.access?.modules, "recepcao") && (
            <Link className="sidebar-support" href="/tv" target="_blank">
              <Television size={16} /> Modo TV da recepção
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
            <Link
              href={
                online
                  ? `/${slug}`
                  : "/dashboard/configuracoes?aba=onlineBooking"
              }
              target={online ? "_blank" : undefined}
              className="my-page"
            >
              <ArrowSquareOut size={13} />{" "}
              {online ? "Minha página" : "Agendamento online desativado"}
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
          <Link
            href={
              online ? `/${slug}` : "/dashboard/configuracoes?aba=onlineBooking"
            }
          >
            <ArrowSquareOut size={13} />{" "}
            {online ? "Sua página" : "Online desativado"}
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
          <SquaresFour
            size={24}
            weight={active("/dashboard") ? "fill" : "regular"}
          />
          Início
        </Link>
        <Link
          href="/dashboard/agenda"
          className={active("/dashboard/agenda") ? "active" : ""}
        >
          <CalendarDots
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
          href={mobileContactPath}
          className={active(mobileContactPath) ? "active" : ""}
        >
          {mobileInbox ? (
            <ChatCircleDots
              size={24}
              weight={active(mobileContactPath) ? "fill" : "regular"}
            />
          ) : (
            <UsersThree
              size={24}
              weight={active(mobileContactPath) ? "fill" : "regular"}
            />
          )}
          {mobileInbox ? "Conversas" : "Clientes"}
        </Link>
        <button onClick={() => setMore(!more)} aria-label="Mais opções">
          <DotsThree size={24} weight="bold" />
          Mais
        </button>
      </nav>
      {more && (
        <Card className="mobile-more">
          {menu
            .filter(
              (link) =>
                ![
                  "/dashboard",
                  "/dashboard/agenda",
                  mobileContactPath,
                ].includes(link.path),
            )
            .map((link) => (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setMore(false)}
              >
                <link.icon size={20} weight="regular" />
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
            <li>
              {online
                ? "Compartilhe o link público com seus clientes."
                : "O agendamento online está desativado. Agende normalmente pelo painel."}
            </li>
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
