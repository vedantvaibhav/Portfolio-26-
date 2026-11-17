"use client";

import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { portalConfig } from "@/portal/config";
import type { Phase, PortalScene } from "@/portal/scene";

/** A touch that travels this far upward counts as a scroll. */
const SWIPE_PX = 36;

/**
 * The entry to the site.
 *
 * First a black screen with a count from 0 to 100 and nothing else. At 100
 * the wormhole comes up. There are no words on it.
 *
 * A press and hold inside the hole draws every grain to that point, and the
 * text of the page comes up on the black as they go. A ring around the
 * pointer shows how long is left. Let go early and it all comes back. A press
 * anywhere else does nothing but show where to hold. A scroll, the arrow
 * keys, Space and Enter do the same as a hold at the centre, unannounced,
 * and a skip button appears on keyboard focus only.
 *
 * The scene module is loaded on demand so Three.js stays out of the first
 * bundle.
 */
export function PortalEntry() {
  const [stage, setStage] = useState<"ritual" | "entered">("ritual");
  /** True once the count has reached 100 and the wormhole is on screen. */
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const coverRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PortalScene | null>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const whereRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  /** How far the real loading has got, 0 to 100. The count on screen chases this. */
  const progress = useRef(0);

  // What is under the cover is out of reach until the site opens.
  useEffect(() => {
    const destination = destinationRef.current;
    if (!destination) return;
    // Set here, not in the markup, so the page still works with scripting off.
    const covered = [destination, ...document.querySelectorAll<HTMLElement>("[data-site-chrome]")];
    for (const element of covered) element.inert = stage === "ritual";
    // While the entry plays, the page behind it holds still and keeps its text hidden.
    document.documentElement.classList.toggle("portal-locked", stage === "ritual");
    if (stage === "entered") headingRef.current?.focus();
    return () => {
      for (const element of covered) element.inert = false;
      document.documentElement.classList.remove("portal-locked");
    };
  }, [stage]);

  // On the home page the name is already large in the corner, so the nav does not repeat it.
  useEffect(() => {
    document.documentElement.classList.add("portal-home");
    return () => document.documentElement.classList.remove("portal-home");
  }, []);

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

  // Load the scene. Each step moves the real progress on.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (stage !== "ritual" || !canvas) return;

    let cancelled = false;
    let cleanup = () => {};
    progress.current = 15;

    (async () => {
      const { PortalScene } = await import("@/portal/scene");
      if (cancelled) return;
      progress.current = 45;

      const scene = new PortalScene(canvas, portalConfig);
      sceneRef.current = scene;
      scene.setElements(coverRef.current, whereRef.current, ringRef.current);
      scene.onReady = () => (progress.current = Math.max(progress.current, 80));
      scene.onLoaded = () => (progress.current = 100);
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
      progress.current = Math.max(progress.current, 65);
      cleanup = () => {
        observer.disconnect();
        reduced.removeEventListener("change", onReduced);
        scene.teardown();
        sceneRef.current = null;
        setReady(false);
        setCount(0);
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

  // The count. It follows the real loading, but never runs faster than an even
  // climb over loading.minMs, so it reads as a count and not a jump.
  useEffect(() => {
    if (stage !== "ritual" || ready) return;
    const started = performance.now();
    let shown = 0;
    let frame = 0;
    let done = 0;
    const tick = (now: number) => {
      const pace = ((now - started) / portalConfig.loading.minMs) * 100;
      shown = Math.max(shown, Math.min(progress.current, pace, 100));
      setCount(Math.floor(shown));
      if (shown >= 100) {
        // Hold on 100 for a breath, then let the wormhole in.
        done = window.setTimeout(() => setReady(true), 260);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [stage, ready]);

  /** Keep the hold ring under the pointer. */
  const moveRing = (x: number, y: number) => {
    if (ringRef.current) ringRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  };

  /** A press landed outside the hole. Show where to hold: a ring closes onto the middle of it, twice. */
  const showWhere = () => {
    const mark = whereRef.current?.firstElementChild;
    if (!mark) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mark.animate(
      [
        { opacity: 0, transform: still ? "none" : "scale(2.2)" },
        { opacity: 0.9, transform: "scale(1)", offset: 0.3 },
        { opacity: 0, transform: "scale(1)", offset: 0.5 },
        { opacity: 0, transform: still ? "none" : "scale(2.2)", offset: 0.51 },
        { opacity: 0.9, transform: "scale(1)", offset: 0.8 },
        { opacity: 0, transform: "scale(1)" },
      ],
      { duration: 1500, easing: "ease-out" },
    );
  };

  // One scroll downward is enough.
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (ready && event.deltaY > 2) go();
  };

  // Press and hold inside the hole: the grains drain to that point for as long as it is held.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchStart.current = event.pointerType === "mouse" ? null : event.clientY;
    moveRing(event.clientX, event.clientY);
    const held = sceneRef.current?.hold(event.clientX, event.clientY);
    if (held === false && phase === "idle") showWhere();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    moveRing(event.clientX, event.clientY);
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
      {/* [PLACEHOLDER] destination. The real site replaces this. It sits on the same black as the
          entry, and its text is what the hold reveals. The wording is for Vedant to confirm. */}
      <div ref={destinationRef} className="relative min-h-svh overflow-hidden bg-black text-[#efe9dd]">
        <div className="portal-revealed px-6 pb-10 pt-10 md:px-12 md:pt-14">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[clamp(2rem,4.4vw,4rem)] font-medium leading-[1.02] tracking-[-0.03em] outline-none"
          >
            Vedant Vaibhav
          </h1>
          <p className="mt-5 font-mono text-[clamp(0.8rem,1.1vw,1rem)] tracking-[0.04em] text-[#e8ebf5]/60">
            Senior Product Designer at ShopOS, Bangalore
          </p>
          <button
            type="button"
            onClick={() => setStage("ritual")}
            className="mt-10 font-mono text-[12.5px] tracking-[0.06em] underline underline-offset-4 opacity-70 hover:opacity-100"
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
          onPointerLeave={() => sceneRef.current?.clearPointer()}
        >
          <canvas
            ref={canvasRef}
            aria-label="A black screen with a wormhole: white grains turn slowly around a dark hole and fall into it. Press and hold inside the hole, and the grains drain away to show the site. Enter does the same."
            className="portal-canvas absolute inset-0 size-full touch-none"
            data-ready={ready || undefined}
          />

          {/* The loading count. Nothing else is on screen until it reaches 100. */}
          <p
            className="portal-count pointer-events-none absolute inset-0 grid place-items-center font-mono text-[14px] tracking-[0.14em] text-[#efe9dd]"
            role="status"
            aria-label={ready ? undefined : `Loading, ${count} percent`}
            data-hidden={ready || undefined}
          >
            <span aria-hidden="true">{count}</span>
          </p>

          {/* Where to hold. It sits in the middle of the hole and only shows when a press lands outside it. */}
          <div ref={whereRef} className="portal-where pointer-events-none absolute left-0 top-0" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="21" />
            </svg>
          </div>

          {/* The ring around the pointer while the screen is held. It fills as the hold goes on:
              when it closes, the grains are gone. */}
          <div ref={ringRef} className="portal-ring pointer-events-none absolute left-0 top-0" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="21" className="portal-ring-track" />
              <circle cx="24" cy="24" r="21" pathLength="1" className="portal-ring-fill" />
            </svg>
          </div>

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
