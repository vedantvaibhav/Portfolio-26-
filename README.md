# vedantvaibhav.com

Personal portfolio of Vedant Vaibhav.

```bash
pnpm install
pnpm dev
```

Needs Node 22 and pnpm 10.

To pick up the latest changes and start clean in one go:

```bash
pnpm fresh
```

That pulls, installs anything new, clears the build cache and starts the dev server. Day to day, `git pull` in a second terminal is enough while `pnpm dev` keeps running; the browser reloads itself.

- `docs/brief.md` is the brief the site is built from.
- `docs/portal/handoff.md` is the spec for the Portal entry. `docs/portal/storyboard/` holds the approved storyboard.
- `CLAUDE.md` holds the working rules for copy, motion and facts.
- `src/content/work/` holds the case studies as MDX.

## The Portal entry

The home page opens on a black screen with one large number at the bottom left, rolling from 0 to 100. At 100 it rolls away and a wormhole comes up, rendered in WebGL. A mark of moving rings in the middle of the hole says to hold. A press and hold inside the hole draws every grain to that point; when they are gone the text of the page comes up on the black. A ring around the pointer shows how long is left; let go early and it all comes back. A press anywhere else only points at the mark. A scroll, the arrow keys, Space and Enter work like a hold at the centre.

- `src/portal/config.ts` holds every timing, colour and intensity. Change values there, nowhere else.
- `src/portal/scene.ts` is the scene class (`enter`, `update`, `resize`, `teardown`). It runs the way in and works out whether a hold landed inside the hole.
- `src/portal/ritual.ts` is the master timeline: the drain, then the site appearing.
- `src/portal/layers/wormhole.ts` draws the wormhole as a point cloud and moves the grains toward the drain point. `wormhole-cloud.ts` builds the cloud once, in a Web Worker.
- `src/portal/effects.ts` is the final pass: vignette and film grain.
- `src/components/portal/portal-entry.tsx` mounts the canvas, listens for the scroll and the hold, and loads the scene on demand.

Open `/?debug` for the FPS meter and a panel that mirrors the config. Its timeline folder starts the way in, pauses it and scrubs through it.

```bash
pnpm portal:shots m13
```

That writes a still of every beat, desktop and phone, to `docs/portal/shots/m13/`, and checks the hold and the scroll. The dev server must be running. On a new machine, run `pnpm exec playwright install chromium` once first.

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
