"use client";

import { Check, Download, KeyRound, LogOut, Monitor, Moon, ShieldCheck, Store, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInstall } from "@/components/pwa/install-app";
import { initials } from "@/lib/format";
import { signOutSafely } from "@/lib/offline/sign-out";
import { switchBusiness } from "@/server/actions/business";

export function UserMenu({
  user,
  roleLabel,
  memberships,
  currentBusinessId,
  isSuperAdmin,
  appName = null,
}: {
  user: { name: string; email: string };
  roleLabel: string;
  memberships: { businessId: string; businessName: string }[];
  currentBusinessId: string;
  isSuperAdmin: boolean;
  /** Application de la boutique à installer sur cet appareil (son nom). */
  appName?: string | null;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const installer = useInstall(appName ?? "l'application");

  return (
    <DropdownMenu>
      {installer.dialog}
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Mon compte"
      >
        <Avatar className="size-10 ring-2 ring-primary/15">
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
            {initials(user.name) || "?"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          <p className="pt-1 text-xs font-medium text-primary">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.length > 1 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Mes commerces</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.businessId}
                onSelect={async () => {
                  if (m.businessId === currentBusinessId) return;
                  const res = await switchBusiness(m.businessId);
                  if (!res.ok) toast.error(res.error);
                  router.push("/tableau-de-bord");
                  router.refresh();
                }}
              >
                <Store />
                <span className="truncate">{m.businessName}</span>
                {m.businessId === currentBusinessId && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Apparence</DropdownMenuLabel>
        {(
          [
            ["light", "Clair", Sun],
            ["dark", "Sombre", Moon],
            ["system", "Automatique", Monitor],
          ] as const
        ).map(([value, label, Icon]) => (
          <DropdownMenuItem key={value} onSelect={(e) => { e.preventDefault(); setTheme(value); }}>
            <Icon />
            {label}
            {theme === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        {isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck />
                Administration
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {appName && installer.mode !== "hidden" && (
          <DropdownMenuItem onSelect={() => void installer.install()}>
            <Download />
            Installer l&apos;application
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/mon-compte">
            <KeyRound />
            Mon mot de passe
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            if (!(await signOutSafely())) return;
            router.replace("/connexion");
            router.refresh();
          }}
        >
          <LogOut />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
