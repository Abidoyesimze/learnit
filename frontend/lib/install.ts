"use client";
import { useEffect, useSyncExternalStore } from "react";
import { decideInstall } from "./installDecision";

/** Chrome fires beforeinstallprompt once, early. We catch it at the app root and hold it until the user taps Install. */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const SNOOZE_KEY = "learnit.install.dismissed";
const INSTALLED_KEY = "learnit.installed"; // set once, never cleared: installed means never ask again
const SNOOZE_MS = 14 * 24 * 3600_000;

let deferred: BIPEvent | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** Remember, across visits, that this device has the app. */
export function markInstalled() {
  installed = true; deferred = null;
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
  emit();
}
function installedBefore() { try { return installed || localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return installed; } }

export function startInstallListener() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Opened as the installed app: remember it, so the browser tab on this device stops asking too.
  if (isStandalone()) markInstalled();
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", (e) => { if (e.matches) markInstalled(); });
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIPEvent; emit(); });
  window.addEventListener("appinstalled", markInstalled);
}

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function snoozed() { try { const t = Number(localStorage.getItem(SNOOZE_KEY) ?? 0); return t > 0 && Date.now() - t < SNOOZE_MS; } catch { return false; } }

export type InstallState = { show: boolean; canPrompt: boolean; ios: boolean };
const snapshot = (): string => {
  if (typeof window === "undefined") return "hide";
  return decideInstall({ installedFlag: installedBefore(), standalone: isStandalone(), snoozed: snoozed(), hasDeferredPrompt: deferred !== null, ios: isIOS() });
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
      if (outcome === "accepted") markInstalled();
      else dismiss();
      emit();
    },
    dismiss,
    markInstalled,
  };
}

function dismiss() { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch {} emit(); }
