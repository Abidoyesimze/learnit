"use client";

/**
 * Text to speech with the browser's built-in voices. Written around the usual ways it fails silently:
 * - the voice list loads late (empty on first call), so we wait for `voiceschanged`;
 * - Chrome drops an utterance queued right after cancel(), so we only cancel when something is playing;
 * - Chrome can get stuck in a paused state, so we resume() first;
 * - with no voice for the language the browser stays quiet, so we pick the closest voice ourselves.
 */
let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  voices = window.speechSynthesis.getVoices();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

function pickVoice(lang: string) {
  if (!voices.length) loadVoices();
  const l = lang.toLowerCase(), base = l.split("-")[0];
  const same = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
  return same.find((v) => v.lang.toLowerCase().replace("_", "-") === l) ?? same.find((v) => v.localService) ?? same[0] ?? null;
}

/** Returns false when this browser has no speech support or no voice for the language. */
export function speak(text: string, lang: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  const voice = pickVoice(lang);
  if (voices.length > 0 && !voice) return false; // voices are known, none for this language

  if (synth.speaking || synth.pending) synth.cancel();
  if (synth.paused) synth.resume();

  const play = (v: SpeechSynthesisVoice | null, retry: boolean) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = v?.lang ?? lang;
    if (v) u.voice = v;
    u.rate = 0.9;
    u.onerror = (e) => {
      if (e.error === "canceled" || e.error === "interrupted") return; // we cancelled it ourselves
      console.warn("[speech] failed:", e.error, "voice:", v?.name ?? "default", "lang:", u.lang);
      // A specific voice can fail (network voices especially); retry once letting the browser choose.
      if (retry && v) play(null, false);
    };
    synth.speak(u);
  };
  // cancel() is async in some browsers; a short defer keeps the new utterance from being dropped with the old one.
  window.setTimeout(() => play(voice, true), synth.speaking ? 60 : 0);
  return true;
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
