# Brief: build my portfolio site (vedantvaibhav.com)

You are building my personal portfolio site with me. Read this whole brief before you do anything. It covers who I am, what the site has to do, how it should look and move, how the copy should sound, and the sites I want you to study.

Anything marked **[TBD]** is a fact I still have to give you. Ask me for it. Do not invent it. If a sentence about me isn't in this brief, check with me before you put it on the site.

---

## 1. Who I am

- **Name:** Vedant Vaibhav
- **Role:** Senior Product Designer at ShopOS, Bangalore (since December 2025)
- **Experience:** about 4.5 years full time
- **What I do:** design, motion and engineering. I design the thing, animate it and ship it myself. I work in code every day with Claude Code, I ship my own pull requests, and I learned Swift to build a Mac app.
- **Background:** degree in Literature and Psychology. I treat interface design as a kind of writing.
- **How I see myself:** I'm a visual person. The site should show that before it says anything.

### Work history

| When | Where | What |
|---|---|---|
| Dec 2025 to now | ShopOS | Senior Product Designer. AI-native ecommerce platform where merchants direct AI agents (performance marketing, creative generation, Shopify builds). I also work on Sloosh, our AI image and video generation product, where I own the top of the funnel as well as product UI. |
| Mar 2024 to Dec 2025 | Mysa | Product Designer I, then II. B2B finance software. I owned Accounts Payable end to end, including AI bill capture. |
| Jul 2023 to Mar 2024 | Reevooy, Mumbai | Product design for B2B sourcing |
| Jun 2022 to Jun 2023 | CreateBytes (remote) | Product design |
| Aug 2021 to May 2022 | CM-Equity AG (freelance) | Internal tools for a German financial firm, during my final year of university |
| 2020 to 2021 | Under 25 Universe, Almish HealthCare | Visual design and design internships |

### Roles I'm going for

Senior product designer and design engineer roles at the best product companies: WhatsApp and Meta, OpenAI, Anthropic, Linear, Cursor, Stripe, Vercel. They look for three things: visible craft, prototypes in code, and clear decisions with outcomes. The site has to prove all three. My years are below some of their listings, so the work has to make me read as senior.

---

## 2. What the site has to do

1. **Sell me as a person in the first few folds.** That means my persona, not my biography: how I learn, how I move, what kind of designer this era has turned me into. No hometown story, no "my journey into design".
2. **Then prove it with the work.** Case studies that argue (problem, my decisions, outcome) for product roles. Built things you can touch for design engineer roles.
3. **Look and move like the best sites on the web.** Visual first, motion heavy, art directed. Not a template.

---

## 3. The story

This matters more than anything else in this brief, and it isn't settled yet. Your first job is to help me land it.

What I know so far:

- I like the line **"I can't leave things alone."** (I see something I like, I have to know how it's made, then I make one.) But the page must not keep repeating that pattern. A single line isn't enough. I need **several strong statements**, each one landing on proof.
- I want it to be **funny**. Dry humour, aimed at myself, never at engineers or users.
- **Not** biography-led. **Not** "the proper way to become a designer".
- One direction under consideration, **"I ran out of excuses"**: designers have the best excuses in tech, the tools got good, and one by one the excuses stopped working. Each fold crosses out an excuse and lands on a project:
  - ~~"The AI got it wrong."~~ → Mysa
  - ~~"Users will figure it out."~~ → ShopOS agents
  - ~~"That's a marketing problem."~~ → Sloosh
  - ~~"It's not in the sprint."~~ → Stash
  - ~~"Engineering said no."~~ → craft and code

  I haven't approved this one. Treat it as a starting point, and give me two or three alternatives at the same level.

Lines I've actually written (use them, they're real):
- Finance software is "the kind you don't close, you just minimize at the end of the day."
- "In finance, a hallucination is a write-off."

---

## 4. Sitemap

```
/              Home: the story (3 to 5 visual folds), then the work
/work/mysa     Bills that arrive pre-thought
/work/agents   ShopOS: one voice, many agents
/work/sloosh   Sloosh: the product and the funnel
/work/stash    Stash: the app my team switched to
/craft         Live interaction pieces (chat, loading, cards)
/skill         My design system skill for AI agents
/writing       One or two pieces
/about         How I work (a manual, not a bio), resume, contact
```

---

## 5. The projects

### Mysa, Accounts Payable (case study 1)
- AI bill capture for finance teams. I owned AP end to end.
- Outcome: time per bill went from **about 9 minutes to under 2**.
- Pilot: [TBD: confirm number of accountants, teams and length. An old draft says both 30 and 60 participants.]
- Rules for the page: state my role ("I", not "we"), put the outcome at the top, and show one option I rejected and why.
- An older version exists: https://mysa-bills-that-arrive-pre-thought.vercel.app/

### ShopOS agents (case study 2)
- Designing agentic chat. One orchestrator is the only voice that talks to the merchant. Sub-agents work in a side panel and report back. They never address the user.
- The problem: designing for output you can't predict.
- [TBD: outcome, numbers, recording]

### Sloosh (case study 3)
- AI image and video generation product inside ShopOS. I design the product UI and own the top of the funnel.
- [TBD: funnel numbers, what I changed and what moved]

### Stash (case study 4)
- A native macOS app I built on weekends in Swift: clipboard history, notes, file shelf, and meeting transcription.
- The ShopOS team adopted it and dropped Wispr Flow for it.
- For a buildathon I reframed it around a voice loop: select text on screen, ask about it out loud in your own language, get a spoken answer.
- [TBD: why I built it, screenshots, recording]

