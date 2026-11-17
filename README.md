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

The home page opens on a WebGL canvas above a placeholder destination.

- `src/portal/config.ts` holds every timing, colour and intensity. Change values there, nowhere else.
- `src/portal/scene.ts` is the scene class: `enter`, `update`, `resize`, `teardown`.
- `src/portal/layers/` holds one file per thing in the scene: nebula, stars, planet, dust.
- `src/components/portal/portal-entry.tsx` mounts the canvas and loads the scene on demand.
- Open `/?debug` for the FPS meter and a panel that mirrors the config.

```bash
pnpm portal:shots m1
```

That writes desktop and phone screenshots and a short screen capture to `docs/portal/shots/m1/` and prints the FPS reading. The dev server must be running. On a new machine, run `pnpm exec playwright install chromium` once first.

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
