"use client";

import { Check, Copy, KeyRound, MessageCircle, UserX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVITABLE_ROLES, ROLE_LABELS, type Role } from "@/lib/domain/permissions";
import { invitationMessage, waLink } from "@/lib/whatsapp";
import { cancelInvitation, changeMemberRole, invitationLink, removeMember, resetMemberPassword } from "@/server/actions/team";

function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Lien copié");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Copie impossible : sélectionnez le lien à la main.");
      }
    },
  };
}

export function MemberRoleSelect({ memberId, role, disabled }: { memberId: string; role: Role; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (role === "owner") return <span className="text-sm font-semibold text-primary">{ROLE_LABELS.owner}</span>;
  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(v) =>
        startTransition(async () => {
          const res = await changeMemberRole(memberId, v);
          if (!res.ok) toast.error(res.error);
          else toast.success("Rôle mis à jour");
          router.refresh();
        })
      }
    >
      <SelectTrigger size="sm" className="w-40" aria-label="Rôle">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {INVITABLE_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Employé qui a oublié son mot de passe : le propriétaire lui en crée un provisoire, affiché une seule fois. */
export function ResetMemberPasswordButton({ memberId, name }: { memberId: string; name: string }) {
  const [access, setAccess] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copie impossible : le mot de passe reste lisible à l'écran
    }
  }

  return (
    <>
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Nouveau mot de passe pour ${name}`}>
            <KeyRound />
          </Button>
        }
        title={`Nouveau mot de passe pour ${name} ?`}
        description="Son ancien mot de passe ne marchera plus, et ses appareils seront déconnectés dans les minutes qui suivent. Le nouveau s'affiche une seule fois : donnez-le-lui."
        confirmLabel="Créer le mot de passe"
        successMessage="Nouveau mot de passe créé"
        action={async () => {
          const res = await resetMemberPassword(memberId);
          if (res.ok) setAccess({ email: res.data.email, password: res.data.password });
          return res;
        }}
      />
      <Dialog open={access !== null} onOpenChange={(open) => !open && setAccess(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mot de passe de {name}</DialogTitle>
            <DialogDescription>Donnez-lui ces informations. Il ne s&apos;affichera plus ensuite.</DialogDescription>
          </DialogHeader>
          {access && (
            <div className="space-y-2">
              <div className="rounded-xl border bg-muted/40 px-3 py-2">
                <span className="block text-xs text-muted-foreground">E-mail</span>
                <span className="block truncate font-mono text-sm font-semibold">{access.email}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">Mot de passe provisoire</span>
                  <span className="block font-mono text-sm font-semibold">{access.password}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void copy(access.password)} aria-label="Copier le mot de passe">
                  {copied ? <Check className="text-primary" /> : <Copy />}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setAccess(null)}>C&apos;est noté</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Retirer ${name}`}>
          <UserX />
        </Button>
      }
      title={`Retirer ${name} de l'équipe ?`}
      description="Cette personne n'aura plus accès à votre commerce. Son historique (ventes, mouvements) est conservé."
      confirmLabel="Retirer"
      destructive
      successMessage="Membre retiré"
      action={() => removeMember(memberId)}
    />
  );
}

export function InvitationActions({
  id,
  token,
  name,
  roleLabel,
  businessName,
}: {
  id: string;
  token: string;
  name: string;
  roleLabel: string;
  businessName: string;
}) {
  const router = useRouter();
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();

  async function withLink(fn: (link: string) => void) {
    const res = await invitationLink(token);
    if (!res.ok) return toast.error(res.error);
    fn(res.data);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Envoyer l'invitation de ${name} par WhatsApp`}
        onClick={() =>
          withLink((link) => window.open(waLink(null, invitationMessage(businessName, roleLabel, link)), "_blank", "noopener"))
        }
      >
        <MessageCircle />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Copier le lien de ${name}`} onClick={() => withLink(copy)}>
        <Copy />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`Annuler l'invitation de ${name}`}
        onClick={() =>
          startTransition(async () => {
            const res = await cancelInvitation(id);
            if (!res.ok) toast.error(res.error);
            else toast.success("Invitation annulée");
            router.refresh();
          })
        }
      >
        <X />
      </Button>
    </div>
  );
}
