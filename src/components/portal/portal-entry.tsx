"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { portalConfig } from "@/portal/config";
import type { PortalScene } from "@/portal/scene";

/**
 * The entry to the site. A full screen canvas sits above the destination.
 * The scene module is loaded on demand so Three.js stays out of the first
 * bundle.
 *
 * Nothing is on screen but the space and one line of type: no button, no
 * sound toggle. Until the drawing ritual is built (milestone 2 onward), the
 * Enter or Space key opens the site, and a skip button that only appears on
 * keyboard focus does the same for people who cannot draw.
 */
export function PortalEntry() {
  const [phase, setPhase] = useState<"ritual" | "entered">("ritual");
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PortalScene | null>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const destination = destinationRef.current;
    if (!destination) return;
    // Set here, not in the markup, so the page still works with scripting off.
    // The nav sits under the cover too, so it is taken out of the tab order with it.
    const covered = [destination, ...document.querySelectorAll<HTMLElement>("[data-site-chrome]")];
    for (const element of covered) element.inert = phase === "ritual";
    if (phase === "entered") headingRef.current?.focus();
    return () => {
      for (const element of covered) element.inert = false;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "ritual") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLElement && event.target.closest(".lil-gui")) return;
      event.preventDefault();
      setPhase("entered");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (phase !== "ritual" || !canvas) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const { PortalScene } = await import("@/portal/scene");
      if (cancelled) return;

      const scene = new PortalScene(canvas, portalConfig);
      sceneRef.current = scene;
      scene.onReady = () => setReady(true);

      const observer = new ResizeObserver(() => scene.resize());
      observer.observe(canvas);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onReduced = () => scene.setReducedMotion(reduced.matches);
      reduced.addEventListener("change", onReduced);

      scene.enter();
      cleanup = () => {
        observer.disconnect();
        reduced.removeEventListener("change", onReduced);
        scene.teardown();
        sceneRef.current = null;
        setReady(false);
      };

      if (new URLSearchParams(window.location.search).has("debug")) {
        const { createDebug } = await import("@/portal/debug");
        if (cancelled) return;
        const debug = createDebug(portalConfig, () => scene.applyConfig());
        scene.onStats = debug.update;
        const stop = cleanup;
        cleanup = () => {
          debug.destroy();
          stop();
        };
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [phase]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // Touch has no hover. The lean is for pointers that can rest on the page.
    if (event.pointerType === "touch") return;
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = 1 - (event.clientY / window.innerHeight) * 2;
    sceneRef.current?.setPointer(x, y);
  };

  return (
    <>
      {/* [PLACEHOLDER] destination. The real site replaces this. */}
      <div
        ref={destinationRef}
        className="relative grid min-h-svh place-items-center overflow-hidden bg-[#141311] text-[#efe9dd]"
      >
        <div className="portal-blob left-[-14vmax] top-[-18vmax] size-[62vmax] bg-[radial-gradient(circle_at_40%_40%,#f6cf7c,transparent_68%)]" />
        <div className="portal-blob right-[-16vmax] top-[6vmax] size-[58vmax] bg-[radial-gradient(circle,#f1a98c,transparent_66%)]" />
        <div className="portal-blob bottom-[-40vmax] left-[12vmax] size-[70vmax] bg-[radial-gradient(circle_at_50%_40%,#4a5b93,transparent_66%)]" />
        <div className="relative flex flex-col items-center gap-4 px-6 text-center">
          <p className="font-mono text-[13px] tracking-[0.08em] opacity-80">Vedant Vaibhav</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="max-w-[9em] text-balance font-display text-[clamp(3rem,9vw,8.75rem)] italic leading-[0.92] tracking-[-0.02em] outline-none"
          >
            Design, motion and engineering.
          </h1>
          <button
            type="button"
            onClick={() => setPhase("ritual")}
            className="mt-2 font-mono text-[12.5px] tracking-[0.06em] underline underline-offset-4 opacity-75 hover:opacity-100"
          >
            Replay
          </button>
        </div>
      </div>

      {phase === "ritual" && (
        <div
          className="portal-cover fixed inset-0 z-[60]"
          onPointerMove={onPointerMove}
          style={
            {
              background: `linear-gradient(160deg, ${portalConfig.space.lift}, ${portalConfig.space.deep} 70%)`,
              "--portal-prompt-delay": `${portalConfig.prompt.delayMs}ms`,
            } as CSSProperties
          }
        >
          <canvas
            ref={canvasRef}
            aria-label="Open space, dark and still. A small planet far away. Draw a circle to open the site, or press Enter."
            className="portal-canvas absolute inset-0 size-full touch-none"
            data-ready={ready || undefined}
          />
          <p className="portal-prompt pointer-events-none absolute inset-x-0 bottom-[9.5svh] text-center font-mono text-[13px] tracking-[0.12em] text-[#e8ebf5]">
            <span className="portal-fine">Draw a circle.</span>
            <span className="portal-coarse">Draw a circle with your finger.</span>
          </p>
          <button
            type="button"
            onClick={() => setPhase("entered")}
            className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-6 focus-visible:top-6 focus-visible:rounded focus-visible:bg-[#e8ebf5] focus-visible:px-3 focus-visible:py-2 focus-visible:font-mono focus-visible:text-[12px] focus-visible:text-[#020204]"
          >
            Skip the intro
          </button>
        </div>
      )}
    </>
  );
}
