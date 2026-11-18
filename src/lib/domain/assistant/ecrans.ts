// src/lib/domain/assistant/ecrans.ts
import { z } from "zod";
import { NO_CATEGORY, REPORT_PRESETS, type PeriodPreset } from "@/lib/filters";
import { SALE_METHODS } from "@/lib/domain/sales";
import type { CatalogParty, CatalogProduct } from "./drafts";
import { findByName } from "./match";
import { filtrePeriode, PERIODES } from "./periodes";
import { ECRANS } from "./tools";

export type NomEcran = (typeof ECRANS)[number];

/** Une page à ouvrir devant le commerçant, l'élément à montrer du doigt (vide : aucun) et la section où descendre. */
export interface EcranMission {
  ecran: NomEcran;
  url: string;
  cible: string;
  titre: string;
  /** Titre (ou début de titre) de la section où descendre une fois la page ouverte. */
  section?: string;
}
export interface EcranAccess {
  /** `reports.view` et rapports avancés dans l'offre. */
  reports: boolean;
  products: boolean;
  orders: boolean;
  customers: boolean;
}
export type EcranResult =
  | { ok: true; ecran: EcranMission; remarques?: string[] }
  | { ok: false; reason: string; candidates?: string[] };

export interface EcranCatalogue {
  products: readonly CatalogProduct[];
  customers: readonly CatalogParty[];
  suppliers?: readonly CatalogParty[];
  categories?: readonly { id: string; name: string }[];
  /** Dernière vente du commerce, chargée seulement quand on la demande. */
  derniereVente?: { id: string; number: string } | null;
}

/** Filtres « etat » de chaque liste, et le nom du paramètre d'adresse qui les porte (lus par les pages). */
const ETATS = {
  ventes: { param: "etat", valeurs: ["payees", "credit", "annulees", "averifier"] },
  produits: { param: "etat", valeurs: ["bas", "rupture"] },
  historique_stock: { param: "type", valeurs: ["in", "out", "loss", "transfer", "fix"] },
  commandes: { param: "filtre", valeurs: ["open", "new", "preparing", "shipping", "delivered", "closed", "all"] },
} as const;
const PERIODES_PAGE: Partial<Record<NomEcran, readonly PeriodPreset[]>> = {
  rapports: REPORT_PRESETS,
  ventes: ["today", "yesterday", "7j", "30j", "mois", "mois-dernier", "90j"],
  ventes_credit: ["today", "yesterday", "7j", "30j", "mois", "mois-dernier", "90j"],
  historique_stock: ["today", "7j", "30j", "mois", "mois-dernier", "90j", "tout"],
  commandes: ["tout", "today", "7j", "30j", "mois", "mois-dernier"],
};

const absent = (value: unknown) => (value === null || value === "" ? undefined : value);
const texte = z.preprocess(absent, z.string().trim().min(1).max(80).optional());
const args = z.object({
  ecran: z.enum(ECRANS),
  periode: z.preprocess(absent, z.enum(PERIODES).optional()),
  du: texte,
  au: texte,
  nom: texte,
  categorie: texte,
  etat: texte,
  paiement: texte,
  recherche: texte,
  section: texte,
});

