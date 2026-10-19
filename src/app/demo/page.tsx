import type { Metadata } from "next";
import { DemoLogin } from "@/components/landing/demo-login";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Démonstration", robots: NO_INDEX };

export default function DemoPage() {
  return <DemoLogin />;
}
