import "server-only";
import { NextResponse } from "next/server";
import { buildDraft, type DraftCatalog } from "@/lib/domain/assistant/drafts";
import { buildEcran, type EcranAccess } from "@/lib/domain/assistant/ecrans";
import { allowedTools, type ToolName } from "@/lib/domain/assistant/tools";
import { getContext, type BusinessContext } from "../context";
import type { ProductRow } from "../queries/products";
import { listSales } from "../queries/sales";
import type { OutilDeps } from "./outils";
import { createReaders, loadDraftCatalog } from "./readers";

export const NO_STORE = { "Cache-Control": "no-store" };

export function refuser(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Contrôles communs aux adresses de l'assistant : session, commerce, suspension, assistant activé. */
export async function contexteAssistant(): Promise<{ ok: true; ctx: BusinessContext } | { ok: false; reponse: NextResponse }> {
  const app = await getContext();
  if (!app) return { ok: false, reponse: refuser("Votre session a expiré. Reconnectez-vous.", 401) };
  if (!app.business) return { ok: false, reponse: refuser("Aucun commerce sélectionné.", 409) };
  const ctx = app as BusinessContext;
  if (ctx.plan.status === "suspended") return { ok: false, reponse: refuser("Ce commerce est suspendu. Contactez Sama Stock.", 403) };
  if (!ctx.business.assistantEnabled) return { ok: false, reponse: refuser("L'assistant vocal n'est pas activé pour ce commerce.", 403) };
  return { ok: true, ctx };
}

/** Outils du dialogue en direct pour ce rôle, ces modules et cette offre. */
export function outilsDirects(ctx: BusinessContext): ToolName[] {
  return allowedTools(
    { can: ctx.can, modulePos: ctx.business.modulePos, moduleOrders: ctx.business.moduleOrders, readOnly: ctx.plan.readOnly },
    { direct: true },
  );
}

export function accesEcrans(ctx: BusinessContext): EcranAccess {
  return {
    reports: ctx.can("reports.view") && ctx.plan.limits.advancedReports,
    products: ctx.can("products.view"),
    orders: ctx.can("orders.manage") && ctx.business.moduleOrders,
    customers: ctx.can("customers.manage"),
  };
}

/** Lectures, brouillons et écrans branchés sur la base ; le catalogue n'est chargé qu'au premier besoin. */
export function dependancesOutils(ctx: BusinessContext, products: ProductRow[]): OutilDeps {
  const costs = ctx.can("costs.view");
  const access = accesEcrans(ctx);
  let catalog: Promise<DraftCatalog> | null = null;
  const charger = () => (catalog ??= loadDraftCatalog(ctx, products));
  return {
    read: createReaders(ctx, products),
    draft: async (name, args) => buildDraft(name, args, await charger(), { costs }),
    ecran: async (args) => {
      const catalogue = await charger();
      // La dernière vente n'est cherchée que lorsqu'on la demande
      const derniereVente =
        args.ecran === "derniere_vente"
          ? ((await listSales(ctx, { from: null, to: null }, { limit: 1, offset: 0 })).map((v) => ({ id: v.id, number: String(v.number) }))[0] ?? null)
          : undefined;
      return buildEcran(args, { ...catalogue, derniereVente }, access);
    },
  };
}
