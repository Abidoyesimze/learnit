import { describe, it, expect } from "vitest";
import { isDue, hourIn, reminderFor } from "../src/push";

// 2026-11-03 17:30 UTC = 18:30 in Lagos (UTC+1) = 12:30 in New York (UTC-5)
const now = new Date("2026-11-03T17:30:00Z");

describe("reminder timing", () => {
  it("reads the hour in the person's own timezone", () => {
    expect(hourIn("UTC", now)).toBe(17);
    expect(hourIn("Africa/Lagos", now)).toBe(18);
    expect(hourIn("America/New_York", now)).toBe(12);
  });
  it("is due only at the chosen local hour", () => {
    expect(isDue({ reminderHour: 18, lastSentDate: null }, "Africa/Lagos", now).due).toBe(true);
    expect(isDue({ reminderHour: 18, lastSentDate: null }, "UTC", now).due).toBe(false);
    expect(isDue({ reminderHour: 12, lastSentDate: null }, "America/New_York", now).due).toBe(true);
  });
  it("never sends twice on the same local day", () => {
    const r = isDue({ reminderHour: 18, lastSentDate: "2026-11-03" }, "Africa/Lagos", now);
    expect(r.today).toBe("2026-11-03");
    expect(r.due).toBe(false);
    expect(isDue({ reminderHour: 18, lastSentDate: "2026-11-02" }, "Africa/Lagos", now).due).toBe(true);
  });
  it("falls back safely on a bad timezone", () => { expect(Number.isInteger(hourIn("Not/AZone", now))).toBe(true); });
});

describe("reminder copy", () => {
  it("nudges a live streak harder and names the language", () => {
    const r = reminderFor(5, "es");
    expect(r.title).toContain("5-day streak");
    expect(r.body).toContain("Spanish");
    expect(r.url).toBe("/learn");
  });
  it("invites a new learner without a streak", () => {
    const r = reminderFor(0, "fr");
    expect(r.title).toBe("Time for today's lesson");
    expect(r.body).toContain("French");
  });
  it("uses no em dashes", () => { expect(JSON.stringify([reminderFor(0, "fr"), reminderFor(3, "es")])).not.toContain("—"); });
});