### Craft (section, not a case study)
- Small live pieces: chat, loading and card animations. Each one is interactive and on the page, not a video.

### Design system skill (my one product)
- A skill for AI coding agents that helps people generate a design system. [TBD: status, link]

### Leave these out
- My small web games (Tetris, Auto Rush, Yolk of Truth)
- Nami, and any "changelog" framing

---

## 6. Visual and motion direction

- **Visual first.** The opening should feel like Alt Carbon or Shopify Editions: rich, art directed, question-led.
- **Motion heavy, creative, art based, a bit cinematic.** Type that moves, illustration, film.
- **Not 3D worlds.** No "explore my island" or "drive a car" sites.
- **Craft at Rauno's level.** Every interaction considered down to the last detail.
- Respect `prefers-reduced-motion`. The site must read fully without animation.
- Fast. Nothing hidden at rest that only appears if a script runs.

### Suggested stack
Next.js with MDX, GSAP with ScrollTrigger (and SplitText for type), Lenis for smooth scroll, Motion for UI transitions. Use Three.js only if one moment truly needs it.

---

## 7. Copy rules

- Plain, dry, direct. Short sentences. Specific over abstract.
- No corporate words. No filler. No em dashes. No hyphens in the story copy.
- Nothing that sounds AI-written or "writerly". If a line could appear on anyone's portfolio, cut it.
- I own my work: say "I designed", "I shipped". Credit the team where they did the work.

---

## 8. References

Study these. For each one, tell me what you'd take from it.

### Benchmarks (on-scroll, visual, top 1%)
- Messenger, by Abeto: https://messenger.abeto.co
- Igloo Inc (Awwwards Site of the Year 2024): https://www.igloo.inc
- Lando Norris, by OFF+BRAND (Site of the Year 2025): https://landonorris.com
- Oryzo, by Lusion (funny and top 1% at once): https://oryzo.ai
- Lusion: https://lusion.co
- Cartier Watches & Wonders: https://www.cartier.com/en-fr/watchesandwonders
- Shopify Editions: https://www.shopify.com/editions/spring2026
- Explore Primland: https://explore.ownprimland.com
- Sleep Well Creative: https://sleep-well-creatives.com
- Alt Carbon: https://altcarbon.com
- Why Zero: https://zero.university

### Art, illustration, hand-drawn
- The Monolith Project: https://themonolithproject.net
- Aimee's Papercraft World: https://aimees-papercraft-world.com
- illoca: https://illoca.com
- Maxima Therapy (build story): https://tympanus.net/codrops/2026/04/06/building-the-maxima-therapy-website-react-gsap-and-dabbling-with-ai/
- Ruinart Digital Fresco: https://www.awwwards.com/sites/ruinart-digital-fresco
- Ponpon Mania (interactive comic): https://www.awwwards.com/sites/ponpon-mania

### Motion and type
- Mat Voyce: https://matvoyce.tv
- Uncommon Studio: https://uncommondesign.group
- By-Kin: https://by-kin.com
- Rive: https://rive.app
- Made With GSAP: https://madewithgsap.com
- Razorpay Sprint 26 (Indian team, Awwwards Site of the Day): https://www.awwwards.com/razorpay-sprint26-the-future-of-payments.html

### Designers and builders (personal sites)
- Rauno Freiberg: https://rauno.me
- Emil Kowalski: https://emilkowal.ski
- Paco Coursey: https://paco.me
- Jakub Krehel: https://jakub.kr
- Artur Bień: https://expensive.toys
- uilabs: https://uilabs.dev
- abjt: https://abjt.dev
- Benji Taylor: https://benji.org
- Gavin Nelson: https://nelson.co
- Ryo Lu: https://ryo.lu
- Kuldar Kalvik: https://kuldar.com
- Hardik Pandya (see his "Working with me" page): https://hvpandya.com
- Léo Parpeix: https://www.awwwards.com/leoparpeix/

### Film and motion directors
- GMUNK: https://gmunk.com
- Extraweg (Oliver Latta): https://extraweg.com
- Andreas Wannerstedt: https://andreaswannerstedt.se
- John Likens: https://www.johnlikens.com
- Nadia Tzuo: https://nadiatzuo.com
- VUCKO: https://vucko.co
- Jonas Naimark (product motion, Airbnb): https://jonasnaimark.com
- Riley McMath Walker (motion, Shopify): https://www.rileymcmathwalker.com
- Daniel Cardozo (product UI motion): https://danielcardozo.design
- Partizan: https://www.partizan.com

### Studios (their own sites are the showcase)
- Locomotive: https://locomotive.ca
- Immersive Garden: https://immersive-g.com
- Active Theory: https://activetheory.net
- Obys: https://obys.agency
- Unseen Studio: https://unseen.co
- makemepulse: https://www.makemepulse.com

---

## 9. How to work with me

1. **Start by asking.** List every [TBD] in this brief and ask me for it in one go.
2. **Story first.** Give me three story directions, each written out as real home page copy, one line per fold. No layouts yet.
3. **Then a moodboard.** For the story I pick, choose 5 or 6 references from section 8 and say exactly what to take from each: a transition, a type treatment, a pacing choice.
4. **Then the hero and first three folds.** Build them in code, get them right, then move on.
5. **Then the case study template.** Build Mysa first.
6. Show me work early and often. Small versions I can react to beat a finished site I didn't ask for.
