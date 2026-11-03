"use client";
import { Tick02Icon } from "hugeicons-react";
import { LANGS, type Course } from "@/lib/languages";

/** The French / Español picker, shared by onboarding and the change-language page. */
export function LanguageCards({ value, onSelect, disabled }: { value: Course | null; onSelect: (c: Course) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Language" className="grid gap-3">
      {LANGS.map((l) => {
        const on = value === l.code;
        return (
          <button key={l.code} role="radio" aria-checked={on} disabled={disabled} onClick={() => onSelect(l.code)}
            className={`flex items-center gap-4 rounded-card border p-4 text-left transition active:scale-[0.99] disabled:opacity-60 ${on ? "border-ink bg-yellow text-[#111]" : "border-line"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.flag} alt="" width={64} height={48} className="h-12 w-16 shrink-0 rounded-md border border-black/10 object-cover" />
            <span lang={l.code} className="flex-1 text-2xl font-bold tracking-tight">{l.native}</span>
            {on && <Tick02Icon size={22} strokeWidth={2} />}
          </button>
        );
      })}
    </div>
  );
}
