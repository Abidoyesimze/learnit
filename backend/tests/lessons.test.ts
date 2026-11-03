import { describe, it, expect } from "vitest";
import { COURSES, currentUnitFor } from "../src/lessons";

describe("currentUnitFor", () => {
  it("starts on unit 1 with nothing passed", () => {
    expect(currentUnitFor("fr", new Set())).toBe(COURSES.fr[0]);
  });
  it("stays on unit 1 until its checkpoint is passed, even with all lessons done", () => {
    const passed = new Set(COURSES.fr[0].lessons.map((l) => l.id));
    expect(currentUnitFor("fr", passed)).toBe(COURSES.fr[0]);
  });
  it("advances to unit 2 once unit 1's lessons and checkpoint are passed", () => {
    const passed = new Set([...COURSES.fr[0].lessons.map((l) => l.id), COURSES.fr[0].checkpoint.id]);
    expect(currentUnitFor("fr", passed)).toBe(COURSES.fr[1]);
  });
  it("lands on the last unit once the whole course is done", () => {
    const passed = new Set(COURSES.es.flatMap((u) => [...u.lessons.map((l) => l.id), u.checkpoint.id]));
    expect(currentUnitFor("es", passed)).toBe(COURSES.es[COURSES.es.length - 1]);
  });
});
