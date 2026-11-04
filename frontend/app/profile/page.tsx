"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { ArrowLeft01Icon, CheckmarkBadge01Icon, Copy01Icon, Logout01Icon, Tick02Icon, ArrowRight01Icon } from "hugeicons-react";
import { useMe } from "@/lib/useMe";
import { langOf } from "@/lib/languages";
import { short } from "@learnit/backend/format";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileSkeleton } from "@/components/Skeletons";
import { TabBar } from "@/components/TabBar";
import { useAuthGate } from "@/components/useAuthGate";

export default function Profile() {
  const ok = useAuthGate();
  const router = useRouter();
  const { logout } = usePrivy();
  const { data: me } = useMe();
  const [copied, setCopied] = useState(false);

  if (!ok || !me) return <ProfileSkeleton />;
  const lang = langOf(me.course);

  async function copy() {
    try { await navigator.clipboard.writeText(me!.wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <button onClick={() => router.back()} aria-label="Back" className="-ml-2 p-2"><ArrowLeft01Icon size={24} strokeWidth={1.75} /></button>
      <h1 className="mt-2 text-3xl font-bold tracking-tighter">Profile</h1>

      <div className="mt-6"><ProfileEditor /></div>

      <section className="mt-10 border-t border-line pt-6" aria-labelledby="account">
        <h2 id="account" className="text-lg font-bold tracking-tight">Account</h2>
        <dl className="mt-4 grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Wallet</dt>
            <dd><button onClick={copy} className="inline-flex items-center gap-2 font-mono text-sm" aria-label="Copy wallet address">{short(me.wallet)} {copied ? <Tick02Icon size={16} strokeWidth={2} /> : <Copy01Icon size={16} strokeWidth={1.75} />}</button></dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">GoodDollar</dt>
            <dd className="text-sm font-medium">{me.verified ? <span className="inline-flex items-center gap-1.5"><CheckmarkBadge01Icon size={18} strokeWidth={1.75} /> Verified</span> : <Link href="/" className="underline underline-offset-4">Not verified yet</Link>}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Learning</dt>
            <dd><Link href="/language" lang={lang.code} className="inline-flex items-center gap-1 text-sm font-medium">{lang.native} <ArrowRight01Icon size={16} strokeWidth={1.75} /></Link></dd>
          </div>
        </dl>
        <button onClick={() => void logout()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-line px-5 py-3 font-semibold transition active:scale-[0.98]">
          <Logout01Icon size={18} strokeWidth={1.75} /> Sign out
        </button>
      </section>
      <TabBar />
    </main>
  );
}
