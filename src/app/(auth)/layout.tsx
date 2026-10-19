import { BellRing, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const POINTS = [
  { icon: BellRing, title: "Alertes avant la rupture", text: "Sachez à tout moment ce qu'il vous reste." },
  { icon: MessageCircle, title: "WhatsApp intégré", text: "Reçus, récapitulatifs et rappels de dettes en un clic." },
  { icon: ShieldCheck, title: "Votre équipe, vos règles", text: "Vos vendeurs ne voient jamais vos marges." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0a5a41] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.22),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(39,168,124,0.45),transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:44px_44px]"
        />
        <Link href="/" className="relative">
          <Logo inverted />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="text-xs font-medium tracking-[0.14em] text-saffron uppercase">En boutique comme en ligne</p>
          <h1 className="mt-4 text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.035em]">
            La gestion de stock des commerçants{" "}
            <span className="font-display font-normal tracking-normal text-saffron italic">sénégalais.</span>
          </h1>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15 ring-inset">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-[0.9375rem] font-medium">{title}</span>
                  <span className="text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-sm text-white/60">Fait avec soin pour le Sénégal.</p>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="mx-auto mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="m-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
