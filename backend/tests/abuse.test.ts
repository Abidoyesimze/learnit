import { describe, it, expect } from "vitest";
import { MIN_SECONDS as MIN } from "../src/grading";
import { detectAnomaly, type RecentAttempt } from "../src/abuse";

const at = (durationS: number, score: number, minutesAgo: number): RecentAttempt => ({ durationS, score, createdAt: new Date(Date.now() - minutesAgo * 60_000) });

describe("detectAnomaly", () => {
  it("does nothing with fewer than 3 attempts", () => {
    expect(detectAnomaly([at(MIN, 1, 0)])).toBeNull();
  });
  it("does nothing for a normal human pace", () => {
    expect(detectAnomaly([at(MIN + 50, 0.9, 0), at(MIN + 70, 0.85, 30), at(MIN + 40, 1, 90)])).toBeNull();
  });
  it("flags three perfect scores all landing right at the time floor", () => {
    expect(detectAnomaly([at(MIN + 1, 1, 0), at(MIN, 1, 20), at(MIN + 2, 1, 40)])).toBe("boundary-timed-perfect-streak");
  });
  it("does not flag boundary timing alone if accuracy varies", () => {
    expect(detectAnomaly([at(MIN + 1, 0.8, 0), at(MIN, 0.85, 20), at(MIN + 2, 0.9, 40)])).toBeNull();
  });
  it("flags three passed lessons within a few minutes", () => {
    expect(detectAnomaly([at(150, 0.9, 0), at(MIN + 70, 0.9, 1), at(170, 0.9, 2)])).toBe("high-velocity");
  });
  it("does not flag three lessons spread across the day", () => {
    expect(detectAnomaly([at(150, 0.9, 0), at(MIN + 70, 0.9, 60), at(170, 0.9, 200)])).toBeNull();
  });
});
