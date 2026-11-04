export type Word = [target: string, english: string];
export type Sentence = { target: string[]; english: string; extra: string[] };
export type LessonData = { title: string; theme: string; words: Word[]; sentences: Sentence[] };
export type UnitData = { title: string; blurb: string; themes: LessonData[] };

/** "bonjour=hello | merci=thank you" -> word pairs. */
export const W = (s: string): Word[] => s.split(" | ").map((p) => { const [t, e] = p.split("="); return [t.trim(), e.trim()] as Word; });
/** A sentence: target words separated by spaces, its English, and two distractor words for the bank. */
export const S = (target: string, english: string, extra: string): Sentence => ({ target: target.split(" "), english, extra: extra.split(" ") });
/** A theme: 8 words (two lessons of 4) and 3 short sentences. */
export const T = (title: string, words: string, ...sentences: Sentence[]): LessonData => ({ title, theme: title.toLowerCase(), words: W(words), sentences });
export const U = (title: string, blurb: string, ...themes: LessonData[]): UnitData => ({ title, blurb, themes });
