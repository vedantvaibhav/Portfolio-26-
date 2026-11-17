"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

// Import GSAP from here, never from "gsap" directly, so plugins register once.
gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/**
 * Every animation lives inside gsap.matchMedia().add(MOTION_OK, ...).
 * With reduced motion on, the callback never runs and the page stays
 * in its resting state, which is the full, readable page.
 */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger, SplitText, useGSAP };
