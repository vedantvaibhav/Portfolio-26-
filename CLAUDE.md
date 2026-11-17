@AGENTS.md

# vedantvaibhav.com

Vedant Vaibhav's portfolio. The full brief is in `docs/brief.md`. Read it before any design or copy work.

## Commands

- `pnpm dev` runs the site at localhost:3000
- `pnpm build` is the check that matters (types and prerender)
- `pnpm lint`

## Stack

Next.js 16 (App Router, Cache Components, Turbopack), TypeScript, Tailwind 4, MDX through `@next/mdx`, GSAP with ScrollTrigger and SplitText, Lenis, Motion. No Three.js unless one moment truly needs it.

- GSAP owns scroll and type. Motion owns UI state transitions inside components. Do not mix them on one element.
- Import GSAP from `@/lib/gsap`, never from `gsap`, so plugins register once.
- Case study bodies are MDX in `src/content/work/`. The list and order live in `src/lib/work.ts`.
- Cache Components keeps the previous route in the DOM, hidden, after navigation. Scope every selector to a ref. Never query the whole document.

## Facts about Vedant

Never invent one. If a sentence about Vedant, a number, or an outcome is not in `docs/brief.md`, ask before it goes on the site. Items marked TBD in the brief stay out until Vedant supplies them.

## Copy

- Plain, dry, direct. Short sentences. Specific over abstract.
- No corporate words. No filler. No em dashes. No hyphens in the story copy.
- Nothing that sounds AI written. If a line could sit on anyone's portfolio, cut it.
- "I designed", "I shipped". Credit the team where they did the work.
- Humour is dry and aimed at Vedant, never at engineers or users.

## Case studies

State the role as "I". Outcome at the top. Show one rejected option and why.

## Motion

The page must read fully without animation and without JavaScript.

- The HTML and CSS describe the finished state. Animations start from somewhere else and arrive there.
- Wrap every animation in `gsap.matchMedia().add(MOTION_OK, ...)`. Reduced motion means the callback never runs.
- Below the fold: set the start state in JS inside that callback (see `ScrollRise`). No CSS hiding.
- On screen at load: mark the element `data-reveal` and set `data-revealed` when the script takes over (see `SplitReveal`). The rule in `globals.css` hides it only when scripting is on and motion is allowed, and a CSS failsafe shows it after 3 seconds if the script never runs. This is the only allowed way to hide content at rest.
- Lenis runs off the GSAP ticker in `SmoothScroll` and is off under reduced motion.

## Leave out

Web games (Tetris, Auto Rush, Yolk of Truth), Nami, and any "changelog" framing.

## The Portal entry

The first screen is a WebGL entry ritual: draw a circle, it becomes a ring of light, the site opens through it. The spec is `docs/portal/handoff.md`. Work in its milestones and stop for Vedant's review after each one.

