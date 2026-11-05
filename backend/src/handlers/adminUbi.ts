import { isAddress, keccak256, toBytes, verifyMessage, zeroHash } from "viem";
import { authFail } from "../auth";
import { db } from "../db";
import { publicClient } from "../identity";
import { ADDR } from "../chain";
import { streakVaultAbi } from "../abis";

const GUARDIAN = keccak256(toBytes("GUARDIAN_ROLE"));
const DAYS = 30;

/** Allowed = on ADMIN_VIEWER_ADDRESSES, or holds the admin/guardian role on the StreakVault (checked on-chain, so the page's gate is not the only one). */
async function isAdmin(wallet: `0x${string}`) {
  // Read-only viewers (e.g. the signer wallet) are allowed by env, without any on-chain role.
  const viewers = (process.env.ADMIN_VIEWER_ADDRESSES ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (viewers.includes(wallet.toLowerCase())) return true;
  if (!ADDR.streakVault) return false;
  const [admin, guardian] = await Promise.all([
    publicClient.readContract({ address: ADDR.streakVault, abi: streakVaultAbi, functionName: "hasRole", args: [zeroHash, wallet] }),
    publicClient.readContract({ address: ADDR.streakVault, abi: streakVaultAbi, functionName: "hasRole", args: [GUARDIAN, wallet] }),
  ]);
  return admin || guardian;
}

type DayRow = { day: Date; claims: bigint; claimers: bigint; total: string | null };
type TotalRow = { claims: bigint; claimers: bigint; total: string | null };

/** G$ claimed through LearnIt (claims the app recorded), per UTC day for the last 30 days plus all-time. Amounts are wei strings. */
export async function GET(req: Request) {
  try {
    // The admin page has no Privy login: the wallet signs "LearnIt admin <ms timestamp>", valid for 5 minutes.
    const addr = req.headers.get("x-admin-address") ?? "";
    const ts = Number(req.headers.get("x-admin-ts"));
    const sig = req.headers.get("x-admin-sig") ?? "";
    if (!isAddress(addr) || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000 || !sig.startsWith("0x"))
      return Response.json({ error: "Sign in with your wallet" }, { status: 401 });
    const signed = await verifyMessage({ address: addr, message: `LearnIt admin ${ts}`, signature: sig as `0x${string}` }).catch(() => false);
    if (!signed) return Response.json({ error: "Bad signature" }, { status: 401 });
    if (!(await isAdmin(addr))) return Response.json({ error: "Not an admin" }, { status: 403 });

    const [days, all, today] = await Promise.all([
      db.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', "claimedAt" AT TIME ZONE 'UTC') AS day,
               COUNT(*) AS claims, COUNT(DISTINCT "userId") AS claimers,
               SUM(amount::numeric)::text AS total
        FROM ubi_claims
        WHERE "claimedAt" >= NOW() - ${DAYS} * INTERVAL '1 day'
        GROUP BY 1 ORDER BY 1 DESC`,
      db.$queryRaw<TotalRow[]>`
        SELECT COUNT(*) AS claims, COUNT(DISTINCT "userId") AS claimers, SUM(amount::numeric)::text AS total FROM ubi_claims`,
      db.$queryRaw<TotalRow[]>`
        SELECT COUNT(*) AS claims, COUNT(DISTINCT "userId") AS claimers, SUM(amount::numeric)::text AS total
        FROM ubi_claims WHERE "claimedAt" >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    ]);
    const n = (r: TotalRow) => ({ claims: Number(r.claims), claimers: Number(r.claimers), total: (r.total ?? "0").split(".")[0] });
    return Response.json({
      allTime: n(all[0]),
      today: n(today[0]),
      days: days.map((d) => ({ day: d.day.toISOString().slice(0, 10), ...n(d) })),
    });
  } catch (e) {
    return authFail(e);
  }
}
