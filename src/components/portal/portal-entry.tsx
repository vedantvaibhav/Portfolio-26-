"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { portalConfig } from "@/portal/config";
import type { Miss, Phase, PortalScene } from "@/portal/scene";

/**
 * The entry to the site. A full screen canvas sits above the destination.
 * The visitor draws a circle, it becomes a ring of light, and the site opens
 * through it. The scene module is loaded on demand so Three.js stays out of
 * the first bundle.
 *
 * Nothing is on screen but the space and one line of type. Enter or Space
 * draws the circle for people who cannot, and a skip button appears on
 * keyboard focus only.
 */
export function PortalEntry() {
  const [stage, setStage] = useState<"ritual" | "entered">("ritual");
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [miss, setMiss] = useState<Miss | undefined>();
  const [nudge, setNudge] = useState(0);

  const coverRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PortalScene | null>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // What is under the cover is out of reach until the site opens.
  useEffect(() => {
    const destination = destinationRef.current;
    if (!destination) return;
    // Set here, not in the markup, so the page still works with scripting off.
    const covered = [destination, ...document.querySelectorAll<HTMLElement>("[data-site-chrome]")];
    for (const element of covered) element.inert = stage === "ritual";
    if (stage === "entered") headingRef.current?.focus();
    return () => {
      for (const element of covered) element.inert = false;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "ritual") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLElement && event.target.closest(".lil-gui")) return;
      event.preventDefault();
      // Without the scene (it failed to load, or has not yet), just open the site.
      if (sceneRef.current) sceneRef.current.igniteAtCentre();
      else setStage("entered");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (stage !== "ritual" || !canvas) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const { PortalScene } = await import("@/portal/scene");
      if (cancelled) return;

      const scene = new PortalScene(canvas, portalConfig);
      sceneRef.current = scene;
      scene.setElements(coverRef.current, destinationRef.current);
      scene.onReady = () => setReady(true);
      scene.onPhase = (next, why) => {
        setPhase(next);
        if (next === "fail" && why) {
          setMiss(why);
          setNudge((count) => count + 1);
        }
        if (next === "done") setStage("entered");
      };

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
        setPhase("idle");
        setMiss(undefined);
      };

      if (new URLSearchParams(window.location.search).has("debug")) {
        const { createDebug } = await import("@/portal/debug");
        if (cancelled) return;
        const debug = createDebug(portalConfig, scene);
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
  }, [stage]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sceneRef.current?.strokeStart(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    // Pointer events can arrive faster than frames. Use every one for a smooth stroke.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const each of events.length ? events : [event.nativeEvent]) scene.strokeMove(each.clientX, each.clientY);
    // Touch has no hover. The lean is for pointers that can rest on the page.
    if (event.pointerType !== "touch") {
      scene.setPointer((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
    }
  };

  const onPointerUp = () => sceneRef.current?.strokeEnd();

  const waiting = phase === "idle" || phase === "fail";

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
            onClick={() => setStage("ritual")}
            className="mt-2 font-mono text-[12.5px] tracking-[0.06em] underline underline-offset-4 opacity-75 hover:opacity-100"
          >
            Replay
          </button>
        </div>
      </div>

      {stage === "ritual" && (
        <div
          ref={coverRef}
          className="portal-cover fixed inset-0 z-[60] cursor-crosshair touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ "--portal-prompt-delay": `${portalConfig.prompt.delayMs}ms` } as CSSProperties}
        >
          {/* Shown at once, before the 3D is ready. Gone before the ring opens, so the page can show through. */}
          {phase !== "opening" && phase !== "done" && (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(160deg, ${portalConfig.space.lift}, ${portalConfig.space.deep} 70%)` }}
            />
          )}
          <canvas
            ref={canvasRef}
            aria-label="Open space in black and white. White grains turn slowly around a dark hole and fall into it. Draw a circle to open the site, or press Enter."
            className="portal-canvas absolute inset-0 size-full touch-none"
            data-ready={ready || undefined}
          />
          <p
            key={nudge}
            className="portal-prompt pointer-events-none absolute inset-x-0 bottom-[9.5svh] isolate text-center font-mono text-[13px] tracking-[0.12em] text-[#e8ebf5]/70"
            data-first={nudge === 0 || undefined}
            data-hidden={!waiting || undefined}
            aria-live="polite"
          >
            {miss === "open" ? (
              "Close the loop."
            ) : (
              <>
                <span className="portal-fine">Draw a circle.</span>
                <span className="portal-coarse">Draw a circle with your finger.</span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setStage("entered")}
            className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-6 focus-visible:top-6 focus-visible:rounded focus-visible:bg-[#e8ebf5] focus-visible:px-3 focus-visible:py-2 focus-visible:font-mono focus-visible:text-[12px] focus-visible:text-[#020204]"
          >
            Skip the intro
          </button>
        </div>
      )}
    </>
  );
}
