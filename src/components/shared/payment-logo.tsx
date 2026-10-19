import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGOS = {
  wave: { src: "/brands/wave.png", alt: "Wave" },
  orange_money: { src: "/brands/orange-money.png", alt: "Orange Money" },
} as const;

export type BrandedMethod = keyof typeof LOGOS;

export function isBrandedMethod(method: string): method is BrandedMethod {
  return method in LOGOS;
}

/** Logo officiel Wave ou Orange Money. */
export function PaymentLogo({ method, className }: { method: BrandedMethod; className?: string }) {
  const logo = LOGOS[method];
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={64}
      height={64}
      className={cn("size-5 shrink-0 rounded-[5px] bg-white object-contain", className)}
    />
  );
}
