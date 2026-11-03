import type { User } from "@prisma/client";
import type { Exercise } from "@/content/schema";
import { db } from "./db";
import { readStart, type Start } from "./token";
import { gradeAll, isPass, MIN_SECONDS, type Answer } from "@/lib/grading";
import { localDate, streakCount } from "@/lib/streak";
import { issueVoucher, publicVoucher } from "./vouchers";

export async function streakFor(user: User) {
  const days = await db.streakDay.findMany({ where: { userId: user.id }, select: { date: true } });
  const today = localDate(new Date(), user.timezone);
  const dates = days.map((d) => d.date);
  return { streak: streakCount(dates, today), todayDone: dates.includes(today), today };
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
  if (passed) await db.streakDay.upsert({ where: { userId_date: { userId: opts.user.id, date } }, create: { userId: opts.user.id, date }, update: {} });
  const st = await streakFor(opts.user);
  const voucher = passed ? await issueVoucher(opts.user, attempt, firstCheckpointPass).catch((e) => { console.error("voucher", e); return null; }) : null;
  return {
    attemptId: attempt.id, passed, accuracy, durationS, minSeconds: MIN_SECONDS, missedWordIds,
    tooFast: accuracy >= 0.8 && durationS < MIN_SECONDS,
    results: results.map((r) => ({ id: r.id, correct: r.correct })),
    firstCheckpointPass, streak: st.streak,
    voucher: voucher ? publicVoucher(voucher) : null,
  };
}
