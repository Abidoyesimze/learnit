import { cn } from "@/lib/cn";

/** One placeholder block. Size it with className; `dark` is for use on navy cards. */
export function Sk({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return <div aria-hidden className={cn("skeleton rounded-md", dark && "skeleton-on-dark", className)} />;
}
