/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";
import { langOf } from "@/lib/languages";

/** A round flag with a hairline ring, so light flags don't bleed into white cards. */
export function Flag({ code, size = 24, className }: { code: string; size?: number; className?: string }) {
  const l = langOf(code);
  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden rounded-full", className)} style={{ width: size, height: size }}>
      <img src={l.flag} alt="" width={size} height={size} className="h-full w-full object-cover" />
      <span aria-hidden className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/10" />
    </span>
  );
}
