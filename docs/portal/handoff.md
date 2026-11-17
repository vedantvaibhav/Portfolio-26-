# Handoff: the Portal entry for vedantvaibhav.com

**For:** Claude Code
**From:** Vedant (with Claude in chat)
**Goal:** build the first screen of my portfolio. It's a WebGL entry ritual at the level of zero.university and lusion.co. The visitor arrives in an open, living space, draws a circle, and the circle becomes a ring of light that opens and pulls them into the site.
**Scope of this handoff:** the entry only. The site behind it ("the insides") comes later, so use a simple placeholder destination for now.

Read this whole file before writing code. Work in milestones (section 10), and stop for my review at the end of each one.

---

## 0. The bar

Two sites define the bar:

- **zero.university:** the ritual. The site is locked, with no enter button, just a prompt to draw a zero. When the loop closes, the experience opens from the stroke.
- **lusion.co:** the look. A dark space, a tiny figure floating, and a huge soft ring of rainbow light around it. It feels calm, expensive and cinematic.

If a frame we make wouldn't hold up next to a screenshot of either site, it isn't done.

There's also a rough 2D prototype of the behaviour: the "Portal" tab at https://claude.ai/artifact/UpWernkGWmUprow228TnwF. Treat it as a sketch of the timing and flow only. Don't reuse its look.

---

## 1. The experience, beat by beat

### Beat 1: Arrival (0 to about 3 s)
- The page loads straight into **open space**. It is deep and dark, but not flat black.
- Things in it are alive, slowly:
  - Distant **stars** in 2 or 3 depth layers, with faint twinkle and parallax.
  - Faint **nebula dust**, an indigo haze with a touch of warm marigold and coral (my brand colours) far away.
  - **One or two planets** far off, one partly lit by a distant sun with a thin glowing atmosphere rim. They rotate very slowly.
  - **Drifting debris** near the camera, a few soft, out-of-focus particles that cross the frame occasionally.
  - *Signature option (please prototype):* among the debris, a few tiny **pieces of interface floating in space**, like a cursor, a toggle, a bezier handle or a button. They read as space junk until you look closely. That's me in one image: someone who takes interfaces apart.
- The camera drifts very slowly and breathes. The pointer adds a small parallax: the camera leans a few degrees, lerped and never twitchy.
- After about 1.2 s, a single quiet prompt fades in, bottom centre: **"Draw a circle."** (On touch: "Draw a circle with your finger.")
- No logo wall, no nav, no "scroll down". Just space and one instruction.

### Beat 2: Drawing
- The pointer or finger leaves a **trail of light**, thin and bright with a soft glow. It fades along its tail if the visitor stops.
- Speed changes the trail: faster is brighter and thinner, slower is softer and wider.
- Optional: tiny sparks shed off the trail; the soundscape is in section 6.
- Scrolling and page movement are blocked while drawing (`touch-action: none` on the canvas).

### Beat 3: Recognition (when the loop closes)
- Check the stroke with geometry, not ML (section 4). If it passes:
  - The hand-drawn stroke **snaps to a perfect circle** around its own centre and radius. About 240 ms, ease-out, and it should feel magnetic.
  - Haptic tick on mobile (`navigator.vibrate(10)` where supported).
  - A soft "ping".
- If it fails, there's no error colour. The trail dissolves and the prompt changes:
  - Open loop: "Close the loop."
  - Too small: "Bigger."
  - Too messy: "Rounder."
  - After 2 failures, a faint dotted guide ring appears to trace.
  - After 3 failures, a small "Or just come in →" link appears.

### Beat 4: Ignition (about 240 to 900 ms after the snap)
- The circle **ignites into the ring**:
  - A thick, soft band of **spectral light**: rainbow dispersion like light through a prism, with red outside and blue inside, plus thin-film iridescence that shifts slowly around the ring.
  - **Bloom** blooms. A faint wobble in the ring's width (noise) makes it feel alive and not vector-perfect.
  - The space **inside** the ring starts to **lens**: background stars bend around the ring edge, like gravitational lensing.
- Everything gets **pulled toward the ring**. Particles accelerate inward, the camera pushes in a few percent, and a low rumble rises.
- This is the held breath before the jump. Keep it about 500 to 650 ms. Too short is cheap, too long is boring.

### Beat 5: The opening (about 900 to 2,100 ms)
- The ring **expands** exponentially (slow, then very fast) until it passes the viewport edges.
- Inside the ring we see **the destination**: the placeholder site, starting scaled up and blurred and settling as the ring passes.
- **Stars stretch into warp streaks** radiating from the ring centre.
- **Chromatic aberration** ramps up during the expansion, then falls back to zero.
- A short **light swell** as the ring edge crosses the screen edge: at most about 150 ms, never full white, and never more than one flash. Keep it safe for photosensitive visitors.
- A whoosh tracks the expansion. The ring's last pass gets a soft "air" tail.

### Beat 6: Arrival in the site
- The WebGL scene **tears down** or drops to a near-idle background (milestone 4 decides which).
- Focus moves to the destination content for keyboard and screen readers.
- For now the placeholder destination is: my name, "Design, motion and engineering.", and a "Replay" link.

### Total timing target
From the loop closing to settling in the site: **about 2.0 to 2.3 s**. Every number above is a starting point. Put all of them in the debug panel (section 8) so I can tune them by feel.

---

## 2. Look development

- **Palette:**
  - Space: `#05060a` to `#0b0f1c`.
  - Nebula: indigo `#33416b` at low intensity, with trace marigold `#e9a321` and coral `#f1a98c` far away.
  - Ring: full spectrum.
- **Light:** one distant key light (the sun) for the planets. Everything else is emissive or baked.
- **Camera:** about 35 to 45° FOV. Very shallow depth of field on near debris only, so the planets and stars stay sharp.
- **Film finish:** fine grain, slight vignette, ACES or AgX tone mapping, and a little chromatic aberration at the edges at rest (very little).
- **Restraint:** one hero moment, the ring. Everything else serves it, so no competing glows.
- **Type:** prompt in IBM Plex Mono, 13 px, letter-spaced, at about 70% opacity. Destination headline in Newsreader italic. These are my current choices.
- **References to pull look-dev frames from:** lusion.co (ring, space, bloom), igloo.inc (calm 3D and precision), messenger.abeto.co (charm), oryzo.ai (film grain and light leaks).

---

## 3. Stack (pin every version and note it in the README)

- **App:** Next.js (App Router) and TypeScript. The entry is a client component that lazy-loads the scene.
- **3D:** **Three.js, vanilla, inside a small class with `enter / update / resize / teardown` hooks.** No React Three Fiber for this piece: we want total control of the frame loop and GPU uploads, the way the Zero team built theirs.
- **Renderer:** start with `WebGLRenderer` plus pmndrs `postprocessing` (bloom, chromatic aberration, noise, vignette, tone mapping). That gives the widest device support, including Android and Firefox on Linux.
  - Keep the shader code organised so a later switch to `WebGPURenderer` + TSL is feasible. Don't do the switch in v1.
- **Animation:** GSAP for the master timeline of the opening sequence. One timeline, scrubbable in the debug panel.
- **Audio:** Web Audio API directly, or Howler if it's simpler.
- **Debug:** `lil-gui` or Leva, behind a `?debug` flag, with every tunable exposed.
- **Asset tools:** Blender (current stable release), `@gltf-transform/cli` (meshopt or Draco geometry, KTX2 textures), `toktx` / KTX-Software.
- **Self-host decoders** (Draco, Basis/KTX2) in `/public/vendor/`. Never load them from a CDN. A CDN slowdown broke decoding on the Zero site.

---

## 4. Gesture recognition (geometric, like Zero)

Zero's team describes their check as total rotation near 2π, low variance in radius (the stroke is round), and the start-to-end gap smaller than the average radius (the loop is closed). Do the same:

```
points: resample the stroke to evenly spaced points (every ~6 px)
centre: mean of points
r: mean distance to centre
roundness: stddev(distances) / r            → pass if < 0.35 to 0.40
sweep: sum of signed angle deltas around centre → pass if |sweep| > 5.0 rad (about 290°)
closure: gap(start, end) < 0.9 * r  OR  |sweep| > 6.0 rad
size: r > max(40px, 6% of the short viewport side)
```

- Accept either direction, and overshoot (more than 2π) is fine.
- Run the check live while drawing too. If the loop closes mid-stroke, ignite immediately without waiting for pointer-up. That feels magical.
- Unit-test the check with recorded strokes: good circles, ovals, spirals, a "C", scribbles, and tiny circles.

---

## 5. Rendering plan

| Element | Technique |
|---|---|
| Background space and nebula | One full-screen quad. FBM noise in GLSL, two colour layers, very slow drift. No textures. |
| Stars | `THREE.Points` in 3 depth layers, instanced, per-star size and twinkle phase. Warp streaks in beat 5 come from stretching points along the radial direction in the vertex shader (or a second line-segment pass). |
| Planets | Blender-made (section 7) with baked albedo and normal maps, plus a **fresnel atmosphere rim in shader** (not baked). Slow rotation. |
| Debris and interface pieces | Low-poly meshes from Blender with baked lighting. Instanced where possible. Depth-of-field look via soft sprite impostors for the near ones. |
| Light trail | Screen-space ribbon. The last N points become a triangle strip with width from speed. Additive blending into a half-res buffer so bloom catches it. |
| The ring | Ring geometry or a full-screen SDF shader. Distance to circle → band falloff. Sample a spectral ramp three times at offset radii (R, G, B) for dispersion. Add a thin-film colour shift by angle and time, and noise on the width. Draw it HDR so bloom picks it up. |
| Lensing | Screen-space distortion pass: offset UVs radially near the ring edge, scaled by a lens-strength uniform that ramps in beat 4. |
| Opening reveal | WebGL canvas sits **above** the DOM destination. Output premultiplied alpha. In beat 5 the shader cuts a soft-edged hole (radius = ring radius) so the DOM shows through. The DOM's scale and blur are animated on the same GSAP timeline. Text stays real HTML: crisp, selectable, indexable. |
| Post | Bloom (mipmap blur), chromatic aberration (driven by the timeline), noise and grain, vignette, tone mapping. |

---

## 6. Sound

- **Ambient:** a very low, slow space drone, looping seamlessly. Silent until the first pointer-down (browsers block autoplay anyway), then it fades in over 1.5 s.
- **Drawing:** a filtered noise "whisper" whose filter cutoff and volume follow stroke speed.
- **Snap:** a soft glassy ping.
- **Ignition:** a rising sub rumble.
- **Opening:** a whoosh that tracks the expansion curve, then an air tail.
- Trigger sounds **from rendered frames, not timers**, so they stay in sync on slow devices. The Zero team tied their glass-break sound to the first rendered frame for exactly this reason.
- A visible sound toggle, remembered in `localStorage`.
- **I'll source or commission the final sounds.** Build with placeholder synthesised sounds and leave clean hooks.

---

## 7. Blender pipeline

You (Claude Code) can't open Blender's interface. Either I do the Blender steps by hand following this section, or we connect a Blender MCP server so you can drive Blender with Python. Check that option and tell me what it needs before we rely on it.

1. **Install** the current stable Blender.
2. **Planets** (2, maybe 3):
   - UV sphere, about 64 segments. Stylised surfaces from procedural noise (bands, craters, soft continents), in muted tones that sit inside the palette.
   - **Bake** albedo (and normal, if relief is worth it) at **2K** for the hero planet and **1K** for the others.
   - The atmosphere is a shader in Three.js, not part of the Blender asset.
3. **Interface debris** (cursor, toggle, bezier handle, button, maybe a small "</>" chip):
   - Low poly, bevelled edges, soft clay or ceramic look.
   - **Bake** lighting and AO into one shared **atlas** (1K or 2K). Every piece offsets its UVs into the atlas.
4. **Export** glTF 2.0 (`.glb`), Y-up, applied transforms, no unused data.
5. **Compress:**
   ```
   gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2
   ```
   Use ETC1S for colour maps and UASTC for normals. Compare against the originals in a side-by-side viewer page (`/lab/assets`) and tune each asset.
6. **Remember VRAM:** a 2048² texture costs about 16 MB of GPU memory when decoded, whatever its file size, while KTX2 stays compressed on the GPU. That's why we use KTX2, atlases and power-of-two sizes.

---

## 8. Performance, quality tiers and loading

**Budgets**
- Everything needed before the first interaction is **≤ 3 MB** over the wire (JS + assets). The Zero site came in under 10 MB for a six-act story, down from 35 to 40 MB in early builds. We have one scene, so be stricter.
- First space frame visible in **under 1.5 s** on a good connection. Show a dark gradient plus the prompt immediately, and fade the 3D in when ready.
- **60 fps** on a recent iPhone, a mid-range Android, and an M1 MacBook Air. Draw calls under 50.

**Adaptive quality**
- Keep a rolling average of frame time. Step down a tier above about 22 ms (≈45 fps) and up below about 12 ms (≈83 fps), with a cooldown so it doesn't oscillate. These are the thresholds the Zero team used.
- Tiers change polish only: DPR (desktop cap 2, mobile cap 1.5), bloom resolution, star count, lensing on or off, debris count. **The experience itself is identical on every device.**
- During the opening (beat 5), temporarily drop DPR and expensive passes. Nobody can see detail in a warp.

**Loading and jank**
- Lazy-load the scene module. Decode images off the main thread (`createImageBitmap`) and upload textures in `requestIdleCallback`, a little per frame. GPU uploads on the main thread were Zero's biggest stutter source, around 50 ms each.
- **Pre-compile every shader** (`renderer.compile`) and warm up the ring and post passes during idle time, so the first ignition never hitches.
- Use explicit **`highp float`** in shaders that need it. On Adreno and Mali GPUs `mediump` is a real 16-bit float and causes banding that desktop never shows. **Test on a real Android phone in milestone 1, not at the end.**

---

## 9. Accessibility and edge cases

- **Always offer a way in without drawing:** a quiet "Enter" button (bottom corner, visible from the start, keyboard-focusable), and `Enter` or `Space` on the page triggers a perfect-circle ignite.
- **`prefers-reduced-motion`:** no warp, no camera push. The ring fades in and the destination crossfades over 400 ms.
- **No WebGL or GPU failure:** fall back to a static image of the space, then the prompt and Enter button, then a CSS crossfade.
- **Returning visitors:** remember completion in `localStorage`. Next time, show the space for about 1 s, then a shorter auto-open (they can still draw if they want). Never make someone do the ritual twice in a session.
- **Screen readers:** the canvas has an `aria-label` describing the scene. The prompt and the Enter button are real DOM. Move focus to the destination's `h1` after opening.
- **Deep links** (`/work/...`) skip the ritual entirely.
- **Resize and rotation** mid-ritual: reset cleanly to beat 1.

---

## 10. Milestones (stop for review after each)

| # | Milestone | Done when |
|---|---|---|
| 0 | **Setup:** repo, pinned versions, scene class, debug panel, FPS meter, Playwright screenshot script | `npm run dev` shows a dark canvas with an FPS meter and the debug panel |
| 1 | **Space look-dev:** nebula, stars, placeholder planet spheres, drift, parallax, grain | Still frames sit credibly next to a Lusion screenshot. 60 fps on a real Android phone. |
| 2 | **Drawing and recognition:** light trail, geometric check with unit tests, fail feedback, snap-to-circle | Every recorded test stroke is classified correctly, and drawing feels good on trackpad, mouse and touch |
| 3 | **The ring:** spectral ring shader, bloom, lensing, ignition beat | Paused mid-ignition, the frame looks like a poster |
| 4 | **The opening:** GSAP master timeline, expanding ring, warp streaks, chromatic aberration, DOM reveal through the alpha hole, teardown | Smooth end to end, total 2.0 to 2.3 s, no hitch on first run |
| 5 | **Sound:** placeholder synth sounds on frame-synced hooks, sound toggle | Sound stays in sync when throttled to 4× CPU slowdown |
| 6 | **Blender assets:** real planets and interface debris swapped in, compressed, atlas, `/lab/assets` comparison page | Total pre-interaction payload ≤ 3 MB |
| 7 | **Hardening:** quality tiers, reduced motion, no-WebGL fallback, returning visitors, accessibility checks | Passes the device matrix: iPhone (Safari), mid Android (Chrome), Mac (Safari, Chrome, Firefox), Windows (Chrome, Edge) |
| 8 | **Polish:** timing tuned with me live, final sounds dropped in, recorded GIF and MP4 of the full ritual | I say it's done |

For every milestone, record a short screen capture (Playwright video or a GIF), plus still frames at key moments, and list anything you're unsure about.

---

## 11. Working rules

- **Ask me** before making visual or copy decisions that aren't covered here. Offer 2 or 3 options with frames, not prose.
- Never ship placeholder text as final. Mark it `[PLACEHOLDER]` in code.
- Keep every timing, colour and intensity in **one config file**, mirrored in the debug panel. I'll tune by feel.
- Commit small, with clear messages. Don't rewrite working systems without asking.
- Performance regressions are bugs. Check fps on every milestone.

---

## 12. References

- zero.university: the draw-a-zero entry ritual. https://zero.university
- Engineering breakdown of Zero, in Russian but very detailed: https://tproger.ru/articles/zero-na-three-js-inzhenernyj-razbor-interaktivnogo-sajta
- The original Codrops write-up, "ZERO: The Engineering Behind a Defiant Interactive Narrative": https://tympanus.net/codrops/2026/07/17/zero-the-engineering-behind-a-defiant-interactive-narrative/
- lusion.co: space, ring and bloom. https://lusion.co
- Igloo Inc: calm, precise 3D on scroll. https://www.igloo.inc
- Messenger by Abeto: charm. https://messenger.abeto.co
- Oryzo by Lusion: film grain, light leaks, humour. https://oryzo.ai
- Three.js WebGPURenderer manual, for later: https://threejs.org/manual/en/webgpurenderer
- My rough behaviour prototype (Portal tab): https://claude.ai/artifact/UpWernkGWmUprow228TnwF
- My full site brief (who I am, voice, sitemap): `docs/brief.md`

---

## Process note from Vedant

Go step by step. First approve the pictures, the storyboard, and everything, and only then go on to creating the visuals.
