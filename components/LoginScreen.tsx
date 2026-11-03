"use client";
import { usePrivy } from "@privy-io/react-auth";
import { GoogleLogo, Wallet } from "@phosphor-icons/react";

export function LoginScreen() {
  const { login } = usePrivy();
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-4 pb-8 pt-16">
      <div>
        <span className="inline-block rounded-full border border-line px-3 py-1 text-xs font-medium">Beta</span>
        <h1 className="mt-6 text-5xl font-bold leading-none tracking-tighter">Learn French and Spanish. Earn G$.</h1>
        <p className="mt-4 max-w-[32ch] text-base text-muted">Ten minutes a day. Pass your lessons, keep your streak, get paid in G$.</p>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-muted">Already use GoodDollar? Connect your wallet</p>
        <button onClick={() => login({ loginMethods: ["wallet"] })} className="flex w-full items-center justify-center gap-2 rounded-full border border-ink px-5 py-4 font-semibold transition active:scale-[0.98]">
          <Wallet size={20} weight="bold" /> Connect wallet
        </button>
        <button onClick={() => login({ loginMethods: ["google"] })} className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98]">
          <GoogleLogo size={20} weight="bold" /> Continue with Google
        </button>
        <p className="pt-2 text-xs text-muted">Google sign-in creates a wallet for you. GoodDollar verification is tied to the wallet.</p>
      </div>
    </main>
  );
}
