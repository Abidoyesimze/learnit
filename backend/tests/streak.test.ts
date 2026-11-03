import { describe, it, expect } from "vitest";
import { streakCount, localDate, freezeGapDate, weekKey } from "../src/streak";

describe("streak", () => {
  it("counts consecutive days", () => { expect(streakCount(["2026-11-01", "2026-11-02", "2026-11-03"], "2026-11-03")).toBe(3); });
  it("keeps the streak alive until the day ends", () => { expect(streakCount(["2026-11-01", "2026-11-02"], "2026-11-03")).toBe(2); });
  it("breaks after a missed day", () => { expect(streakCount(["2026-10-30"], "2026-11-03")).toBe(0); });
  it("uses the user's timezone for the local date", () => { expect(localDate(new Date("2026-11-03T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-04"); });
});

describe("freezeGapDate", () => {
  it("finds yesterday as the gap when the day before was a streak day and today is not done yet", () => {
    expect(freezeGapDate(["2026-11-01"], "2026-11-03")).toBe("2026-11-02");
  });
  it("does nothing when the streak is already intact", () => {
    expect(freezeGapDate(["2026-11-02", "2026-11-03"], "2026-11-03")).toBeNull();
  });
  it("does nothing when today itself has not been done yet but yesterday was", () => {
    expect(freezeGapDate(["2026-11-02"], "2026-11-03")).toBeNull();
  });
  it("does nothing when the streak was already broken more than one day ago", () => {
    expect(freezeGapDate(["2026-10-25"], "2026-11-03")).toBeNull();
  });
  it("does nothing on an empty history", () => {
    expect(freezeGapDate([], "2026-11-03")).toBeNull();
  });
});

describe("weekKey", () => {
  it("returns the Monday (UTC) of the week containing the date", () => {
    // 2026-11-03 is a Tuesday; the Monday is 2026-11-02.
    expect(weekKey(new Date("2026-11-03T12:00:00Z"))).toBe("2026-11-02");
  });
  it("maps every day of a week to the same key", () => {
    const keys = new Set(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"].map((d) => weekKey(new Date(`${d}T00:00:00Z`))));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("2026-11-02");
  });
  it("rolls over to the next Monday", () => {
    expect(weekKey(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09");
  });
});
