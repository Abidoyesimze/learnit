// Times POST /api/lessons/:id/check against a running server. Run: npm run check:speed -w @learnit/backend
import { issueStart } from "../src/token";
import { COURSES } from "../src/lessons";
const base = process.env.BASE ?? "http://localhost:3100";
const lesson = COURSES.fr[0].lessons[0];
const token = issueStart({ userId: "speed-test", kind: "lesson", targetId: lesson.id, startedAt: Date.now(), seed: 1 });
const ex = lesson.exercises[0];
for (let i = 1; i <= 5; i++) {
  const t = performance.now();
  const r = await fetch(`${base}/api/lessons/${lesson.id}/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, exerciseId: ex.id, answer: 0 }) });
  console.log(`check ${i}: HTTP ${r.status} in ${Math.round(performance.now() - t)} ms`, i === 1 ? JSON.stringify(await r.json()).slice(0, 60) : "");
}
