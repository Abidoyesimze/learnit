// Writes and reads back one row in each table the app uses, then cleans up. Run: npx tsx --env-file=.env scripts/neon-check.mts
import { db } from "../src/db";
import { streakCount } from "../src/streak";

const tag = `check-${Date.now()}`;
const user = await db.user.create({ data: { privyUserId: tag, wallet: `0x${tag.padEnd(40, "0").slice(0, 40)}` } });
try {
  await db.ubiClaim.create({ data: { userId: user.id, txHash: `0x${tag}`, amount: "1000" } });
  const a = await db.lessonAttempt.create({ data: { userId: user.id, lessonId: "fr-a1-u1-l1", score: 0.9, durationS: 120, passed: true, localDate: "2026-11-03", startKey: tag } });
  await db.streakDay.create({ data: { userId: user.id, date: "2026-11-03" } });
  await db.voucher.create({ data: { root: user.wallet, amount: "500", nonce: tag, expiry: 1, reason: "lesson", sourceId: a.id, signature: "0x" } });
  await db.cohort.upsert({ where: { id: 999999 }, create: { id: 999999, startAt: new Date(), endAt: new Date(), minStake: "1", maxStake: "2" }, update: {} });
  await db.stake.create({ data: { cohortId: 999999, userId: user.id, amountReceived: "1" } });
  const days = await db.streakDay.findMany({ where: { userId: user.id } });
  console.log("round trip ok:", { streak: streakCount(days.map((d) => d.date), "2026-11-03"), attempts: await db.lessonAttempt.count({ where: { userId: user.id } }), stakes: await db.stake.count({ where: { userId: user.id } }) });
} finally {
  await db.stake.deleteMany({ where: { userId: user.id } });
  await db.cohort.deleteMany({ where: { id: 999999 } });
  await db.voucher.deleteMany({ where: { nonce: tag } });
  await db.streakDay.deleteMany({ where: { userId: user.id } });
  await db.lessonAttempt.deleteMany({ where: { userId: user.id } });
  await db.ubiClaim.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  console.log("cleaned up, user rows left:", await db.user.count({ where: { privyUserId: tag } }));
  await db.$disconnect();
}
