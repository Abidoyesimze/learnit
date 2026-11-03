"use client";
import dynamic from "next/dynamic";
import { usePrivy } from "@privy-io/react-auth";
import { Mail01Icon, Wallet01Icon } from "hugeicons-react";

// Loaded after first paint so the buttons are interactive before WebGL starts.
const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => <div className="aspect-square h-full rounded-full border border-line" aria-hidden /> });

export function LoginScreen() {
  const { login } = usePrivy();
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-4 pb-8 pt-10">
      <div>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tighter">Learn French and Spanish. Earn G$.</h1>
        <p className="mt-4 max-w-[32ch] text-base text-muted">Under ten minutes a day. Pass your lessons, keep your streak, get paid in G$.</p>
      </div>
      <div className="mx-auto my-4 grid aspect-square h-[min(300px,34dvh)] place-items-center"><Globe /></div>
      <div className="space-y-3">
        <p className="text-sm text-muted">Already use GoodDollar? Connect your wallet</p>
        <button onClick={() => login({ loginMethods: ["wallet"] })} className="flex w-full items-center justify-center gap-2 rounded-full border border-ink px-5 py-4 font-semibold transition active:scale-[0.98]">
          <Wallet01Icon size={20} strokeWidth={1.75} /> Connect wallet
        </button>
        <button onClick={() => login({ loginMethods: ["email"] })} className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98]">
          <Mail01Icon size={20} strokeWidth={1.75} /> Continue with email
        </button>
        <p className="pt-2 text-xs text-muted">Email sign-in creates a wallet for you. GoodDollar verification is tied to the wallet.</p>
      </div>
    </main>
  );
}
