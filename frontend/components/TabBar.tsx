"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home01Icon, BookOpen01Icon, Coins01Icon, LockIcon } from "hugeicons-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home01Icon },
  { href: "/learn", label: "Learn", Icon: BookOpen01Icon },
  { href: "/earn", label: "Earn", Icon: Coins01Icon },
  { href: "/stake", label: "Stake", Icon: LockIcon },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map(({ href, label, Icon }) => {
          const on = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-1 py-3 text-xs font-medium ${on ? "text-ink" : "text-muted"}`}>
                <span className={`rounded-full px-4 py-1 ${on ? "bg-yellow text-[#111]" : ""}`}><Icon size={22} strokeWidth={on ? 2.25 : 1.75} /></span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
