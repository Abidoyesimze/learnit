// After a league week ends: rank each group, pay the top 3 a G$ bonus.
//   npx tsx --env-file=.env scripts/finalize-league.mts <weekKey>          (dry run, prints the plan)
//   npx tsx --env-file=.env scripts/finalize-league.mts <weekKey> --send   (signs and records bonus vouchers)
// weekKey is the Monday the week started, e.g. 2026-10-27. Defaults to last week if omitted.
// SIGNER_PRIVATE_KEY must be set (same key that signs lesson/checkpoint vouchers).
import { db } from "../src/db";
import { weekKey } from "../src/streak";
import { pointsForWeek, BONUS_RANKS } from "../src/leagues";
import { rewardConfig, issueLeagueVoucher } from "../src/vouchers";
import { readVerification } from "../src/identity";

const send = process.argv.includes("--send");
const argKey = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const key = argKey ?? weekKey(new Date(Date.now() - 7 * 86400_000));

const now = Date.now() / 1000;
const start = new Date(`${key}T00:00:00.000Z`).getTime() / 1000;
if (now < start + 7 * 86400) throw new Error(`Week ${key} has not ended yet`);

const already = await db.leagueBonus.findFirst({ where: { weekKey: key } });
if (already) throw new Error(`Week ${key} is already settled`);

const groups = await db.leagueMembership.groupBy({ by: ["groupIndex"], where: { weekKey: key } });
console.log(`Week ${key}: ${groups.length} group(s)`);

const bonus = rewardConfig().leagueBonus;
let total = 0;
for (const g of groups) {
  const members = await db.leagueMembership.findMany({ where: { weekKey: key, groupIndex: g.groupIndex }, include: { user: true } });
  const points = await pointsForWeek(members.map((m) => m.userId), key);
  const ranked = members
    .map((m) => ({ user: m.user, points: points.get(m.userId) ?? 0 }))
    .sort((a, b) => b.points - a.points)
    .slice(0, BONUS_RANKS);

  console.log(`\nGroup ${g.groupIndex} (${members.length} members):`);
  for (let i = 0; i < ranked.length; i++) {
    const { user, points: pts } = ranked[i];
    if (pts === 0) { console.log(`  #${i + 1} ${user.wallet} 0 pts, skipped`); continue; }
    console.log(`  #${i + 1} ${user.wallet} ${pts} pts`);
    total++;
    if (!send) continue;

    const v = await readVerification(user.wallet as `0x${string}`);
    if (!v.verified || !v.root) { console.log("    not verified, skipped"); continue; }
    const bonusRow = await db.leagueBonus.create({ data: { userId: user.id, weekKey: key, groupIndex: g.groupIndex, rank: i + 1, amount: bonus[i].toString() } });
    const voucher = await issueLeagueVoucher(v.root, bonus[i], bonusRow.id);
    console.log(voucher ? `    voucher ${voucher.id}` : "    could not sign voucher (SIGNER_PRIVATE_KEY or rewards pool address missing)");
  }
}

console.log(`\n${total} bonus${total === 1 ? "" : "es"} across ${groups.length} group(s).`);
if (!send) console.log("Dry run. Add --send to issue vouchers.");
await db.$disconnect();
