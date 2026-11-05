"use client";
import { useEffect, useRef } from "react";
import createGlobe from "cobe";

// [lat, lng]. Sage markers: where French and Spanish are spoken. Coral arcs: from West Africa, where many learners start.
const SPOKEN: [number, number][] = [
  [48.86, 2.35], [14.69, -17.44], [5.36, -4.01], [4.05, 9.77], [-4.44, 15.27], [45.5, -73.57], // French: Paris, Dakar, Abidjan, Douala, Kinshasa, Montreal
  [40.42, -3.7], [19.43, -99.13], [4.71, -74.07], [-12.05, -77.04], [-34.6, -58.38], [-33.45, -70.67], // Spanish: Madrid, Mexico City, Bogota, Lima, Buenos Aires, Santiago
];
const LAGOS: [number, number] = [6.52, 3.38];
const ACCRA: [number, number] = [5.6, -0.19];

/** A slowly turning globe. Static under prefers-reduced-motion; stops drawing when the tab is hidden. */
export default function Globe() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.offsetWidth * dpr;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sage: [number, number, number] = [0.35, 0.48, 0.4];
    const coral: [number, number, number] = [0.85, 0.47, 0.36];
    const navy: [number, number, number] = [0.06, 0.09, 0.16];

    let phi = 0.2; // Africa and Europe face forward
    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr, width: size, height: size, phi, theta: 0.25,
      dark: 0, diffuse: 1.15, mapSamples: 12000, mapBrightness: 5,
      baseColor: [0.97, 0.96, 0.93],
      markerColor: sage, glowColor: [0.97, 0.96, 0.94],
      markers: [...SPOKEN.map((location) => ({ location, size: 0.055 })), { location: LAGOS, size: 0.05, color: navy }, { location: ACCRA, size: 0.05, color: navy }],
      arcs: [{ from: LAGOS, to: [48.86, 2.35] }, { from: ACCRA, to: [40.42, -3.7] }, { from: LAGOS, to: [4.71, -74.07] }],
      arcColor: coral, arcWidth: 0.6, arcHeight: 0.3,
    });

    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      if (!document.hidden) { phi += (now - last) * 0.00025; globe.update({ phi }); }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); globe.destroy(); };
  }, []);

  return <canvas ref={ref} role="img" aria-label="A globe marking where French and Spanish are spoken" className="aspect-square h-full w-full" />;
}
