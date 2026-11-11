// src/lib/domain/assistant/ecrans.ts
import { z } from "zod";
import type { CatalogParty, CatalogProduct } from "./drafts";
import { findByName } from "./match";
import { ECRANS, PERIODS, type Period } from "./tools";

export type NomEcran = (typeof ECRANS)[number];

/** Une page à ouvrir devant le commerçant, et l'élément à montrer du doigt (vide : la page seule). */
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

export interface EcranCatalogue {
  products: readonly CatalogProduct[];
  customers: readonly CatalogParty[];
  /** Dernière vente du commerce, chargée seulement quand on la demande. */
  derniereVente?: { id: string; number: string } | null;
}

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

/** Pages simples : on les ouvre, sans doigt (les droits sont revérifiés par la page elle-même). */
const PAGES: Partial<Record<NomEcran, { url: string; titre: string; acces?: keyof EcranAccess }>> = {
  vendre: { url: "/vendre", titre: "Caisse" },
  nouvelle_commande: { url: "/commandes/nouvelle", titre: "Nouvelle commande", acces: "orders" },
  clients: { url: "/clients", titre: "Clients", acces: "customers" },
  nouveau_produit: { url: "/produits/nouveau", titre: "Nouveau produit", acces: "products" },
  fournisseurs: { url: "/fournisseurs", titre: "Fournisseurs" },
  stock: { url: "/stock", titre: "Stock", acces: "products" },
  entree_stock: { url: "/stock/entree", titre: "Entrée de stock" },
  sortie_stock: { url: "/stock/sortie", titre: "Sortie de stock" },
  inventaire: { url: "/stock/inventaire", titre: "Inventaire" },
  transfert: { url: "/stock/transfert", titre: "Transfert de stock" },
  historique_stock: { url: "/stock/historique", titre: "Historique du stock" },
  factures: { url: "/factures", titre: "Factures et devis" },
  equipe: { url: "/equipe", titre: "Équipe" },
  parametres: { url: "/parametres", titre: "Paramètres" },
  licence: { url: "/licence", titre: "Licence" },
};

const INTERDIT: Record<keyof EcranAccess, string> = {
  reports: "Tu n'as pas accès aux rapports.",
  products: "Tu n'as pas accès aux produits.",
  orders: "Tu n'as pas accès aux commandes.",
  customers: "Tu n'as pas accès aux clients.",
};

const refus = (reason: string, candidates?: string[]): EcranResult => ({ ok: false, reason, ...(candidates ? { candidates } : {}) });

function fiche<T extends { id: string; name: string }>(nom: string | undefined, items: readonly T[], quoi: "client" | "produit"): T | EcranResult {
  if (!nom) return refus(`Dis le nom du ${quoi}.`);
  const match = findByName(nom, items);
  if (match.kind === "one") return match.item;
  if (match.kind === "many") return refus(`Plusieurs ${quoi}s correspondent à « ${nom} ».`, match.items.map((i) => i.name));
  return refus(`${quoi === "client" ? "Client" : "Produit"} introuvable : « ${nom} ».`);
}

export function buildEcran(raw: unknown, catalog: EcranCatalogue, access: EcranAccess): EcranResult {
  const parsed = args.safeParse(raw);
  if (!parsed.success) return refus("Écran inconnu.");
  const { ecran, periode, nom } = parsed.data;
  const page = PAGES[ecran];
  if (page) {
    if (page.acces && !access[page.acces]) return refus(INTERDIT[page.acces]);
    return { ok: true, ecran: { ecran, url: page.url, cible: "", titre: page.titre } };
  }
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
    case "derniere_vente": {
      const vente = catalog.derniereVente;
      if (!vente) return refus("Aucune vente enregistrée pour l'instant.");
      return { ok: true, ecran: { ecran, url: `/ventes/${vente.id}`, cible: "", titre: `Vente ${vente.number}` } };
    }
    case "produits":
      if (!access.products) return refus(INTERDIT.products);
      return { ok: true, ecran: { ecran, url: "/produits", cible: "produits.liste", titre: "Produits" } };
    case "stock_bas":
    case "ruptures":
      if (!access.products) return refus(INTERDIT.products);
      return {
        ok: true,
        ecran: { ecran, url: `/produits?etat=${ecran === "stock_bas" ? "bas" : "rupture"}`, cible: "produits.liste", titre: ecran === "stock_bas" ? "Stock bas" : "Ruptures" },
      };
    case "commandes":
      if (!access.orders) return refus(INTERDIT.orders);
      return { ok: true, ecran: { ecran, url: "/commandes", cible: "commandes.liste", titre: "Commandes" } };
    case "client": {
      if (!access.customers) return refus(INTERDIT.customers);
      const found = fiche(nom, catalog.customers, "client");
      if ("ok" in found) return found;
      return { ok: true, ecran: { ecran, url: `/clients/${found.id}`, cible: "client.solde", titre: found.name } };
    }
    case "produit": {
      if (!access.products) return refus(INTERDIT.products);
      const found = fiche(nom, catalog.products, "produit");
      if ("ok" in found) return found;
      return { ok: true, ecran: { ecran, url: `/produits/${found.id}`, cible: "produit.stock", titre: found.name } };
    }
    default:
      return refus("Écran inconnu.");
  }
}
