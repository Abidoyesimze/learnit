export type Course = "fr" | "es";

/** Languages by their own name. `flag` is an SVG in /public/flags. */
export const LANGS: { code: Course; flag: string; native: string }[] = [
  { code: "fr", flag: "/flags/fr.svg", native: "Français" },
  { code: "es", flag: "/flags/es.svg", native: "Español" },
];

export const langOf = (c: string | undefined) => LANGS.find((l) => l.code === c) ?? LANGS[0];
