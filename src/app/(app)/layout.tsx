import { requireSession } from "@/modules/auth/guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar nome={session.nome} perfil={session.perfil} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar nome={session.nome} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-24 pt-6 lg:px-7 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
