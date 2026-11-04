"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { CheckmarkBadge01Icon, Copy01Icon, Logout01Icon, Tick02Icon, UserCircleIcon } from "hugeicons-react";
import { short } from "@learnit/backend/format";
import { useMe } from "@/lib/useMe";
import { Avatar } from "./Avatar";
import { Sk } from "./Skeletons";

/** Profile photo in the header. Tapping it opens a small menu with the wallet, a link to the profile and Sign out. */
export function ProfileMenu() {
  const { data: me } = useMe();
  const { logout } = usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!me) return <Sk className="h-10 w-10 rounded-full" />;
  const name = me.displayName || (me.username ? `@${me.username}` : "Your account");

  async function copy() {
    try { await navigator.clipboard.writeText(me!.wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <div ref={root} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="rounded-full transition active:scale-[0.96]">
        <Avatar src={me.avatarUrl} name={me.displayName || me.username || "You"} size={40} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-72 rounded-card border border-line bg-paper p-4 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.25)]">
          <div className="flex items-center gap-3">
            <Avatar src={me.avatarUrl} name={name} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              {me.username && me.displayName && <p className="truncate text-sm text-muted">@{me.username}</p>}
            </div>
          </div>

          <button role="menuitem" onClick={copy} className="mt-4 flex w-full items-center justify-between gap-3 rounded-input border border-line px-3 py-2.5 text-left transition active:scale-[0.99]" aria-label="Copy wallet address">
            <span><span className="block text-xs text-muted">Wallet</span><span className="font-mono text-sm">{short(me.wallet)}</span></span>
            {copied ? <Tick02Icon size={18} strokeWidth={2} /> : <Copy01Icon size={18} strokeWidth={1.75} />}
          </button>
          {me.verified && <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><CheckmarkBadge01Icon size={18} strokeWidth={1.75} /> GoodDollar verified</p>}

          <div className="mt-3 grid gap-1 border-t border-line pt-3">
            <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-input px-2 py-2.5 text-sm font-medium transition hover:bg-line"><UserCircleIcon size={18} strokeWidth={1.75} /> Your profile</Link>
            <button role="menuitem" onClick={() => void logout()} className="flex items-center gap-2 rounded-input px-2 py-2.5 text-left text-sm font-medium transition hover:bg-line"><Logout01Icon size={18} strokeWidth={1.75} /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
