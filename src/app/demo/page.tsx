import type { Metadata } from "next";
import { DemoLogin } from "@/components/landing/demo-login";

export const metadata: Metadata = { title: "Démonstration" };

export default function DemoPage() {
  return <DemoLogin />;
}
