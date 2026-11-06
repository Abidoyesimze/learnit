import { db } from "../db";
import { publicClient } from "../identity";
import { ADDR, identityAbi } from "../chain";

type DayRow = { day: Date; claims: bigint; claimers: bigint; total: string | null };
type TotalRow = { claims: bigint; claimers: bigint; total: string | null };
type LearnRow = { a1: bigint; a7: bigint; a30: bigint; attempts: bigint; passed: bigint; learners: bigint };

const DAYS = 30;
const TTL_MS = 5 * 60_000;
let cache: { at: number; body: unknown } | null = null;

const n = (r: TotalRow) => ({ claims: Number(r.claims), claimers: Number(r.claimers), total: (r.total ?? "0").split(".")[0] });

/** People with a whitelisted GoodDollar identity, one multicall for everyone. */
async function verifiedCount(wallets: string[]) {
  if (!wallets.length) return 0;
  const res = await publicClient.multicall({
    allowFailure: true,
    contracts: wallets.map((w) => ({ address: ADDR.identity, abi: identityAbi, functionName: "isWhitelisted" as const, args: [w as `0x${string}`] as const })),
  });
  return res.filter((r) => r.status === "success" && r.result === true).length;
}

/**
 * Public, aggregate-only numbers for the dashboard (the GoodDollar team reads this). No names, wallets or per-person rows.
 * Cached for five minutes so a busy dashboard cannot hammer the database or the RPC.
 */
export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) return json(cache.body);

    const [wallets, signups7, days, all, learn] = await Promise.all([
      db.user.findMany({ select: { wallet: true } }),
      db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
      db.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', "claimedAt" AT TIME ZONE 'UTC') AS day,
               COUNT(*) AS claims, COUNT(DISTINCT "userId") AS claimers, SUM(amount::numeric)::text AS total
        FROM ubi_claims WHERE "claimedAt" >= NOW() - ${DAYS} * INTERVAL '1 day' GROUP BY 1 ORDER BY 1 DESC`,
      db.$queryRaw<TotalRow[]>`
        SELECT COUNT(*) AS claims, COUNT(DISTINCT "userId") AS claimers, SUM(amount::numeric)::text AS total FROM ubi_claims`,
      db.$queryRaw<LearnRow[]>`
        SELECT COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - INTERVAL '1 day')  AS a1,
               COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS a7,
               COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS a30,
               COUNT(*) AS attempts, COUNT(*) FILTER (WHERE passed) AS passed,
               COUNT(DISTINCT "userId") FILTER (WHERE passed) AS learners
        FROM lesson_attempts`,
    ]);
    const verified = await verifiedCount(wallets.map((u) => u.wallet)).catch(() => null);
    const rows = days.map((d) => ({ day: d.day.toISOString().slice(0, 10), ...n(d) }));
    const todayKey = new Date().toISOString().slice(0, 10);
    const l = learn[0];
    const body = {
      generatedAt: new Date().toISOString(),
      users: { total: wallets.length, newLast7d: signups7, active1d: Number(l.a1), active7d: Number(l.a7), active30d: Number(l.a30), verified },
      learning: { attempts: Number(l.attempts), passed: Number(l.passed), learnersWithPass: Number(l.learners) },
      ubi: { allTime: n(all[0]), today: rows.find((d) => d.day === todayKey) ?? { claims: 0, claimers: 0, total: "0" }, days: rows },
    };
    cache = { at: Date.now(), body };
    return json(body);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Stats are unavailable right now" }, { status: 503 });
  }
}

const json = (body: unknown) => Response.json(body, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } });
