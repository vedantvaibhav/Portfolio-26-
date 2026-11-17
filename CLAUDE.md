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
- Storyboard v2 is approved with these calls: space close to black, no interface debris, planets small, far and dim, snapped circle 15% bigger than the stroke, soft band ring with a small chromatic split at ignition.
- Milestone 0 (setup) is built. Code lives in `src/portal/` and `src/components/portal/`. Every tunable goes in `src/portal/config.ts`; the `?debug` panel is generated from it.
- Check a milestone with `pnpm portal:shots <label>` against a running dev server. Headless FPS is software rendered, so it is a smoke test only.
- Brand colours: indigo `#33416b`, marigold `#e9a321`, coral `#f1a98c`. Type: IBM Plex Mono for the prompt, Newsreader italic for the destination headline.
