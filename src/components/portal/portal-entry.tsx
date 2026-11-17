"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import { portalConfig } from "@/portal/config";
import type { Phase, PortalScene } from "@/portal/scene";

/** A touch that travels this far upward counts as a scroll. */
const SWIPE_PX = 36;

/**
 * The entry to the site. A full screen canvas sits above the destination and
 * shows the wormhole. One scroll draws every grain into the centre of the
 * hole, where it vanishes. A press and hold inside the hole does the same
 * wherever the hold is. The frame is left black, and the site comes up on
 * that same black. The scene module is loaded on demand so Three.js stays out
 * of the first bundle.
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
  const labelRef = useRef<HTMLParagraphElement>(null);

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
    if (sceneRef.current) sceneRef.current.go();
    else setStage("entered");
  };

  useEffect(() => {
    if (stage !== "ritual") return;
    const onKey = (event: KeyboardEvent) => {
      if (!["Enter", " ", "ArrowDown", "PageDown"].includes(event.key)) return;
      if (event.target instanceof HTMLElement && event.target.closest(".lil-gui, button")) return;
      event.preventDefault();
      if (sceneRef.current) sceneRef.current.go();
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
      scene.setElements(coverRef.current, destinationRef.current, labelRef.current);
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

  // Press and hold inside the hole: the grains drain to that point for as long as it is held.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchStart.current = event.pointerType === "mouse" ? null : event.clientY;
    sceneRef.current?.hold(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    // On a touch screen, a swipe upward is the scroll.
    if (touchStart.current !== null && touchStart.current - event.clientY > SWIPE_PX) {
      touchStart.current = null;
      scene.go();
    }
    if (event.buttons & 1 || event.pointerType === "touch") scene.holdMove(event.clientX, event.clientY);
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
      {/* [PLACEHOLDER] destination. The real site replaces this. It sits on the same black as the entry. */}
      <div
        ref={destinationRef}
        className="relative grid min-h-svh place-items-center overflow-hidden bg-black text-[#efe9dd]"
      >
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
          className="portal-cover fixed inset-0 z-[60] touch-none select-none bg-black"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => sceneRef.current?.clearPointer()}
          style={{ "--portal-prompt-delay": `${portalConfig.prompt.delayMs}ms` } as CSSProperties}
        >
          <canvas
            ref={canvasRef}
            aria-label="A black screen with a wormhole: white grains turn slowly around a dark hole and fall into it. Scroll, or press and hold inside the hole, and the grains drain away to show the site. Enter does the same."
            className="portal-canvas absolute inset-0 size-full touch-none"
            data-ready={ready || undefined}
          />
          {/* [PLACEHOLDER] wording, for Vedant to confirm. Top left, in the empty part of the frame. */}
          <div className="pointer-events-none absolute left-0 top-0 px-6 pb-10 pt-10 md:px-12 md:pt-14">
            <p className="text-[clamp(2rem,4.4vw,4rem)] font-medium leading-[1.02] tracking-[-0.03em] text-[#efe9dd]">
              Vedant Vaibhav
            </p>
            <p className="mt-5 font-mono text-[clamp(0.8rem,1.1vw,1rem)] tracking-[0.04em] text-[#e8ebf5]/60">
              Senior Product Designer at ShopOS, Bangalore
            </p>
          </div>
          {/* [PLACEHOLDER] wording. In the middle of the hole, set in the system face (SF Pro on Apple devices). */}
          <p
            ref={labelRef}
            className="portal-hold pointer-events-none absolute left-0 top-0 whitespace-nowrap text-[15px] tracking-[0.01em] text-[#efe9dd]/75"
            data-hidden={phase !== "idle" || undefined}
          >
            <span className="portal-fine">Press and hold</span>
            <span className="portal-coarse">Tap and hold</span>
          </p>
          {/* [PLACEHOLDER] wording, for Vedant to confirm. */}
          <p
            className="portal-prompt pointer-events-none absolute inset-x-0 bottom-[7svh] isolate text-center font-mono text-[13px] tracking-[0.12em] text-[#e8ebf5]/70"
            data-first
            data-hidden={phase !== "idle" || undefined}
          >
            <span className="portal-fine">Scroll</span>
            <span className="portal-coarse">Swipe up</span>
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
