import type { Metadata, Viewport } from "next";
import { HandoffLayer } from "@/features/booking/intro-handoff";
import { AppManifest } from "@/features/public/app-manifest";
import { businessApp } from "@/services/business-app";
import { appUrl } from "@/lib/app-url";

type Props = { params: Promise<{ slug: string }> };

/** Página de cada casa instalável como app próprio (nome, ícone e cor da casa). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const app = await businessApp(slug);
  if (!app) return {};
  // A shared link shows the shop, not StudioFlow.
  const title = `${app.name} · Agende online`;
  const description =
    app.description || `Veja os serviços e agende seu horário na ${app.name}.`;
  const image = /^(https?:)?\//.test(app.cover) ? app.cover : undefined;
  return {
    metadataBase: new URL(appUrl),
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: `/${slug}`,
      siteName: app.name,
      locale: "pt_BR",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
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
