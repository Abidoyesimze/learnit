import { z } from "zod";
import { requireUser, authFail } from "../auth";
import { findLesson, findCheckpoint, seededDraw } from "../lessons";
import { readStart } from "../token";
import { gradeExercise, type Answer } from "../grading";
import type { Exercise } from "../content/schema";

const Body = z.object({ token: z.string(), exerciseId: z.string(), answer: z.any() });

function reveal(ex: Exercise) {
  return ex.type === "mc" ? ex.answer : ex.type === "translate" ? ex.answer : ex.pairs.map((p) => ({ target: p.target, english: p.english }));
}

/** Instant feedback only. The final grade always comes from /submit. Works for lessons and checkpoints. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const b = Body.parse(await req.json());
    const start = readStart(b.token);
    if (!start || start.userId !== user.id || start.targetId !== params.id) return Response.json({ error: "Invalid token" }, { status: 400 });
    let pool: Exercise[] = [];
    const l = findLesson(params.id);
    if (l) pool = l.lesson.exercises;
    else { const c = findCheckpoint(params.id); if (c) pool = seededDraw(c.checkpoint.pool, start.seed, c.checkpoint.draw); }
    const ex = pool.find((e) => e.id === b.exerciseId);
    if (!ex) return Response.json({ error: "Not found" }, { status: 404 });
    const r = gradeExercise(ex, b.answer as Answer);
    return Response.json({ correct: r.correct, answer: reveal(ex) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Bad request" }, { status: 400 });
    return authFail(e);
  }
}
