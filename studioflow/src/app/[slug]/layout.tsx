import type { Metadata, Viewport } from "next";
import { HandoffLayer } from "@/features/booking/intro-handoff";
import { AppManifest } from "@/features/public/app-manifest";
import { businessApp } from "@/services/business-app";

type Props = { params: Promise<{ slug: string }> };

/** Página de cada casa instalável como app próprio (nome, ícone e cor da casa). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const app = await businessApp(slug);
  if (!app) return {};
  return {
    manifest: `/${slug}/manifest.webmanifest`,
    applicationName: app.name,
    appleWebApp: { capable: true, title: app.name, statusBarStyle: "default" },
    icons: { apple: `/${slug}/app-icon/180` },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const app = await businessApp(slug);
  return app ? { themeColor: app.color } : {};
}

/** The opening that starts on the page and ends on the booking lives here. */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <AppManifest slug={slug} />
      {children}
      <HandoffLayer />
    </>
  );
}
