"use client";
import { Cancel01Icon, Download01Icon, Share01Icon, PlusSignSquareIcon } from "hugeicons-react";
import { useInstall } from "@/lib/install";

/** Offers to install the PWA. Chrome and Android get a one-tap Install; iPhone gets the two steps Safari needs. Hidden once installed. */
export function InstallPrompt() {
  const { state, install, dismiss, markInstalled } = useInstall();
  if (!state.show) return null;
  return (
    <section aria-label="Install LearnIt" className="mt-4 rounded-card border border-line p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Install LearnIt</h2>
          <p className="mt-1 text-sm text-muted">Open it from your home screen like an app. Faster to start, and it works for daily reminders.</p>
        </div>
        <button onClick={dismiss} aria-label="Not now" className="-mr-2 -mt-2 p-2 text-muted"><Cancel01Icon size={20} strokeWidth={1.75} /></button>
      </div>
      {state.canPrompt && (
        <button onClick={() => void install()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-3 font-semibold text-[#111] transition active:scale-[0.98]">
          <Download01Icon size={18} strokeWidth={1.75} /> Install app
        </button>
      )}
      {state.ios && (
        <ol className="mt-4 grid gap-3 text-sm">
          <li className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yellow text-[#111]"><Share01Icon size={16} strokeWidth={1.75} /></span>Tap the Share button in Safari</li>
          <li className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yellow text-[#111]"><PlusSignSquareIcon size={16} strokeWidth={1.75} /></span>Choose Add to Home Screen</li>
        </ol>
      )}
      {state.ios && <button onClick={markInstalled} className="mt-4 text-sm font-medium underline underline-offset-4">I&apos;ve added it</button>}
    </section>
  );
}
