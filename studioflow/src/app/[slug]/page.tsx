import { PublicPage } from "@/features/public/public-page";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicPage slug={slug} />;
}
