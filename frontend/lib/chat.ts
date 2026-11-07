/**
 * Chat with an AI partner in the language you are learning. The page is built; the AI is not connected yet.
 * To connect it: add a route that takes the conversation and returns the reply plus any correction,
 * then set CHAT_ENABLED to true.
 */
export const CHAT_ENABLED = false;

/** One mistake the AI spotted in a learner's message. */
export type Correction = { wrong: string; right: string; why: string };

/** The learner picks one: type their messages or speak them. */
export type ChatMode = "type" | "voice";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; correction?: Correction };
