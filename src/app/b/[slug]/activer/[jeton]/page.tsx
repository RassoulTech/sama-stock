import { CircleAlert, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivateInvitedDeviceForm } from "@/components/auth/activate-invited-device";
import { ShopShell } from "@/components/auth/shop-shell";
import { Button } from "@/components/ui/button";
import { verifyDeviceInvite } from "@/lib/domain/device-invite";
import { NO_INDEX } from "@/lib/seo";
import { shopBySlug } from "@/server/queries/shop-login";
import { readDevice } from "@/server/services/devices";

export const metadata: Metadata = { title: "Activer cet appareil", robots: NO_INDEX };

/** Page ouverte en scannant le QR code du propriétaire : active ce téléphone pour les codes PIN de la boutique. */
export default async function ActivateDevicePage({ params }: { params: Promise<{ slug: string; jeton: string }> }) {
  const { slug, jeton } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) notFound();

  const invite = verifyDeviceInvite(process.env.BETTER_AUTH_SECRET ?? "", decodeURIComponent(jeton));
  const device = await readDevice();
  const already = device?.businessId === shop.id;

  return (
    <ShopShell shop={shop}>
      {already ? (
        <Message icon={Smartphone} title="Cet appareil est déjà activé" text={`Les employés de ${shop.name} peuvent y taper leur code PIN.`}>
          <Button asChild size="lg" className="w-full">
            <Link href={`/b/${shop.slug}`}>Ouvrir la page de connexion</Link>
          </Button>
        </Message>
      ) : !invite || invite.businessId !== shop.id ? (
        <Message
          icon={CircleAlert}
          title="QR code expiré"
          text="Ce QR code ne marche que 15 minutes. Demandez au propriétaire d'en afficher un nouveau : Équipe › Activer un autre appareil."
        >
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href={`/b/${shop.slug}`}>Page de connexion de la boutique</Link>
          </Button>
        </Message>
      ) : (
        <ActivateInvitedDeviceForm token={decodeURIComponent(jeton)} shopName={shop.name} />
      )}
    </ShopShell>
  );
}

function Message({ icon: Icon, title, text, children }: { icon: typeof Smartphone; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  );
}
