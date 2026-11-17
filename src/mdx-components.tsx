import type { MDXComponents } from "mdx/types";

// Shared components for every .mdx file. Case study building blocks
// (figure, outcome, rejected option) get registered here as they are built.
const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
  return components;
}
