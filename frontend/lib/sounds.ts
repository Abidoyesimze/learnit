"use client";

/** Tiny synthesized feedback sounds (Web Audio, no files to download). Playing needs a prior tap, which the Check button and pair taps provide. */
let ctx: AudioContext | null = null;
const KEY = "learnit.sound";

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

/** Bright rising two-note chime. */
export function playCorrect() {
  if (!soundEnabled()) return;
  tone(659.25, 0, 0.16, "sine", 0.22);   // E5
  tone(987.77, 0.09, 0.28, "sine", 0.2); // B5
}

/** Low, short, descending buzz. */
export function playWrong() {
  if (!soundEnabled()) return;
  tone(196, 0, 0.18, "triangle", 0.25);    // G3
  tone(155.56, 0.12, 0.26, "triangle", 0.25); // Eb3
}
