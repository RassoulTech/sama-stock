// src/lib/domain/assistant/ecrans.ts
import { z } from "zod";
import type { CatalogParty, CatalogProduct } from "./drafts";
import { findByName } from "./match";
import { ECRANS, PERIODS, type Period } from "./tools";

export type NomEcran = (typeof ECRANS)[number];

/** Une page à ouvrir devant le commerçant, et l'élément à montrer du doigt. */
export interface EcranMission {
  ecran: NomEcran;
  url: string;
  cible: string;
  titre: string;
}
export interface EcranAccess {
  /** `reports.view` et rapports avancés dans l'offre. */
  reports: boolean;
  products: boolean;
  orders: boolean;
  customers: boolean;
}
export type EcranResult = { ok: true; ecran: EcranMission } | { ok: false; reason: string; candidates?: string[] };

const absent = (value: unknown) => (value === null || value === "" ? undefined : value);
const args = z.object({
  ecran: z.enum(ECRANS),
  periode: z.preprocess(absent, z.enum(PERIODS).optional()),
  nom: z.preprocess(absent, z.string().trim().min(1).optional()),
});

/** Périodes de l'assistant → valeurs lues par /ventes et /rapports (lib/filters). */
const VENTES: Record<Period, string> = { aujourdhui: "today", hier: "yesterday", "7jours": "7j", mois: "mois" };
const RAPPORTS: Record<Period, string> = { aujourdhui: "7j", hier: "7j", "7jours": "7j", mois: "mois" };
const TABLEAU: EcranMission = { ecran: "tableau_de_bord", url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" };

const refus = (reason: string, candidates?: string[]): EcranResult => ({ ok: false, reason, ...(candidates ? { candidates } : {}) });

function fiche<T extends { id: string; name: string }>(nom: string | undefined, items: readonly T[], quoi: "client" | "produit"): T | EcranResult {
  if (!nom) return refus(`Dis le nom du ${quoi}.`);
  const match = findByName(nom, items);
  if (match.kind === "one") return match.item;
  if (match.kind === "many") return refus(`Plusieurs ${quoi}s correspondent à « ${nom} ».`, match.items.map((i) => i.name));
  return refus(`${quoi === "client" ? "Client" : "Produit"} introuvable : « ${nom} ».`);
}

export function buildEcran(
  raw: unknown,
  catalog: { products: readonly CatalogProduct[]; customers: readonly CatalogParty[] },
  access: EcranAccess,
): EcranResult {
  const parsed = args.safeParse(raw);
  if (!parsed.success) return refus("Écran inconnu.");
  const { ecran, periode, nom } = parsed.data;
  switch (ecran) {
    case "tableau_de_bord":
      return { ok: true, ecran: TABLEAU };
    case "rapports":
      if (!access.reports) return { ok: true, ecran: TABLEAU };
      return { ok: true, ecran: { ecran, url: `/rapports?periode=${RAPPORTS[periode ?? "mois"]}`, cible: "rapports.chiffre", titre: "Rapports" } };
    case "ventes":
      return { ok: true, ecran: { ecran, url: `/ventes?periode=${VENTES[periode ?? "aujourdhui"]}`, cible: "ventes.total", titre: "Ventes" } };
    case "ventes_credit":
      return { ok: true, ecran: { ecran, url: `/ventes?periode=${VENTES[periode ?? "mois"]}&etat=credit`, cible: "ventes.total", titre: "Ventes à crédit" } };
    case "stock_bas":
    case "ruptures":
      if (!access.products) return refus("Tu n'as pas accès aux produits.");
      return {
        ok: true,
        ecran: { ecran, url: `/produits?etat=${ecran === "stock_bas" ? "bas" : "rupture"}`, cible: "produits.liste", titre: ecran === "stock_bas" ? "Stock bas" : "Ruptures" },
      };
    case "commandes":
      if (!access.orders) return refus("Tu n'as pas accès aux commandes.");
      return { ok: true, ecran: { ecran, url: "/commandes", cible: "commandes.liste", titre: "Commandes" } };
    case "client": {
      if (!access.customers) return refus("Tu n'as pas accès aux clients.");
      const found = fiche(nom, catalog.customers, "client");
      if ("ok" in found) return found;
      return { ok: true, ecran: { ecran, url: `/clients/${found.id}`, cible: "client.solde", titre: found.name } };
    }
    case "produit": {
      if (!access.products) return refus("Tu n'as pas accès aux produits.");
      const found = fiche(nom, catalog.products, "produit");
      if ("ok" in found) return found;
      return { ok: true, ecran: { ecran, url: `/produits/${found.id}`, cible: "produit.stock", titre: found.name } };
    }
  }
}
