import { TabBar } from "./TabBar";

/** One placeholder block. Size it with className; `yellow` is for use on the claim card. */
export function Sk({ className = "", yellow = false }: { className?: string; yellow?: boolean }) {
  return <div aria-hidden className={`skeleton ${yellow ? "skeleton-on-yellow" : ""} ${className}`} />;
}

/** Wrapper that tells assistive tech the region is loading. */
function Busy({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div role="status" aria-busy="true" aria-live="polite" className={className}><span className="sr-only">{label}</span>{children}</div>;
}

const page = "mx-auto max-w-md px-4 pb-28 pt-6";

/** Header row shared by Home and Learn: language chip on the left, small stat on the right. */
function HeaderSk({ right = "w-14" }: { right?: string }) {
  return <div className="mb-6 flex items-center justify-between"><Sk className="h-9 w-32 rounded-full" /><Sk className={`h-4 ${right} rounded`} /></div>;
}

/** The yellow daily-claim card: label, big amount, caption, button. */
export function ClaimCardSkeleton() {
  return (
    <Busy label="Loading your daily G$" className="rounded-card bg-yellow p-5">
      <Sk yellow className="h-4 w-20 rounded" />
      <Sk yellow className="mt-3 h-12 w-44 rounded-input" />
      <Sk yellow className="mt-2 h-4 w-36 rounded" />
      <Sk yellow className="mt-4 h-[56px] w-full rounded-full" />
    </Busy>
  );
}

export function LessonCardSkeleton() {
  return (
    <div aria-hidden className="mt-4 flex items-center justify-between rounded-card border border-line p-5">
      <div className="grid gap-2"><Sk className="h-4 w-28 rounded" /><Sk className="h-3.5 w-20 rounded" /></div>
      <Sk className="h-5 w-5 rounded-full" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <main className={page}>
      <HeaderSk right="w-20" />
      <ClaimCardSkeleton />
      <LessonCardSkeleton />
      <TabBar />
    </main>
  );
}

export function LessonRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Busy label="Loading lessons" className="mt-4 grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between rounded-card border border-line p-4">
          <div className="grid gap-2"><Sk className={`h-4 rounded ${i % 2 ? "w-40" : "w-32"}`} /><Sk className="h-3.5 w-16 rounded" /></div>
          {i < 2 && <Sk className="h-5 w-5 rounded-full" />}
        </div>
      ))}
      <div className="flex items-center justify-between rounded-card border border-line p-4"><Sk className="h-4 w-32 rounded" /><Sk className="h-3.5 w-20 rounded" /></div>
    </Busy>
  );
}

export function LearnSkeleton() {
  const off = [0, 34, 56, 34, 0];
  return (
    <main className={page}>
      <HeaderSk right="w-16" />
      <Sk className="h-24 w-full rounded-card" />
      <div className="mt-6 flex flex-col items-center gap-5" aria-hidden="true">
        {off.map((x, i) => <div key={i} style={{ transform: `translateX(${x}px)` }}><Sk className="h-[72px] w-[72px] rounded-full" /></div>)}
      </div>
      <TabBar />
    </main>
  );
}

export function EarnSkeleton() {
  return (
    <main className={page}>
      <Sk className="h-9 w-24 rounded" />
      <Busy label="Loading your earnings" className="mt-4 rounded-card border border-line p-5">
        <Sk className="h-3.5 w-24 rounded" /><Sk className="mt-3 h-10 w-40 rounded-input" /><Sk className="mt-3 h-3.5 w-52 rounded" />
      </Busy>
      <Sk className="mt-8 h-5 w-32 rounded" />
      <div aria-hidden className="mt-3 grid gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-card border border-line p-4">
            <div className="grid gap-2"><Sk className="h-5 w-24 rounded" /><Sk className="h-3.5 w-32 rounded" /></div>
            <Sk className="h-10 w-20 rounded-full" />
          </div>
        ))}
      </div>
      <TabBar />
    </main>
  );
}

