export const dynamic = "force-dynamic";
import { PublicPage } from "@/features/public/public-page";
import { publicCatalog } from "@/services/public-catalog";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Rendered with the data: no loading screen. Errors fall back to the client.
  const catalog = await publicCatalog(slug).catch(() => null);
  return <PublicPage slug={slug} initialCatalog={catalog} />;
}
