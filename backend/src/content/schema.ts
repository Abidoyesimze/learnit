import { z } from "zod";

export const LangSchema = z.enum(["fr", "es"]);
export type Lang = z.infer<typeof LangSchema>;

export const McSchema = z.object({
  id: z.string(),
  type: z.literal("mc"),
  prompt: z.string(),
  /** Text to speak with speechSynthesis (target language), if any. */
  speak: z.string().optional(),
  options: z.array(z.string()).length(4),
  /** Index into options. Server-side only, stripped before sending to clients. */
  answer: z.number().int().min(0).max(3),
  wordId: z.string(),
});

export const TranslateSchema = z.object({
  id: z.string(),
  type: z.literal("translate"),
  /** English sentence the learner translates. */
  prompt: z.string(),
  /** Correct sentence as ordered tokens. Server-side only. */
  answer: z.array(z.string()).min(2),
  /** Word bank shown to the learner: answer tokens plus distractors, shuffled. */
  bank: z.array(z.string()),
  wordIds: z.array(z.string()),
});

export const MatchSchema = z.object({
  id: z.string(),
  type: z.literal("match"),
  prompt: z.string(),
  pairs: z.array(z.object({ wordId: z.string(), target: z.string(), english: z.string() })).min(3).max(5),
});

export const ExerciseSchema = z.discriminatedUnion("type", [McSchema, TranslateSchema, MatchSchema]);
export type Exercise = z.infer<typeof ExerciseSchema>;

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.string(),
  exercises: z.array(ExerciseSchema).min(5).max(12),
});

export const CheckpointSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Pool of 40+ questions; the server draws `draw` of them per attempt. */
  pool: z.array(ExerciseSchema).min(40),
  draw: z.number().int().default(20),
});

export const UnitSchema = z.object({
  lang: LangSchema,
  unit: z.number().int(),
  level: z.literal("A1"),
  title: z.string(),
  speechLang: z.string(),
  lessons: z.array(LessonSchema).length(10),
  checkpoint: CheckpointSchema,
});
export type Unit = z.infer<typeof UnitSchema>;