const TABLEAU: EcranMission = { ecran: "tableau_de_bord", url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" };

/** Pages simples : on les ouvre, sans doigt (les droits sont revérifiés par la page elle-même). */
const PAGES: Partial<Record<NomEcran, { url: string; titre: string; acces?: keyof EcranAccess }>> = {
  vendre: { url: "/vendre", titre: "Caisse" },
  nouvelle_commande: { url: "/commandes/nouvelle", titre: "Nouvelle commande", acces: "orders" },
  clients: { url: "/clients", titre: "Clients", acces: "customers" },
  nouveau_produit: { url: "/produits/nouveau", titre: "Nouveau produit", acces: "products" },
  categories: { url: "/categories", titre: "Catégories", acces: "products" },
  fournisseurs: { url: "/fournisseurs", titre: "Fournisseurs" },
  stock: { url: "/stock", titre: "Stock", acces: "products" },
  entree_stock: { url: "/stock/entree", titre: "Entrée de stock" },
  sortie_stock: { url: "/stock/sortie", titre: "Sortie de stock" },
  inventaire: { url: "/stock/inventaire", titre: "Inventaire" },
  inventaires_passes: { url: "/stock/inventaire?onglet=historique", titre: "Inventaires passés" },
  transfert: { url: "/stock/transfert", titre: "Transfert de stock" },
  factures: { url: "/factures", titre: "Factures et devis" },
  devis: { url: "/factures?onglet=devis", titre: "Devis" },
  equipe: { url: "/equipe", titre: "Équipe" },
  parametres: { url: "/parametres", titre: "Paramètres" },
  mon_compte: { url: "/mon-compte", titre: "Mon compte" },
  licence: { url: "/licence", titre: "Licence" },
};

const INTERDIT: Record<keyof EcranAccess, string> = {
  reports: "Tu n'as pas accès aux rapports.",
  products: "Tu n'as pas accès aux produits.",
  orders: "Tu n'as pas accès aux commandes.",
  customers: "Tu n'as pas accès aux clients.",
};

const refus = (reason: string, candidates?: string[]): EcranResult => ({ ok: false, reason, ...(candidates ? { candidates } : {}) });

function fiche<T extends { id: string; name: string }>(nom: string | undefined, items: readonly T[], quoi: "client" | "produit" | "fournisseur"): T | EcranResult {
  if (!nom) return refus(`Dis le nom du ${quoi}.`);
  const match = findByName(nom, items);
  if (match.kind === "one") return match.item;
  if (match.kind === "many") return refus(`Plusieurs ${quoi}s correspondent à « ${nom} ».`, match.items.map((i) => i.name));
  return refus(`${quoi[0].toUpperCase()}${quoi.slice(1)} introuvable : « ${nom} ».`);
}

function adresse(chemin: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) if (valeur) qs.set(cle, valeur);
  const suite = qs.toString();
  return suite ? `${chemin}?${suite}` : chemin;
}

type Args = z.infer<typeof args>;

/** Filtres d'une liste : période, catégorie, état, paiement, recherche (ce que la page ne connaît pas est signalé). */
type Filtres = { ok: true; params: Record<string, string | undefined> } | { ok: false; refus: EcranResult };

function filtres(ecran: NomEcran, a: Args, catalog: EcranCatalogue, remarques: string[]): Filtres {
  const out: Record<string, string | undefined> = {};
  const non = (reason: string, candidates?: string[]): Filtres => ({ ok: false, refus: refus(reason, candidates) });
  const permises = PERIODES_PAGE[ecran];
  if (a.periode) {
    const p = permises ? filtrePeriode(a.periode, { du: a.du, au: a.au }, permises) : null;
    if (p) Object.assign(out, p);
    else remarques.push(a.periode === "dates" ? "Date non comprise (format AAAA-MM-JJ)." : `Cette page ne filtre pas par « ${a.periode} ».`);
  }
  if (a.categorie) {
    if (!["ventes", "ventes_credit", "produits", "stock_bas", "ruptures", "historique_stock"].includes(ecran)) {
      remarques.push("Cette page ne filtre pas par catégorie.");
    } else if (/^(sans|aucune)/i.test(a.categorie)) {
      out.categorie = NO_CATEGORY;
    } else {
      const match = findByName(a.categorie, catalog.categories ?? []);
      if (match.kind === "many") return non(`Plusieurs catégories correspondent à « ${a.categorie} ».`, match.items.map((c) => c.name));
      if (match.kind === "none") return non(`Catégorie introuvable : « ${a.categorie} ».`, (catalog.categories ?? []).map((c) => c.name));
      out.categorie = match.item.id;
    }
  }
  const liste = ecran === "ventes_credit" ? "ventes" : ecran === "stock_bas" || ecran === "ruptures" ? "produits" : ecran;
  if (a.etat) {
    const etats = ETATS[liste as keyof typeof ETATS];
    if (etats && (etats.valeurs as readonly string[]).includes(a.etat)) out[etats.param] = a.etat;
    else remarques.push(`État « ${a.etat} » inconnu ici${etats ? ` (possibles : ${etats.valeurs.join(", ")})` : ""}.`);
  }
  if (a.paiement) {
    if (liste === "ventes" && (SALE_METHODS as readonly string[]).includes(a.paiement)) out.paiement = a.paiement;
    else remarques.push("Le filtre de paiement ne vaut que pour les ventes (cash, wave, orange_money, credit).");
  }
  if (a.recherche) {
    if (["ventes", "produits", "historique_stock", "commandes"].includes(liste)) out.q = a.recherche;
    else remarques.push("Cette page n'a pas de recherche.");
  }
  return { ok: true, params: out };
}

