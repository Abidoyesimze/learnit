import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { requireUser, authFail } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { publicClient, readVerification } from "@/lib/server/identity";
import { CHAIN, RPC_URL } from "@/lib/chain";

/** One-time CELO top-up so a new (embedded) wallet can pay gas for claims and stakes. Verified users only. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const key = process.env.GASDROP_PRIVATE_KEY as `0x${string}` | undefined;
    if (!key) return Response.json({ error: "Top-up is not available right now" }, { status: 503 });
    const v = await readVerification(user.wallet as `0x${string}`);
    if (!v.verified) return Response.json({ error: "Verify with GoodDollar first" }, { status: 403 });

    // Claim the slot atomically so two taps cannot send twice.
    const claimed = await db.user.updateMany({ where: { id: user.id, gasTopupTx: null }, data: { gasTopupTx: "pending" } });
    if (claimed.count === 0) return Response.json({ error: "Already topped up" }, { status: 409 });

    try {
      const amount = parseEther(process.env.GAS_TOPUP_CELO || "0.05");
      const balance = await publicClient.getBalance({ address: user.wallet as `0x${string}` });
      if (balance >= amount) {
        await db.user.update({ where: { id: user.id }, data: { gasTopupTx: "not-needed" } });
        return Response.json({ ok: true, skipped: true });
      }
      const wallet = createWalletClient({ account: privateKeyToAccount(key), chain: CHAIN, transport: http(RPC_URL) });
      const hash = await wallet.sendTransaction({ to: user.wallet as `0x${string}`, value: amount });
      await db.user.update({ where: { id: user.id }, data: { gasTopupTx: hash } });
      return Response.json({ ok: true, txHash: hash });
    } catch (e) {
      await db.user.update({ where: { id: user.id }, data: { gasTopupTx: null } });
      throw e;
    }
  } catch (e) { return authFail(e); }
}
