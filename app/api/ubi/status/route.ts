import { requireUser, authFail } from "@/lib/server/auth";
import { readUbiStatus } from "@/lib/server/ubi";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const [status, last] = await Promise.all([
      readUbiStatus(user.wallet as `0x${string}`),
      db.ubiClaim.findFirst({ where: { userId: user.id }, orderBy: { claimedAt: "desc" } }),
    ]);
    return Response.json({ ...status, lastClaimTx: last?.txHash ?? null });
  } catch (e) {
    return authFail(e);
  }
}
