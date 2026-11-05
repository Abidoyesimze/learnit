import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom type scale, so `text-display-lg` and `text-ink` aren't treated as the same property.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display-xl", "display-lg", "display-md", "eyebrow"] }],
      shadow: [{ shadow: ["card", "raised", "float", "inset-line"] }],
      rounded: [{ rounded: ["card", "input", "btn"] }],
    },
  },
});

/** Join class names and let later Tailwind classes win over earlier ones. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
