/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";

const initialsOf = (name: string) => name.replace(/^@/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Profile photo, or soft sage initials when there is none. */
export function Avatar({ src, name, size = 40, className = "" }: { src?: string | null; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt="" width={size} height={size} style={style} className={cn("shrink-0 rounded-full object-cover ring-1 ring-black/5", className)} />;
  return (
    <span aria-hidden style={{ ...style, fontSize: size * 0.38 }} className={cn("grid shrink-0 place-items-center rounded-full bg-sage-100 font-semibold tracking-tight text-sage-700", className)}>
      {initialsOf(name)}
    </span>
  );
}