- Storyboard: `docs/portal/storyboard/` (published at https://claude.ai/artifact/84tisomSshYJXEBg4GsW9R). `frames.html` is a throwaway concept shader, not the production scene. Re-render with `NODE_PATH=$(npm root -g) node docs/portal/storyboard/render.mjs`.
- Storyboard is approved with these calls: space close to black, no interface debris, planets small, far and dim, snapped circle 15% bigger than the stroke, soft band ring with a small chromatic split at ignition.
- Later calls from Vedant: no blue planet (colour still to be picked from dusk, bone or marigold). Only two fail messages, "Draw a circle." for a wrong shape and "Close the loop." for an open one; no "Bigger.", "Rounder." or "Or just come in". The circle check is generous, and the ring starts where the stroke was drawn. Dust pulled toward the ring is scattered specks on a slight spiral, not straight radial dashes.
- Earlier calls, partly superseded by the wormhole direction below: nothing on screen but the space and the prompt. No Enter button and no sound toggle. The circle is the way in. An Enter or Space key press and a skip button that only shows on keyboard focus stay as the accessible path. Vedant said "no sound here"; treat sound (milestone 5) as on hold and confirm with him before building it.
- The storyboard frames still show the older bone planet and the corner labels. The build is the reference now.
- New direction from Vedant (replaces the planets and the coloured haze): the space is fully black and white, a wormhole falling into a black hole (`src/portal/layers/wormhole.ts`). No colour anywhere until the ring ignites. Ignition and opening are slower (1.2 s and 2.1 s).
- How the wormhole must be made: as a dense point cloud, the way Shopify Editions Spring '26 builds its hero. About a million tiny points of nearly equal brightness; the picture comes from how many land in each place. Vedant rejected two earlier versions as not realistic: sparse bright dots on a flat disc, and anything that fakes grain on a surface. His references are monochrome particle fields around a dark void; match the feel, do not copy any one image.
- Vedant had the background stars and haze removed: the frame is pure black with only the wormhole. He took them for a stock image of space.
- How the drain must look: each grain leaves on its own, at its own moment, and flies to the point, while the wormhole holds its shape and thins out. Vedant rejected the first version, where every grain followed one smooth rule, because it read as the whole screen bending. Never move the picture as one sheet.
- Layout (Vedant's calls): the disc is flipped so the empty part of the frame is the top left, where his name sits large with his role under it (wording still a placeholder). The black of the hole is a touch right of centre. In the middle of the hole, in the system face (SF Pro on Apple devices, which cannot be served as a web font), a short line telling people to hold. At the bottom, just "Scroll". He rejected "Scroll, or hold the dark."
- Latest shape of the entry (Vedant's calls): first a black screen with only a count from 0 to 100; at 100 the wormhole comes up. No words on the wormhole at all. A press outside the hole only shows where to hold (a ring closes onto the middle of the hole). A hold inside the hole drains the grains and reveals the page's text on the black while they leave; letting go takes it away again. The cover is laid over the page with `mix-blend-mode: screen` so the text can show under the grains. The revealed text is still a placeholder: his name large in the top left, his role, and Replay.
- More of Vedant's calls: no "Scroll" wording anywhere (a scroll still works, unannounced). A hold runs 20% faster than a scroll. While holding, a ring around the pointer fills to show how long is left, and replaces the cursor.
- Pointer (Vedant's calls): he likes the whole thing shifting slightly in parallax, so the camera slides more than it turns and near grains move more than far ones. Grains near the pointer are nudged aside, each by its own amount.
- Current way in, as Vedant specified it: a scroll draws every grain into the centre of the hole, where it vanishes. A press and hold inside the hole does the same wherever the hold is; a hold outside the hole does nothing; letting go early brings the grains back. The frame is left black and the site appears on that same black, so black is common to both sides. No camera move, no colour. Earlier versions, all removed: drawing a circle with a chromatic ring (last at abd0eef), and a camera fall into the hole (596f981). The prompt wording ("Scroll, or hold the dark.") is a placeholder for Vedant to confirm.
- Shader rules learned the hard way (the scene drew only a strip on Vedant's Mac while looking fine in headless Chromium): never call `pow()` with a base that can be negative, square by multiplying; never call `smoothstep()` with its edges reversed, write `1. - smoothstep(low, high, x)`. Both are undefined in GLSL, pass in software rendering, and produce invalid pixels on real GPUs that the bloom then smears across the frame. Headless checks cannot catch this class of bug.
- Smoothness is a requirement, measured against Shopify Editions: the point cloud is built once in a Web Worker (`wormhole-cloud.ts`) and fades in, and `adapt()` in `scene.ts` draws a smaller share of it when frames run long.
- This session's environment is named Portfolio-26- and allows shopify.com. Other reference sites are still blocked.
- Milestones 2 to 4 are built as one prototype: light trail, circle check (`src/portal/recognize.ts`, tested with `pnpm test`), snap, ring, lensing, and the opening on one GSAP timeline (`src/portal/ritual.ts`). The page shows through a hole cut by the final pass in `src/portal/effects.ts`. Not yet reviewed by Vedant on a real device.
- Still to do: sound (on hold), Blender assets, quality tiers, returning visitors, no-WebGL fallback, real device testing, timing polish with Vedant.
- Milestone 1 (space look-dev) is built: `src/portal/layers/` holds the wormhole and the trail, `src/portal/film.ts` the grain and vignette. Shader colours are authored in display space and converted with `toLinear()`.
- If styles look stale after a dev server restart, delete `.next` and start it again.
- Milestone 0 (setup) is built. Code lives in `src/portal/` and `src/components/portal/`. Every tunable goes in `src/portal/config.ts`; the `?debug` panel is generated from it.
- Check a milestone with `pnpm portal:shots <label>` against a running dev server. Headless FPS is software rendered, so it is a smoke test only.
- Brand colours: indigo `#33416b`, marigold `#e9a321`, coral `#f1a98c`. Type: IBM Plex Mono for the prompt, Newsreader italic for the destination headline.
