import { eq } from "drizzle-orm";
import { MailWarning, Store } from "lucide-react";
import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AcceptInvitationButton } from "@/components/team/accept-invitation-button";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { businesses, invitations, user } from "@/db/schema";
import { isRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/permissions";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Invitation", robots: NO_INDEX };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ invitation: invitations, businessName: businesses.name, inviterName: user.name })
    .from(invitations)
    .innerJoin(businesses, eq(invitations.businessId, businesses.id))
    .leftJoin(user, eq(invitations.invitedById, user.id))
    .where(eq(invitations.token, token));
  const ctx = await getContext();

  const invitation = row?.invitation;
  const valid = invitation && invitation.status === "pending" && invitation.expiresAt > new Date();
  const roleLabel = invitation && isRole(invitation.role) ? ROLE_LABELS[invitation.role] : "";
  const roleDescription = invitation && isRole(invitation.role) ? ROLE_DESCRIPTIONS[invitation.role] : "";
  const back = `/invitation/${token}`;

  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="mx-auto block w-fit">
          <Logo />
        </Link>
        <div className="space-y-5 rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          {!valid || !row ? (
            <>
              <MailWarning className="mx-auto size-12 text-warning" />
              <h1 className="text-xl font-semibold">Invitation invalide ou expirée</h1>
              <p className="text-sm text-muted-foreground">
                Ce lien n&apos;est plus valable. Demandez au propriétaire du commerce de vous renvoyer une invitation.
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-xl bg-accent text-primary">
                <Store className="size-7" />
              </span>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{row.inviterName ?? "Le propriétaire"} vous invite à rejoindre</p>
                <h1 className="text-2xl font-semibold">{row.businessName}</h1>
              </div>
              <div className="rounded-xl bg-muted/60 p-4 text-left">
                <p className="text-sm font-semibold">Rôle : {roleLabel}</p>
                <p className="text-xs text-muted-foreground">{roleDescription}</p>
              </div>

              {!ctx ? (
                <div className="space-y-3">
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/inscription?redirect=${encodeURIComponent(back)}&email=${encodeURIComponent(invitation.email)}`}>
                      Créer mon compte
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/connexion?redirect=${encodeURIComponent(back)}`}>J&apos;ai déjà un compte</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">Utilisez l&apos;adresse {invitation.email}.</p>
                </div>
              ) : ctx.user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
                <div className="space-y-3">
                  <p className="rounded-xl bg-warning/10 p-3 text-sm">
                    Cette invitation est destinée à <strong>{invitation.email}</strong>, mais vous êtes connecté avec{" "}
                    <strong>{ctx.user.email}</strong>.
                  </p>
                  <SignOutButton variant="outline" className="w-full" />
                </div>
              ) : ctx.memberships.some((m) => m.businessId === invitation.businessId) ? (
                <Button asChild size="lg" className="w-full">
                  <Link href="/tableau-de-bord">Vous faites déjà partie de l&apos;équipe — continuer</Link>
                </Button>
              ) : (
                <AcceptInvitationButton token={token} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
