import fr from "@/content/fr/unit1.json";
import es from "@/content/es/unit1.json";
import { UnitSchema, type Exercise, type Lang, type Unit } from "@/content/schema";

export const UNITS: Record<Lang, Unit> = { fr: UnitSchema.parse(fr), es: UnitSchema.parse(es) };

export function findLesson(id: string) {
  for (const lang of ["fr", "es"] as const) {
    const u = UNITS[lang];
    const l = u.lessons.find((x) => x.id === id);
    if (l) return { lang, unit: u, lesson: l };
  }
  return null;
}
export function findCheckpoint(id: string) {
  for (const lang of ["fr", "es"] as const) if (UNITS[lang].checkpoint.id === id) return { lang, unit: UNITS[lang], checkpoint: UNITS[lang].checkpoint };
  return null;
}

/** Fisher-Yates with a seeded LCG so a checkpoint draw can be re-derived at grading time. */
export function seededDraw<T>(pool: T[], seed: number, n: number): T[] {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export type PublicExercise =
  | { id: string; type: "mc"; prompt: string; speak?: string; options: string[] }
  | { id: string; type: "translate"; prompt: string; bank: string[] }
  | { id: string; type: "match"; prompt: string; left: string[]; right: string[] };

/** Removes answers before sending to the client. Match right column is reshuffled by a seed. */
export function toPublic(ex: Exercise, seed = 1): PublicExercise {
  if (ex.type === "mc") return { id: ex.id, type: "mc", prompt: ex.prompt, speak: ex.speak, options: ex.options };
  if (ex.type === "translate") return { id: ex.id, type: "translate", prompt: ex.prompt, bank: ex.bank };
  const left = ex.pairs.map((p) => p.target);
  const right = seededDraw(ex.pairs.map((p) => p.english), seed + ex.id.length, ex.pairs.length);
  return { id: ex.id, type: "match", prompt: ex.prompt, left, right };
}
