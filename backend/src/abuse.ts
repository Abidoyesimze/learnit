import { MIN_SECONDS } from "./grading";

export type RecentAttempt = { durationS: number; score: number; createdAt: Date };

const BOUNDARY_WINDOW = 2; // seconds past MIN_SECONDS that still counts as "landed exactly on the floor"
const VELOCITY_WINDOW_MS = 4 * 60_000; // 3 passed lessons this close together is not a human pace

/** Looks at a learner's most recent passed attempts for a pattern that smells automated.
 *  Returns a reason string to flag, or null if nothing stands out. Pure and testable: callers
 *  supply the attempts (most recent first), already filtered to passed: true. */
export function detectAnomaly(recent: RecentAttempt[]): string | null {
  if (recent.length < 3) return null;
  const last3 = recent.slice(0, 3);

  const allBoundary = last3.every((a) => a.durationS >= MIN_SECONDS && a.durationS <= MIN_SECONDS + BOUNDARY_WINDOW);
  const allPerfect = last3.every((a) => a.score >= 0.99);
  if (allBoundary && allPerfect) return "boundary-timed-perfect-streak";

  const spanMs = last3[0].createdAt.getTime() - last3[2].createdAt.getTime();
  if (spanMs >= 0 && spanMs < VELOCITY_WINDOW_MS) return "high-velocity";

  return null;
}
