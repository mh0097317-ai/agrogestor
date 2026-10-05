import { publicInstagramFeed } from "@/services/instagram-feed";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Perfil e posts recentes do Instagram da casa (só o que já é público). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    return respond(await publicInstagramFeed((await params).slug));
  } catch (error) {
    return failure(error);
  }
}
