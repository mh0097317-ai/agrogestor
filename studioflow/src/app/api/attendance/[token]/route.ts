import { z } from "zod";
import { answerAttendance, attendanceView } from "@/services/attendance";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

const answerSchema = z.object({
  answer: z.enum(["in_progress", "completed", "no_show"]),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    return respond(await attendanceView((await params).token));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const { answer } = answerSchema.parse(await request.json());
    return respond(await answerAttendance((await params).token, answer));
  } catch (error) {
    return failure(error);
  }
}
