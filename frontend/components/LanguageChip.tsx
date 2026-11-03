"use client";
import Link from "next/link";
import { ArrowDown01Icon } from "hugeicons-react";
import { useMe } from "@/lib/useMe";
import { Sk } from "./Skeletons";
import { langOf } from "@/lib/languages";

/** Shows the language being learned. Tapping it opens the change-language page. */
export function LanguageChip() {
  const { data: me } = useMe();
  if (!me) return <Sk className="h-9 w-32 rounded-full" />;
  const l = langOf(me.course);
  return (
    <Link href="/language" aria-label={`Learning ${l.native}. Change language`} className="inline-flex items-center gap-2 rounded-full border border-line py-1.5 pl-2 pr-3 transition active:scale-[0.98]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={l.flag} alt="" width={28} height={20} className="h-5 w-7 rounded-sm object-cover" />
      <span lang={l.code} className="font-semibold">{l.native}</span>
      <ArrowDown01Icon size={16} strokeWidth={1.75} />
    </Link>
  );
}
