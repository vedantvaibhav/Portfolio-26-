"use client";

import { useEffect, useRef, useState } from "react";
import { portalConfig } from "@/portal/config";

/**
 * The entry to the site. A full screen canvas sits above the destination.
 * The scene module is loaded on demand so Three.js stays out of the first
 * bundle. Until the ritual is built, Enter is the only way through.
 */
export function PortalEntry() {
  const [phase, setPhase] = useState<"ritual" | "entered">("ritual");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const destination = destinationRef.current;
    if (!destination) return;
    // Set here, not in the markup, so the page still works with scripting off.
    destination.inert = phase === "ritual";
    if (phase === "entered") headingRef.current?.focus();
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
      const observer = new ResizeObserver(() => scene.resize());
      observer.observe(canvas);
      scene.enter();
      cleanup = () => {
        observer.disconnect();
        scene.teardown();
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
        <div className="portal-cover fixed inset-0 z-[60] bg-[#020204]">
          <canvas
            ref={canvasRef}
            aria-label="Open space, dark and still. Draw a circle to open the site, or press Enter."
            className="absolute inset-0 size-full touch-none"
          />
          <button
            type="button"
            onClick={() => setPhase("entered")}
            className="absolute bottom-6 right-8 font-mono text-[11.5px] tracking-[0.12em] text-[#e8ebf5] opacity-45 hover:opacity-90 focus-visible:opacity-90"
          >
            Enter
          </button>
        </div>
      )}
    </>
  );
}
