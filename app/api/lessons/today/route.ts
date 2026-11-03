import { requireUser, authFail } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { streakFor } from "@/lib/server/attempts";
import { UNITS } from "@/lib/content";
import type { Lang } from "@/content/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const unit = UNITS[(user.course === "es" ? "es" : "fr") as Lang];
    const passed = await db.lessonAttempt.findMany({ where: { userId: user.id, passed: true }, select: { lessonId: true, kind: true } });
    const passedSet = new Set(passed.map((p) => p.lessonId));
    const next = unit.lessons.find((l) => !passedSet.has(l.id)) ?? null;
    const allLessons = unit.lessons.every((l) => passedSet.has(l.id));
    const lastFail = await db.lessonAttempt.findFirst({ where: { userId: user.id, lessonId: unit.checkpoint.id, passed: false }, orderBy: { createdAt: "desc" } });
    const cooldownUntil = lastFail && Date.now() - lastFail.createdAt.getTime() < 86400_000 ? new Date(lastFail.createdAt.getTime() + 86400_000).toISOString() : null;
    const st = await streakFor(user);
    return Response.json({
      course: user.course, unitTitle: unit.title,
      lessons: unit.lessons.map((l) => ({ id: l.id, title: l.title, theme: l.theme, passed: passedSet.has(l.id), isNext: l.id === next?.id })),
      nextLessonId: next?.id ?? null,
      checkpoint: { id: unit.checkpoint.id, unlocked: allLessons, passed: passedSet.has(unit.checkpoint.id), cooldownUntil },
      streak: st.streak, todayDone: st.todayDone,
    });
  } catch (e) { return authFail(e); }
}
