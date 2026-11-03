import { requireUser, authFail } from "../auth";
import { readUbiStatus } from "../ubi";
import { db } from "../db";

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
