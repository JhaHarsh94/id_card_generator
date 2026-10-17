import { useEffect, useRef, useState } from 'react';

/**
 * Animate a number from its previous value to `target`.
 *
 * WHY NOT A CSS ANIMATION
 * The end value is only known at runtime (it comes from the database), and CSS
 * cannot count. A requestAnimationFrame loop can, and it lets the counter resume
 * from wherever it already was - so a refresh of the data eases from 12 to 14
 * rather than snapping back to 0 and counting up again, which reads as a glitch.
 *
 * `prefers-reduced-motion` is honoured: the number is set immediately for anyone
 * who has asked for less movement. An animated figure is decoration, and nobody
 * should have to sit through it.
 */
export default function useCountUp(target, duration = 900) {
  const to = Number(target) || 0;
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const total = reduce || duration <= 0 ? 0 : duration;
    const started = performance.now();
    let frame = 0;
    // What is on screen right now. Written into the ref on cleanup so an
    // interrupted animation resumes from where it stopped instead of jumping
    // back to the value it started from.
    let shown = from;

    // Everything below happens on the next frame rather than in the effect body:
    // a synchronous setState here would start a second render before this one
    // has finished, which React warns about and can render a flash of the old
    // number.
    const step = (now) => {
      const t = total === 0 ? 1 : Math.min(1, (now - started) / total);
      // easeOutCubic: fast out of the gate, settles gently on the final value.
      const eased = 1 - (1 - t) ** 3;
      shown = Math.round(from + (to - from) * eased);
      setValue(shown);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = shown;
    };
  }, [to, duration]);

  return value;
}
