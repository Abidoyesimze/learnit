import { describe, it, expect } from "vitest";
import { gradeAll, isPass, MIN_SECONDS } from "../src/grading";
import { streakCount, localDate } from "../src/streak";
import { COURSES, seededDraw } from "../src/lessons";

describe("grading", () => {
  const ex = COURSES.fr[0].lessons[0].exercises;
  const perfect = Object.fromEntries(ex.map((e) => [e.id, e.type === "mc" ? e.answer : e.type === "translate" ? e.answer : e.pairs.map((p) => ({ target: p.target, english: p.english }))]));
  it("scores a perfect lesson at 100%", () => { expect(gradeAll(ex, perfect as never).accuracy).toBe(1); });
  it("scores empty answers at 0 and lists missed words", () => { const g = gradeAll(ex, {}); expect(g.accuracy).toBe(0); expect(g.missedWordIds.length).toBeGreaterThan(0); });
  it("needs 80% accuracy and the minimum time", () => { expect(isPass(0.8, MIN_SECONDS)).toBe(true); expect(isPass(0.79, 200)).toBe(false); expect(isPass(1, MIN_SECONDS - 1)).toBe(false); });
  it("draws a stable 20 from the checkpoint pool", () => {
    const a = seededDraw(COURSES.es[0].checkpoint.pool, 42, 20).map((e) => e.id), b = seededDraw(COURSES.es[0].checkpoint.pool, 42, 20).map((e) => e.id);
    expect(a).toEqual(b); expect(new Set(a).size).toBe(20);
  });
});
describe("streak", () => {
  it("counts consecutive days", () => { expect(streakCount(["2026-11-01", "2026-11-02", "2026-11-03"], "2026-11-03")).toBe(3); });
  it("keeps the streak alive until the day ends", () => { expect(streakCount(["2026-11-01", "2026-11-02"], "2026-11-03")).toBe(2); });
  it("breaks after a missed day", () => { expect(streakCount(["2026-10-30"], "2026-11-03")).toBe(0); });
  it("uses the user's timezone for the local date", () => { expect(localDate(new Date("2026-11-03T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-04"); });
});
