# vedantvaibhav.com

Personal portfolio of Vedant Vaibhav.

```bash
pnpm install
pnpm dev
```

Needs Node 22 and pnpm 10.

- `docs/brief.md` is the brief the site is built from.
- `docs/portal/handoff.md` is the spec for the Portal entry. `docs/portal/storyboard/` holds the approved storyboard.
- `CLAUDE.md` holds the working rules for copy, motion and facts.
- `src/content/work/` holds the case studies as MDX.

## The Portal entry

The home page opens on a black screen with a wormhole, rendered in WebGL above a placeholder destination. One scroll sends the camera over the hole and down it, and the site opens at the bottom. A press and hold does the same for as long as it is held: the tilted disc wraps into a full circle, and letting go early eases it back. The arrow keys, Space and Enter work like a scroll.

- `src/portal/config.ts` holds every timing, colour and intensity. Change values there, nowhere else.
- `src/portal/scene.ts` is the scene class (`enter`, `update`, `resize`, `teardown`). It moves the camera and runs the way in.
- `src/portal/ritual.ts` is the master timeline: the wrap, the fall and the opening.
- `src/portal/layers/wormhole.ts` draws the wormhole as a point cloud. `wormhole-cloud.ts` builds the cloud once, in a Web Worker.
- `src/portal/effects.ts` holds the screen space pieces: the streaks, the edge of the opening, and the final pass that cuts the hole the page shows through.
- `src/components/portal/portal-entry.tsx` mounts the canvas, listens for the scroll and the hold, and loads the scene on demand.

Open `/?debug` for the FPS meter and a panel that mirrors the config. Its timeline folder starts the way in, pauses it and scrubs through it.

```bash
pnpm portal:shots m7
```

That writes a still of every beat, desktop and phone, to `docs/portal/shots/m7/`, and checks that a short hold eases back and a scroll ends on the page. The dev server must be running. On a new machine, run `pnpm exec playwright install chromium` once first.

## Pinned versions

Every dependency in `package.json` is an exact version. Upgrade on purpose, one at a time.

| Package | Version | Used for |
|---|---|---|
| next | 16.4.6 | App Router, Cache Components, Turbopack |
| react, react-dom | 19.3.0 | |
| typescript | 5.9.3 | |
| tailwindcss | 4.3.3 | |
| three | 0.187.0 | The Portal scene, vanilla, no React Three Fiber |
| postprocessing | 6.39.6 | Bloom, chromatic aberration, grain, tone mapping. Supports three below 0.188. |
| lil-gui | 0.21.0 | Debug panel behind `?debug` |
| gsap, @gsap/react | 3.15.1, 2.1.2 | Scroll, type, and the entry timeline |
| lenis | 1.3.27 | Smooth scroll |
| motion | 14.14.0 | UI transitions |
| @next/mdx | 16.4.6 | Case studies |
| playwright | 1.63.0 | Screenshot script |
