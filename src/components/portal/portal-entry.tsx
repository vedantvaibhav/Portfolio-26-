"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import { portalConfig } from "@/portal/config";
import type { Phase, PortalScene } from "@/portal/scene";

/** A touch that travels this far upward counts as a scroll. */
const SWIPE_PX = 36;

/**
 * The entry to the site. A full screen canvas sits above the destination and
 * shows the wormhole. One scroll, or a press and hold, sends the camera over
 * the hole and down it, and the site opens at the bottom. The scene module is
 * loaded on demand so Three.js stays out of the first bundle.
 *
 * Nothing is on screen but the wormhole and one line of type. The arrow keys,
 * Space and Enter do the same as a scroll, and a skip button appears on
 * keyboard focus only.
 */
export function PortalEntry() {
  const [stage, setStage] = useState<"ritual" | "entered">("ritual");
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  const coverRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PortalScene | null>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const touchStart = useRef<number | null>(null);

  // What is under the cover is out of reach until the site opens.
  useEffect(() => {
    const destination = destinationRef.current;
    if (!destination) return;
    // Set here, not in the markup, so the page still works with scripting off.
    const covered = [destination, ...document.querySelectorAll<HTMLElement>("[data-site-chrome]")];
    for (const element of covered) element.inert = stage === "ritual";
    // Nothing behind the cover may scroll or widen the page while the way in plays.
    document.documentElement.classList.toggle("portal-locked", stage === "ritual");
    if (stage === "entered") headingRef.current?.focus();
    return () => {
      for (const element of covered) element.inert = false;
      document.documentElement.classList.remove("portal-locked");
    };
  }, [stage]);

  /** Go in. Without the scene (it failed to load, or has not yet), just open the site. */
  const go = () => {
    if (sceneRef.current) sceneRef.current.begin("scroll");
    else setStage("entered");
  };

  useEffect(() => {
    if (stage !== "ritual") return;
    const onKey = (event: KeyboardEvent) => {
      if (!["Enter", " ", "ArrowDown", "PageDown"].includes(event.key)) return;
      if (event.target instanceof HTMLElement && event.target.closest(".lil-gui, button")) return;
      event.preventDefault();
      if (sceneRef.current) sceneRef.current.begin("scroll");
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
      scene.onPhase = (next) => {
        setPhase(next);
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

  // One scroll downward is enough.
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY > 2) go();
  };

  // Press and hold: the wormhole wraps into a circle for as long as it is held.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchStart.current = event.pointerType === "mouse" ? null : event.clientY;
    sceneRef.current?.begin("hold");
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    // On a touch screen, a swipe upward is the scroll.
    if (touchStart.current !== null && touchStart.current - event.clientY > SWIPE_PX) {
      touchStart.current = null;
      scene.begin("scroll");
    }
    // Touch has no hover. The lean is for pointers that can rest on the page.
    if (event.pointerType !== "touch") {
      scene.setPointer((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
    }
  };

  const onPointerUp = () => {
    touchStart.current = null;
    sceneRef.current?.release();
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
          className="portal-cover fixed inset-0 z-[60] touch-none select-none"
          onWheel={onWheel}
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
            aria-label="A black screen with a wormhole: white grains turn slowly around a dark hole and fall into it. Scroll, or press and hold, to fall in and open the site. Enter does the same."
            className="portal-canvas absolute inset-0 size-full touch-none"
            data-ready={ready || undefined}
          />
          {/* [PLACEHOLDER] wording, for Vedant to confirm. */}
          <p
            className="portal-prompt pointer-events-none absolute inset-x-0 bottom-[9.5svh] isolate text-center font-mono text-[13px] tracking-[0.12em] text-[#e8ebf5]/70"
            data-first
            data-hidden={phase !== "idle" || undefined}
          >
            <span className="portal-fine">Scroll or hold.</span>
            <span className="portal-coarse">Swipe up or hold.</span>
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
