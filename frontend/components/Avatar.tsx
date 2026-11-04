/* eslint-disable @next/next/no-img-element */
const initialsOf = (name: string) => name.replace(/^@/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Profile photo, or yellow initials when there is none. */
export function Avatar({ src, name, size = 40, className = "" }: { src?: string | null; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt="" width={size} height={size} style={style} className={`shrink-0 rounded-full border border-black/10 object-cover ${className}`} />;
  return (
    <span aria-hidden style={{ ...style, fontSize: size * 0.4 }} className={`grid shrink-0 place-items-center rounded-full bg-yellow font-bold text-[#111] ${className}`}>
      {initialsOf(name)}
    </span>
  );
}
