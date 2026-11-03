import type { User } from "@prisma/client";
import type { Exercise } from "./content/schema";
import { db } from "./db";
import { readStart, type Start } from "./token";
import { gradeAll, isPass, MIN_SECONDS, type Answer } from "./grading";
import { localDate, streakCount, freezeGapDate, FREEZE_MILESTONE_DAYS, FREEZE_CAP } from "./streak";
import { issueVoucher, publicVoucher } from "./vouchers";
import { detectAnomaly } from "./abuse";
import { ensureMembership } from "./leagues";

export async function streakFor(user: User) {
  const today = localDate(new Date(), user.timezone);
  const days = await db.streakDay.findMany({ where: { userId: user.id }, select: { date: true } });
  let dates = days.map((d) => d.date);

  const gap = user.streakFreezes > 0 ? freezeGapDate(dates, today) : null;
  if (gap) {
    await db.$transaction([
      db.streakDay.create({ data: { userId: user.id, date: gap, frozen: true } }),
      db.user.update({ where: { id: user.id }, data: { streakFreezes: { decrement: 1 } } }),
    ]);
    dates = [...dates, gap];
  }
  return { streak: streakCount(dates, today), todayDone: dates.includes(today), today, freezesRemaining: user.streakFreezes - (gap ? 1 : 0) };
}

export class SubmitError extends Error { constructor(m: string, public status = 400) { super(m); } }

/** Grades on the server, records the attempt, ticks the streak on a pass. */
export async function submitAttempt(opts: {
  user: User; kind: "lesson" | "checkpoint"; targetId: string; token: string;
  answers: Record<string, Answer>; exercises: (start: Start) => Exercise[];
}) {
  const start = readStart(opts.token);
  if (!start || start.userId !== opts.user.id || start.kind !== opts.kind || start.targetId !== opts.targetId) throw new SubmitError("Invalid start token");
  const now = Date.now();
  if (now - start.startedAt > 6 * 3600_000) throw new SubmitError("This attempt expired. Start again.");
  const durationS = Math.floor((now - start.startedAt) / 1000);
  const exercises = opts.exercises(start);
  const { results, accuracy, missedWordIds } = gradeAll(exercises, opts.answers);
  const passed = isPass(accuracy, durationS);
  const key = `${opts.user.id}:${opts.targetId}:${start.startedAt}`;
  if (await db.lessonAttempt.findUnique({ where: { startKey: key } })) throw new SubmitError("Already submitted", 409);

  const date = localDate(new Date(), opts.user.timezone);
  const firstCheckpointPass = opts.kind === "checkpoint" && passed
    ? !(await db.lessonAttempt.findFirst({ where: { userId: opts.user.id, lessonId: opts.targetId, kind: "checkpoint", passed: true } }))
    : false;
  const attempt = await db.lessonAttempt.create({
    data: { userId: opts.user.id, lessonId: opts.targetId, kind: opts.kind, score: accuracy, durationS, passed, localDate: date, startKey: key },
  });

  let reviewPending = false;
  if (passed) {
    const existedToday = await db.streakDay.findUnique({ where: { userId_date: { userId: opts.user.id, date } } });
    await db.streakDay.upsert({ where: { userId_date: { userId: opts.user.id, date } }, create: { userId: opts.user.id, date }, update: {} });
    await ensureMembership(opts.user.id).catch((e) => console.error("league membership", e));

    const recent = await db.lessonAttempt.findMany({ where: { userId: opts.user.id, passed: true }, orderBy: { createdAt: "desc" }, take: 3, select: { durationS: true, score: true, createdAt: true } });
    const flag = detectAnomaly(recent);
    if (flag) {
      await db.abuseFlag.create({ data: { userId: opts.user.id, attemptId: attempt.id, reason: flag } });
      await db.user.update({ where: { id: opts.user.id }, data: { flagged: true } });
      reviewPending = true;
    }

    if (!existedToday) {
      const st = await streakFor(opts.user);
      if (st.streak > 0 && st.streak % FREEZE_MILESTONE_DAYS === 0) {
        await db.user.updateMany({ where: { id: opts.user.id, streakFreezes: { lt: FREEZE_CAP } }, data: { streakFreezes: { increment: 1 } } });
      }
    }
  }
  const st = await streakFor(opts.user);
  const voucher = passed && !reviewPending ? await issueVoucher(opts.user, attempt, firstCheckpointPass).catch((e) => { console.error("voucher", e); return null; }) : null;
  return {
    attemptId: attempt.id, passed, accuracy, durationS, minSeconds: MIN_SECONDS, missedWordIds,
    tooFast: accuracy >= 0.8 && durationS < MIN_SECONDS,
    results: results.map((r) => ({ id: r.id, correct: r.correct })),
    firstCheckpointPass, streak: st.streak, reviewPending,
    voucher: voucher ? publicVoucher(voucher) : null,
  };
}
