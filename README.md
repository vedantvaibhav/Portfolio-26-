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

The home page opens on a black and white wormhole, rendered in WebGL above a placeholder destination. Draw a circle and it becomes a ring of coloured light that opens the site. Enter or Space does the same from the keyboard.

- `src/portal/config.ts` holds every timing, colour and intensity. Change values there, nowhere else.
- `src/portal/scene.ts` is the scene class (`enter`, `update`, `resize`, `teardown`) and runs the ritual.
- `src/portal/ritual.ts` is the master timeline, from the loop closing to the site.
- `src/portal/recognize.ts` decides whether a stroke is a circle. `pnpm test` runs its tests.
- `src/portal/layers/` holds one file per thing in the scene: nebula, stars, wormhole, trail.
- `src/portal/effects.ts` holds the screen space pieces: the lens, the ring and its light, and the final pass that cuts the hole.
- `src/components/portal/portal-entry.tsx` mounts the canvas, feeds it the pointer and loads the scene on demand.

Open `/?debug` for the FPS meter and a panel that mirrors the config. Its timeline folder ignites the ring without drawing, pauses the opening and scrubs through it.

```bash
pnpm portal:shots m5
```

That draws a circle and writes a still of every beat, desktop and phone, to `docs/portal/shots/m5/`. The dev server must be running. On a new machine, run `pnpm exec playwright install chromium` once first.

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
| gsap, @gsap/react | 3.15.1, 2.1.2 | Scroll, type, and the opening timeline |
| lenis | 1.3.27 | Smooth scroll |
| motion | 14.14.0 | UI transitions |
| @next/mdx | 16.4.6 | Case studies |
| playwright | 1.63.0 | Screenshot script |
| vitest | 5.1.0 | Tests for the circle check |
