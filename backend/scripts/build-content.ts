// Generates src/content/{fr,es}/unit{N}.json from scripts/vocab.ts (10 short lessons per unit, 6 questions each). Run from the repo root: npm run content
import { writeFileSync } from "node:fs";
import { FR, ES, FR_UNIT2, ES_UNIT2, FR_UNIT3, ES_UNIT3, type LessonData } from "./vocab";
import { UnitSchema, type Exercise, type Lang } from "../src/content/schema";

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function shuffle<T>(a: T[], r: () => number) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// unitNum defaults to 1 and, for unit 1, reproduces the original id scheme and rng seed exactly
// (word ids with no "u1-" prefix) so the already-shipped unit1.json never changes if regenerated.
// Units 2+ namespace every id with "u{unitNum}-" since they share no id space with unit 1.
function build(lang: Lang, data: LessonData[], unitNum = 1) {
  const r = rng(unitNum === 1 ? (lang === "fr" ? 11 : 29) : (lang === "fr" ? 11 : 29) + unitNum * 1009);
  const uid = unitNum === 1 ? "" : `u${unitNum}-`;
  const all = data.flatMap((l, li) => l.words.map((w, wi) => ({ id: `${lang}-${uid}w${li * 8 + wi + 1}`, t: w[0], e: w[1], li })));
  const speechLang = lang === "fr" ? "fr-FR" : "es-ES";

  const mc = (w: (typeof all)[number], idx: number, pool: typeof all): Exercise => {
    const toEnglish = idx % 2 === 0;
    const others = shuffle(pool.filter((p) => p.id !== w.id), r).slice(0, 3);
    const opts = shuffle([w, ...others], r);
    return {
      id: `${w.id}-${toEnglish ? "te" : "et"}`, type: "mc", wordId: w.id,
      prompt: toEnglish ? `What does "${w.t}" mean?` : `How do you say "${w.e}"?`,
      speak: toEnglish ? w.t : undefined,
      options: opts.map((o) => (toEnglish ? o.e : o.t)),
      answer: opts.findIndex((o) => o.id === w.id),
    };
  };
  const tr = (li: number, si: number): Exercise => {
    const s = data[li].sentences[si];
    return { id: `${lang}-${uid}l${li + 1}-s${si + 1}`, type: "translate", prompt: s.english, answer: s.target,
      bank: shuffle([...s.target, ...s.extra], r), wordIds: [] };
  };
  const match = (id: string, ws: typeof all): Exercise => ({ id, type: "match", prompt: "Match the pairs",
    pairs: ws.map((w) => ({ wordId: w.id, target: w.t, english: w.e })) });

  // Each theme (8 words) becomes two short lessons of 6 questions: 4 multiple choice, 1 match (4 pairs), 1 translate.
  const lessons = data.flatMap((l, li) => {
    const ws = all.filter((w) => w.li === li);
    return [0, 1].map((half) => {
      const hw = ws.slice(half * 4, half * 4 + 4);
      const no = li * 2 + half + 1;
      const m = (i: number) => mc(hw[i], i, ws);
      const exercises: Exercise[] = [m(0), m(1), match(`${lang}-${uid}l${no}-m`, hw), m(2), m(3), tr(li, half)];
      return { id: `${lang}-u${unitNum}-l${no}`, title: `${l.title}, part ${half + 1}`, theme: l.theme, exercises };
    });
  });

  const pool: Exercise[] = [
    ...all.map((w, i) => ({ ...mc(w, i, all), id: `${lang}-cp-${w.id}` })),
    ...data.flatMap((_, li) => [0, 1, 2].map((si) => ({ ...tr(li, si), id: `${lang}-cp-${uid}l${li + 1}-s${si + 1}` }))),
    ...data.map((_, li) => match(`${lang}-cp-${uid}m${li + 1}`, shuffle(all.filter((w) => w.li === li), r).slice(0, 5))),
  ];
  const unit = { lang, unit: unitNum, level: "A1" as const, title: `${lang === "fr" ? "French" : "Spanish"}, Unit ${unitNum}`, speechLang, lessons,
    checkpoint: { id: `${lang}-u${unitNum}-cp`, title: `Unit ${unitNum} checkpoint`, pool, draw: 20 } };
  return UnitSchema.parse(unit);
}

const units: [number, Lang, LessonData[]][] = [
  [1, "fr", FR], [1, "es", ES],
  [2, "fr", FR_UNIT2], [2, "es", ES_UNIT2],
  [3, "fr", FR_UNIT3], [3, "es", ES_UNIT3],
];
for (const [unitNum, lang, data] of units) {
  const u = build(lang, data, unitNum);
  writeFileSync(`src/content/${lang}/unit${unitNum}.json`, JSON.stringify(u, null, 2) + "\n");
  console.log(lang, "unit", unitNum, "lessons", u.lessons.length, "pool", u.checkpoint.pool.length);
}
