import { requireUser, authFail } from "../auth";
import { readVerificationCached as readVerification } from "../identity";
import { refreshVouchers, earnedTodayUtc, rewardConfig, publicVoucher } from "../vouchers";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const v = await readVerification(user.wallet as `0x${string}`);
    const cfg = rewardConfig();
    if (!v.verified || !v.root) return Response.json({ verified: false, vouchers: [], earnedToday: "0", dailyCap: cfg.dailyCap.toString(), capRemaining: "0" });
    const [live, earned] = await Promise.all([refreshVouchers(v.root), earnedTodayUtc(v.root)]);
    const rem = cfg.dailyCap > earned ? cfg.dailyCap - earned : 0n;
    return Response.json({ verified: true, vouchers: live.map(publicVoucher), earnedToday: earned.toString(), dailyCap: cfg.dailyCap.toString(), capRemaining: rem.toString() });
  } catch (e) { return authFail(e); }
}
