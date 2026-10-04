import { depositStatus } from "@/services/server-payments";
import { tokenSchema } from "@/services/server-validation";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/**
 * Deposit of one booking. `pix=1` adds the QR code and copy-paste code;
 * `check=1` asks the provider when the notification has not arrived.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const token = tokenSchema.parse((await params).token);
    const query = new URL(request.url).searchParams;
    return respond(
      await depositStatus(token, {
        pix: query.get("pix") === "1",
        check: query.get("check") === "1",
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