export function StakeSkeleton() {
  return (
    <main className={page}>
      <Sk className="h-9 w-28 rounded" />
      <Sk className="mt-3 h-3.5 w-full rounded" /><Sk className="mt-2 h-3.5 w-2/3 rounded" />
      <Busy label="Loading the challenge" className="mt-6 rounded-card border border-line p-5">
        <Sk className="h-3.5 w-36 rounded" />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="grid gap-2"><Sk className="h-3 w-10 rounded" /><Sk className="h-7 w-24 rounded" /></div>
          <div className="grid gap-2"><Sk className="h-3 w-16 rounded" /><Sk className="h-7 w-12 rounded" /></div>
        </div>
        <Sk className="mt-6 h-4 w-24 rounded" /><Sk className="mt-2 h-[52px] w-full rounded-input" />
        <Sk className="mt-4 h-[56px] w-full rounded-full" />
      </Busy>
      <TabBar />
    </main>
  );
}

export function LeagueSkeleton() {
  return (
    <main className={page}>
      <Sk className="h-9 w-32 rounded" />
      <Busy label="Loading the league" className="mt-6 grid gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-card border border-line p-3">
            <Sk className="h-6 w-6 rounded-full" /><Sk className="h-4 flex-1 rounded" /><Sk className="h-4 w-12 rounded" />
          </div>
        ))}
      </Busy>
      <TabBar />
    </main>
  );
}

export function LanguageSkeleton() {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <Sk className="-ml-2 h-10 w-10 rounded-full" />
      <Sk className="mt-4 h-9 w-56 rounded" /><Sk className="mt-3 h-3.5 w-48 rounded" />
      <Busy label="Loading languages" className="mt-6 grid gap-3">
        {[0, 1].map((i) => <div key={i} className="flex items-center gap-4 rounded-card border border-line p-4"><Sk className="h-12 w-16 rounded-md" /><Sk className="h-7 w-32 rounded" /></div>)}
      </Busy>
    </main>
  );
}

/** Lesson player while the lesson loads: close button, progress bar, prompt, four options, Check button. */
export function LessonSkeleton() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-6 pt-4">
      <div aria-hidden className="flex items-center gap-3"><Sk className="h-9 w-9 rounded-full" /><Sk className="h-3 flex-1 rounded-full" /><Sk className="h-9 w-9 rounded-full" /></div>
      <Busy label="Loading your lesson" className="flex flex-1 flex-col justify-center py-6">
        <Sk className="h-8 w-4/5 rounded" /><Sk className="mt-3 h-8 w-1/2 rounded" />
        <div className="mt-8 grid gap-3">{[0, 1, 2, 3].map((i) => <Sk key={i} className="h-[62px] w-full rounded-card" />)}</div>
      </Busy>
      <Sk className="h-[56px] w-full rounded-full" />
    </main>
  );
}

/** First paint while the sign-in provider starts: a neutral app shell, so nothing jumps when the real screen arrives. */
export function BootSkeleton() {
  return (
    <main className={page}>
      <HeaderSk right="w-20" />
      <Sk className="h-44 w-full rounded-card" />
      <Sk className="mt-4 h-20 w-full rounded-card" />
    </main>
  );
}

export function ProfileSkeleton() {
  return (
    <main className={page}>
      <Sk className="-ml-2 h-10 w-10 rounded-full" />
      <Sk className="mt-2 h-9 w-32 rounded" />
      <Busy label="Loading your profile" className="mt-8">
        <div className="flex flex-col items-center"><Sk className="h-24 w-24 rounded-full" /><Sk className="mt-3 h-4 w-24 rounded" /></div>
        <div className="mt-8 grid gap-5">
          {[0, 1, 2].map((i) => <div key={i}><Sk className="h-4 w-24 rounded" /><Sk className={`mt-2 w-full rounded-input ${i === 2 ? "h-[84px]" : "h-[50px]"}`} /></div>)}
        </div>
        <Sk className="mt-6 h-[56px] w-full rounded-full" />
      </Busy>
      <TabBar />
    </main>
  );
}
