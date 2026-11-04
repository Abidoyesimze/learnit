import { describe, it, expect } from "vitest";
import { decideInstall } from "../../frontend/lib/installDecision";

const base = { installedFlag: false, standalone: false, snoozed: false, hasDeferredPrompt: false, ios: false };

describe("install card", () => {
  it("offers one-tap install when the browser allows it", () => { expect(decideInstall({ ...base, hasDeferredPrompt: true })).toBe("prompt"); });
  it("shows the Share steps on iPhone", () => { expect(decideInstall({ ...base, ios: true })).toBe("ios"); });
  it("stays quiet where install is not possible", () => { expect(decideInstall(base)).toBe("hide"); });
  it("never shows again once installed, even if the browser would still offer it", () => {
    expect(decideInstall({ ...base, installedFlag: true, hasDeferredPrompt: true })).toBe("hide");
    expect(decideInstall({ ...base, installedFlag: true, ios: true })).toBe("hide");
  });
  it("hides inside the installed app and while snoozed", () => {
    expect(decideInstall({ ...base, standalone: true, hasDeferredPrompt: true })).toBe("hide");
    expect(decideInstall({ ...base, snoozed: true, ios: true })).toBe("hide");
  });
});
