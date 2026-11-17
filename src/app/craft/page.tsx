import type { Metadata } from "next";
import { Placeholder } from "@/components/site/placeholder";

export const metadata: Metadata = { title: "Craft" };

export default function Page() {
  return <Placeholder title="Craft" note="Live interaction pieces. Not built yet." />;
}
