import { requireUser, authFail } from "../auth";
import { db } from "../db";
import { streakFor } from "../attempts";
import { currentUnitFor } from "../lessons";
import type { Lang } from "../content/schema";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const [passed, recentFails, st] = await Promise.all([
      db.lessonAttempt.findMany({ where: { userId: user.id, passed: true }, select: { lessonId: true, kind: true } }),
      db.lessonAttempt.findMany({ where: { userId: user.id, kind: "checkpoint", passed: false, createdAt: { gte: new Date(Date.now() - 86400_000) } }, orderBy: { createdAt: "desc" }, select: { lessonId: true, createdAt: true } }),
      streakFor(user),
    ]);
    const passedSet = new Set(passed.map((p) => p.lessonId));
    const unit = currentUnitFor((user.course === "es" ? "es" : "fr") as Lang, passedSet);
    const next = unit.lessons.find((l) => !passedSet.has(l.id)) ?? null;
    const allLessons = unit.lessons.every((l) => passedSet.has(l.id));
    const lastFail = recentFails.find((f) => f.lessonId === unit.checkpoint.id);
    const cooldownUntil = lastFail ? new Date(lastFail.createdAt.getTime() + 86400_000).toISOString() : null;
    return Response.json({
      course: user.course, unitTitle: unit.title,
      lessons: unit.lessons.map((l) => ({ id: l.id, title: l.title, theme: l.theme, passed: passedSet.has(l.id), isNext: l.id === next?.id })),
      nextLessonId: next?.id ?? null,
      checkpoint: { id: unit.checkpoint.id, unlocked: allLessons, passed: passedSet.has(unit.checkpoint.id), cooldownUntil },
      streak: st.streak, todayDone: st.todayDone, freezesRemaining: st.freezesRemaining,
    });
  } catch (e) { return authFail(e); }
}
