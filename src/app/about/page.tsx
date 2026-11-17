import type { Metadata } from "next";
import { Placeholder } from "@/components/site/placeholder";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return <Placeholder title="About" note="How I work, resume, contact. Not built yet." />;
}
