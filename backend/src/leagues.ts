import type { User } from "@prisma/client";
import { db } from "./db";
import { weekKey } from "./streak";

export const GROUP_SIZE = 30;
export const POINTS_PER_LESSON = 10;
export const POINTS_PER_CHECKPOINT = 30;
export const BONUS_RANKS = 3; // top 3 in a group split a bonus

export const currentWeekKey = () => weekKey(new Date());

function weekRange(key: string): { start: Date; end: Date } {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { start, end };
}

/** Puts a user into this week's league group, first-fit into the lowest group under GROUP_SIZE.
 *  Called only when a learner actually does something this week, so groups reflect active learners. */
export async function ensureMembership(userId: string, key = currentWeekKey()) {
  const existing = await db.leagueMembership.findUnique({ where: { userId_weekKey: { userId, weekKey: key } } });
  if (existing) return existing;
  const counts = await db.leagueMembership.groupBy({ by: ["groupIndex"], where: { weekKey: key }, _count: { _all: true } });
  const open = counts.filter((c) => c._count._all < GROUP_SIZE).sort((a, b) => a.groupIndex - b.groupIndex)[0];
  const groupIndex = open ? open.groupIndex : counts.length ? Math.max(...counts.map((c) => c.groupIndex)) + 1 : 0;
  try {
    return await db.leagueMembership.create({ data: { userId, weekKey: key, groupIndex } });
  } catch {
    // Someone else filled the slot first (or already has a membership) — read back whatever is there now.
    const row = await db.leagueMembership.findUnique({ where: { userId_weekKey: { userId, weekKey: key } } });
    if (row) return row;
    throw new Error("Could not join a league group");
  }
}

/** Points earned this week by each of the given users: 10 per distinct lesson passed, 30 per distinct checkpoint passed. */
export async function pointsForWeek(userIds: string[], key: string): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { start, end } = weekRange(key);
  const rows = await db.lessonAttempt.findMany({
    where: { userId: { in: userIds }, passed: true, createdAt: { gte: start, lt: end } },
    select: { userId: true, lessonId: true, kind: true },
  });
  const seen = new Map<string, Set<string>>();
  const points = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.userId}:${r.kind}:${r.lessonId}`;
    const set = seen.get(r.userId) ?? new Set<string>();
    seen.set(r.userId, set);
    if (set.has(k)) continue;
    set.add(k);
    points.set(r.userId, (points.get(r.userId) ?? 0) + (r.kind === "checkpoint" ? POINTS_PER_CHECKPOINT : POINTS_PER_LESSON));
  }
  for (const id of userIds) if (!points.has(id)) points.set(id, 0);
  return points;
}

export type LeagueRow = { userId: string; wallet: string; points: number; rank: number };

/** The learner's current-week group leaderboard, or null if they haven't joined one yet (no activity this week). */
export async function leaderboardFor(user: User): Promise<{ weekKey: string; groupIndex: number; rows: LeagueRow[]; endsAt: string } | null> {
  const key = currentWeekKey();
  const mine = await db.leagueMembership.findUnique({ where: { userId_weekKey: { userId: user.id, weekKey: key } } });
  if (!mine) return null;
  const members = await db.leagueMembership.findMany({ where: { weekKey: key, groupIndex: mine.groupIndex }, include: { user: { select: { id: true, wallet: true } } } });
  const points = await pointsForWeek(members.map((m) => m.userId), key);
  const rows = members
    .map((m) => ({ userId: m.userId, wallet: m.user.wallet, points: points.get(m.userId) ?? 0 }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return { weekKey: key, groupIndex: mine.groupIndex, rows, endsAt: weekRange(key).end.toISOString() };
}

export { weekRange };