export function buildEcran(raw: unknown, catalog: EcranCatalogue, access: EcranAccess): EcranResult {
  const parsed = args.safeParse(raw);
  if (!parsed.success) return refus("Écran inconnu.");
  const a = parsed.data;
  const { ecran, nom, section } = a;
  const remarques: string[] = [];
  const ok = (mission: Omit<EcranMission, "section">): EcranResult => ({
    ok: true,
    ecran: { ...mission, ...(section ? { section } : {}) },
    ...(remarques.length ? { remarques } : {}),
  });
  const liste = (chemin: string, base: Record<string, string | undefined> = {}): string | EcranResult => {
    const f = filtres(ecran, a, catalog, remarques);
    return f.ok ? adresse(chemin, { ...base, ...f.params }) : f.refus;
  };

  const page = PAGES[ecran];
  if (page) {
    if (page.acces && !access[page.acces]) return refus(INTERDIT[page.acces]);
    return ok({ ecran, url: page.url, cible: "", titre: page.titre });
  }
  switch (ecran) {
    case "tableau_de_bord":
      return ok(TABLEAU);
    case "rapports": {
      if (!access.reports) return ok(TABLEAU);
      const url = liste("/rapports");
      return typeof url === "string" ? ok({ ecran, url, cible: "rapports.chiffre", titre: "Rapports" }) : url;
    }
    case "ventes": {
      const url = liste("/ventes");
      return typeof url === "string" ? ok({ ecran, url, cible: "ventes.total", titre: "Ventes" }) : url;
    }
    case "ventes_credit": {
      const url = liste("/ventes", { periode: a.periode ? undefined : "mois", etat: "credit" });
      return typeof url === "string" ? ok({ ecran, url, cible: "ventes.total", titre: "Ventes à crédit" }) : url;
    }
    case "derniere_vente": {
      const vente = catalog.derniereVente;
      if (!vente) return refus("Aucune vente enregistrée pour l'instant.");
      return ok({ ecran, url: `/ventes/${vente.id}`, cible: "", titre: `Vente ${vente.number}` });
    }
    case "produits":
    case "stock_bas":
    case "ruptures": {
      if (!access.products) return refus(INTERDIT.products);
      const etat = ecran === "stock_bas" ? "bas" : ecran === "ruptures" ? "rupture" : undefined;
      const url = liste("/produits", { etat });
      const titre = ecran === "stock_bas" ? "Stock bas" : ecran === "ruptures" ? "Ruptures" : "Produits";
      return typeof url === "string" ? ok({ ecran, url, cible: "produits.liste", titre }) : url;
    }
    case "historique_stock": {
      const url = liste("/stock/historique");
      return typeof url === "string" ? ok({ ecran, url, cible: "", titre: "Historique du stock" }) : url;
    }
    case "commandes": {
      if (!access.orders) return refus(INTERDIT.orders);
      const url = liste("/commandes");
      return typeof url === "string" ? ok({ ecran, url, cible: "commandes.liste", titre: "Commandes" }) : url;
    }
    case "client": {
      if (!access.customers) return refus(INTERDIT.customers);
      const found = fiche(nom, catalog.customers, "client");
      if ("ok" in found) return found;
      return ok({ ecran, url: `/clients/${found.id}`, cible: "client.solde", titre: found.name });
    }
    case "produit": {
      if (!access.products) return refus(INTERDIT.products);
      const found = fiche(nom, catalog.products, "produit");
      if ("ok" in found) return found;
      return ok({ ecran, url: `/produits/${found.id}`, cible: "produit.stock", titre: found.name });
    }
    case "fournisseur": {
      const found = fiche(nom, catalog.suppliers ?? [], "fournisseur");
      if ("ok" in found) return found;
      return ok({ ecran, url: `/fournisseurs/${found.id}`, cible: "", titre: found.name });
    }
    default:
      return refus("Écran inconnu.");
  }
}
