"use client";

import { createContext, useContext } from "react";
import type { Permission, Role } from "@/lib/domain/permissions";
import type { PlanId, PlanStatus } from "@/lib/domain/plans";

/** Informations sérialisables du contexte, disponibles dans les composants client. */
export interface ClientAppInfo {
  businessName: string;
  role: Role;
  permissions: Permission[];
  readOnly: boolean;
  plan: { id: PlanId; label: string; status: PlanStatus; daysLeft: number; advancedReports: boolean };
  modules: { pos: boolean; orders: boolean };
  location: { id: string; name: string };
  locationCount: number;
}

const AppContext = createContext<ClientAppInfo | null>(null);

export function AppProvider({ value, children }: { value: ClientAppInfo; children: React.ReactNode }) {
  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp doit être utilisé dans AppProvider");
  return {
    ...ctx,
    can: (permission: Permission) => ctx.permissions.includes(permission),
  };
}
