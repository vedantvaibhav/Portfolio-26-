import type { Metadata } from "next";
import { Placeholder } from "@/components/site/placeholder";

export const metadata: Metadata = { title: "Writing" };

export default function Page() {
  return <Placeholder title="Writing" note="Not built yet." />;
}
