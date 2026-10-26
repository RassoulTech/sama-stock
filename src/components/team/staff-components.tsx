"use client";

import { Check, Copy, KeySquare, Loader2, Smartphone, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormError, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { INVITABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";
import { activateThisDevice, addEmployee, resetMemberPin, revokeShopDevice } from "@/server/actions/team";

type EmployeeRole = (typeof INVITABLE_ROLES)[number];

/** Le code affiché en grand, chiffre par chiffre : facile à lire à voix haute ou à recopier. */
export function PinDisplay({ pin }: { pin: string }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`Code PIN ${pin.split("").join(" ")}`}>
      {pin.split("").map((d, i) => (
        <span key={i} className="num grid h-14 w-12 place-items-center rounded-xl border-2 border-primary/30 bg-accent text-2xl font-bold text-accent-foreground">
          {d}
        </span>
      ))}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-mono text-sm font-semibold">{value}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Copier ${label}`}
        onClick={() =>
          void navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            },
            () => {},
          )
        }
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
      </Button>
    </div>
  );
}

/** Ajouter un employé : nom, rôle, et un code PIN créé tout de suite (pas d'e-mail ni d'invitation). */
export function AddEmployeeDialog({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<EmployeeRole>("seller");
  const [withEmail, setWithEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; roleLabel: string; pin: string; email: string | null; password: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addEmployee({
        name: String(form.get("name") ?? ""),
        role,
        email: withEmail ? String(form.get("email") ?? "") : "",
      });
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      router.refresh();
    });
  }

  if (disabledReason) {
    return (
      <Button onClick={() => toast.info(disabledReason)} variant="outline">
        <UserPlus /> Ajouter un employé
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setResult(null);
          setError(null);
          setWithEmail(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Ajouter un employé
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {result ? (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle>{result.name} fait partie de l&apos;équipe</DialogTitle>
              <DialogDescription>
                Voici son code PIN ({result.roleLabel}). Donnez-le-lui maintenant : il ne s&apos;affichera plus. Il le tapera sur l&apos;appareil
                de la boutique.
              </DialogDescription>
            </DialogHeader>
            <PinDisplay pin={result.pin} />
            {result.email && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pour se connecter depuis son propre téléphone :</p>
                <CopyField label="E-mail" value={result.email} />
                {result.password ? (
                  <CopyField label="Mot de passe provisoire" value={result.password} />
                ) : (
                  <p className="text-xs text-muted-foreground">Il avait déjà un compte Sama Stock : il garde son mot de passe.</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>C&apos;est noté</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Ajouter un employé</DialogTitle>
              <DialogDescription>Pas d&apos;e-mail ni de compte à créer : il reçoit un code PIN à 4 chiffres.</DialogDescription>
            </DialogHeader>
            <FormField label="Nom" htmlFor="emp-name">
              <Input id="emp-name" name="name" required minLength={2} maxLength={80} placeholder="Ex. Moussa Sarr" autoComplete="off" />
            </FormField>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Rôle</legend>
              {INVITABLE_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={cn(
                    "w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40",
                    role === r && "border-primary bg-accent ring-2 ring-primary/20",
                  )}
                >
                  <span className="block text-sm font-semibold">{ROLE_LABELS[r]}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
                </button>
              ))}
            </fieldset>
            {withEmail ? (
              <FormField label="E-mail (facultatif)" htmlFor="emp-email" hint="Il pourra aussi se connecter depuis son téléphone, avec un mot de passe provisoire.">
                <Input id="emp-email" name="email" type="email" inputMode="email" autoCapitalize="none" placeholder="moussa@exemple.sn" />
              </FormField>
            ) : (
              <button type="button" onClick={() => setWithEmail(true)} className="text-sm font-medium text-primary hover:underline">
                + Lui donner aussi un accès par e-mail (facultatif)
              </button>
            )}
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending && <Loader2 className="animate-spin" />}
                Ajouter et créer son code
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Nouveau code PIN (au hasard, ou choisi par le propriétaire). Débloque aussi un compte bloqué. */
export function PinButton({ memberId, name, hasPin, self = false }: { memberId: string; name: string; hasPin: boolean; self?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create(value?: string) {
    setError(null);
    startTransition(async () => {
      const res = await resetMemberPin(memberId, value);
      if (!res.ok) return setError(res.error);
      setPin(res.data.pin);
      router.refresh();
    });
  }

  const label = self ? (hasPin ? "Mon code PIN" : "Créer mon code PIN") : hasPin ? "Code PIN" : "Créer son code";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPin(null);
          setChosen("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeySquare /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{self ? "Mon code PIN" : `Code PIN de ${name}`}</DialogTitle>
          <DialogDescription>
            {pin
              ? "Notez-le maintenant : il ne s'affichera plus."
              : hasPin
                ? "L'ancien code ne marchera plus. Un compte bloqué est aussi débloqué."
                : "Le code sert à ouvrir la session sur l'appareil de la boutique."}
          </DialogDescription>
        </DialogHeader>
        {pin ? (
          <>
            <PinDisplay pin={pin} />
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>C&apos;est noté</Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <Button className="w-full" disabled={pending} onClick={() => create()}>
              {pending && <Loader2 className="animate-spin" />} Créer un code au hasard
            </Button>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                create(chosen);
              }}
            >
              <Input
                value={chosen}
                onChange={(e) => setChosen(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ou choisir : 4 chiffres"
                aria-label="Choisir le code"
                className="num tracking-[0.3em]"
              />
              <Button type="submit" variant="outline" disabled={pending || chosen.length !== 4}>
                Valider
              </Button>
            </form>
            <FormError message={error} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Active cet appareil pour la boutique (les employés y taperont leur code). */
export function ActivateDeviceButton({ shopPath }: { shopPath: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Tablette caisse");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // Rafraîchi seulement à la fermeture : la fenêtre reste ouverte pour donner l'adresse aux employés
          if (done) router.refresh();
          setDone(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Smartphone /> Activer cet appareil
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>Appareil activé</DialogTitle>
              <DialogDescription>
                Les employés ouvrent leur session ici avec leur code, sur la page de connexion de la boutique. Ajoutez-la à l&apos;écran
                d&apos;accueil pour l&apos;ouvrir en un geste.
              </DialogDescription>
            </DialogHeader>
            <CopyField label="Page de connexion des employés" value={`${window.location.origin}${done}`} />
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  setDone(null);
                  router.refresh();
                }}
              >
                Terminé
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const res = await activateThisDevice(name);
                if (!res.ok) return setError(res.error);
                setDone(res.data.slug ? `/b/${res.data.slug}` : (shopPath ?? "/connexion"));
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Activer cet appareil</DialogTitle>
              <DialogDescription>
                Faites-le sur le téléphone ou la tablette de la boutique. Seuls les appareils activés affichent le clavier du code PIN.
              </DialogDescription>
            </DialogHeader>
            <FormField label="Nom de l'appareil" htmlFor="device-name">
              <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            </FormField>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />} Activer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RevokeDeviceButton({ deviceId, name }: { deviceId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive">
          Retirer
        </Button>
      }
      title={`Retirer « ${name} » ?`}
      description="On ne pourra plus y taper de code PIN. Les employés connectés dessus le restent jusqu'à la fin de leur session."
      confirmLabel="Retirer l'appareil"
      destructive
      successMessage="Appareil retiré"
      action={() => revokeShopDevice(deviceId)}
    />
  );
}
