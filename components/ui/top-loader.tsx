"use client";

import { useEffect, useRef } from "react";

/**
 * Thin progress bar across the top of the viewport during client navigation.
 *
 * Written here rather than pulled in as `nextjs-toploader` or `nprogress`: it
 * is about sixty lines, and those packages bring their own CSS and a
 * `useSearchParams` call that forces a Suspense boundary around the root layout.
 *
 * The App Router exposes no "navigation started" event, so a click on an
 * internal link starts the bar, and the router's own `history.pushState` /
 * `replaceState` — which it only calls once the new route has rendered —
 * finishes it. The bar is driven through a ref, not state, so a navigation
 * never re-renders the tree it sits in.
 */
export function TopLoader() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let progress = 0;
    let trickle: number | undefined;
    let hide: number | undefined;

    const paint = () => {
      bar.style.transform = `scaleX(${progress})`;
    };

    const start = () => {
      window.clearTimeout(hide);
      window.clearInterval(trickle);
      progress = 0.08;
      bar.style.opacity = "1";
      paint();
      // Eases toward 90% and stalls there: the bar must never claim a page
      // has arrived when it has not.
      trickle = window.setInterval(() => {
        progress += (0.9 - progress) * 0.08;
        paint();
      }, 200);
    };

    const done = () => {
      if (progress === 0) return;
      window.clearInterval(trickle);
      progress = 1;
      paint();
      hide = window.setTimeout(() => {
        bar.style.opacity = "0";
        hide = window.setTimeout(() => {
          progress = 0;
          paint();
        }, 200);
      }, 150);
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const next = new URL(anchor.href, window.location.href);
      const here = window.location;
      if (next.origin !== here.origin) return;
      // Same path and query means a hash jump or a no-op: nothing will render,
      // so nothing would ever finish the bar.
      if (next.pathname === here.pathname && next.search === here.search) {
        return;
      }
      start();
    };

    const { pushState, replaceState } = window.history;
    window.history.pushState = function (...args) {
      done();
      return pushState.apply(this, args);
    };
    window.history.replaceState = function (...args) {
      done();
      return replaceState.apply(this, args);
    };

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", done);

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", done);
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      window.clearInterval(trickle);
      window.clearTimeout(hide);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        ref={barRef}
        // Not `scale-x-0`: Tailwind v4 compiles that to the `scale` property,
        // which multiplies with the `transform` set above and pins the bar at 0.
        style={{ transform: "scaleX(0)" }}
        className="h-full origin-left bg-[var(--brand-orange)] opacity-0 shadow-[0_0_8px_var(--brand-orange)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
      />
    </div>
  );
}
