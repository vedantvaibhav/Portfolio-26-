import type { Metadata } from "next";
import { Placeholder } from "@/components/site/placeholder";

export const metadata: Metadata = { title: "Skill" };

export default function Page() {
  return <Placeholder title="Skill" note="My design system skill for AI agents. Not built yet." />;
}
