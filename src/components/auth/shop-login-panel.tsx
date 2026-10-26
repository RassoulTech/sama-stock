"use client";

import { ArrowLeft, KeySquare } from "lucide-react";
import { useState } from "react";
import { SignInForm } from "./sign-in-form";
import { StaffLogin, type StaffEntry } from "./staff-login";

/**
 * Page de connexion d'une boutique : code PIN des employés sur un appareil activé (staff ≠ null),
 * sinon e-mail et mot de passe (propriétaire, gérant).
 */
export function ShopLoginPanel({
  slug,
  shopName,
  staff,
  defaultEmail,
  notice,
}: {
  slug: string;
  shopName: string;
  staff: StaffEntry[] | null;
  defaultEmail: string;
  notice: string | null;
}) {
  const [useEmail, setUseEmail] = useState(staff === null || Boolean(defaultEmail) || Boolean(notice));

  if (staff && !useEmail) return <StaffLogin slug={slug} staff={staff} onUseEmail={() => setUseEmail(true)} />;

  return (
    <div className="space-y-5">
      {staff && (
        <button type="button" onClick={() => setUseEmail(false)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Employés : code PIN
        </button>
      )}
      <SignInForm redirectTo="/tableau-de-bord" googleEnabled={false} defaultEmail={defaultEmail} brand={{ name: shopName, slug }} notice={notice} />
      {!staff && (
        <p className="flex gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
          <KeySquare className="mt-0.5 size-4 shrink-0 text-primary" />
          Employé avec un code PIN ? Il se tape sur l&apos;appareil de la boutique, activé par le propriétaire dans Équipe.
        </p>
      )}
    </div>
  );
}
