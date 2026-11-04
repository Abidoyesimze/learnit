"use client";
import { useEffect, useSyncExternalStore } from "react";

/** Chrome fires beforeinstallprompt once, early. We catch it at the app root and hold it until the user taps Install. */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const SNOOZE_KEY = "learnit.install.dismissed";
const SNOOZE_MS = 14 * 24 * 3600_000;

let deferred: BIPEvent | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function startInstallListener() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIPEvent; emit(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; emit(); });
}

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function snoozed() { try { const t = Number(localStorage.getItem(SNOOZE_KEY) ?? 0); return t > 0 && Date.now() - t < SNOOZE_MS; } catch { return false; } }

export type InstallState = { show: boolean; canPrompt: boolean; ios: boolean };
const snapshot = (): string => {
  if (typeof window === "undefined" || installed || isStandalone() || snoozed()) return "hide";
  if (deferred) return "prompt";
  return isIOS() ? "ios" : "hide";
};

export function useInstall() {
  useEffect(() => { startInstallListener(); }, []);
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, snapshot, () => "hide");
  return {
    state: { show: s !== "hide", canPrompt: s === "prompt", ios: s === "ios" } as InstallState,
    async install() {
      if (!deferred) return;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "dismissed") dismiss();
      emit();
    },
    dismiss,
  };
}

function dismiss() { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch {} emit(); }
