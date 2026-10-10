import { renderSlideJpeg } from "@/services/marketing/render";
import { marketingPostForImage } from "@/services/marketing/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Arte de uma tela do post, em JPEG. Pública porque a Meta busca a imagem
 * pelo link na hora de publicar; o id é aleatório e o conteúdo vai ser público.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; slide: string }> },
) {
  const { id, slide } = await params;
  const index = Number(/^(\d{1,2})(?:\.jpg)?$/.exec(slide)?.[1] ?? -1);
  const post = index >= 0 ? await marketingPostForImage(id) : null;
  if (!post || post.status === "discarded" || post.format === "reel")
    return new Response("not found", { status: 404 });
  const jpeg = await renderSlideJpeg(post.slides, index, post.format);
  if (!jpeg) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=300, s-maxage=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
