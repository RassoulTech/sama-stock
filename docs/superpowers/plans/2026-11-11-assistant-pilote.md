# Assistant pilote (phase 1) — plan de construction

> **Pour les agents :** sous-compétence obligatoire : superpowers:subagent-driven-development (conseillé) ou
> superpowers:executing-plans, tâche par tâche. Les étapes sont des cases à cocher (`- [ ]`).

**But :** l'assistant vocal fait les tâches sur les vrais écrans (doigt visible, formulaire rempli), demande
« Ndax ma bind ko ? » avant d'appuyer sur le bouton final, montre les écrans demandés et parle wolof avec la voix Anta.

**Architecture :** le serveur comprend la demande (Gemini, un appel le plus souvent) et renvoie une **mission**
vérifiée, sans rien écrire. Le téléphone transforme la mission en **étapes** (recettes pures), qu'un **joueur** pur
exécute sur une **scène** (navigation, doigt, bulle) ; chaque écran expose un **pilote** typé branché sur ses propres
`useState`. Le bouton final reste celui de l'écran, donc l'action serveur existante.

**Pile :** Next.js 16 (app router), React 19, TypeScript, zod, Radix (shadcn/ui), vitest (Node), Gemini REST,
voix Anta (Hugging Face, Flask).

**Spécification :** `docs/superpowers/specs/2026-11-11-assistant-pilote-design.md` (à lire avant chaque tâche).

## Contraintes globales

- Tout texte visible et tout message de commit en **français** ; noms du domaine assistant en français comme l'existant.
- Tests : vitest en environnement **Node** (`src/**/*.test.ts` seulement, pas de jsdom, pas de `.tsx` testé). Toute
  logique à tester vit dans un module sans React.
- Fins de ligne **LF**. Pas de migration de base.
- Le serveur n'écrit jamais : l'écriture passe par le bouton final de l'écran. **Rien n'est enregistré sans « oui ».**
- Attribut des cibles : `data-assistant="<écran>.<élément>"`. Attribut de la bulle : `data-assistant-bulle`.
- Délais du joueur : pilote 8000 ms, cible 3000 ms, pause entre deux gestes 450 ms.
- Bulle `z-[60]`, doigt `z-[70]` et `pointer-events: none`.
- `AGENTS.md` : ce Next.js a des changements ; lire `node_modules/next/dist/docs/` avant de toucher une API de
  routage ou de rendu.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Vérifications avant chaque commit : `npx vitest run <fichiers touchés>` puis `npm run typecheck` et `npm run lint`.

## Carte des fichiers

Domaine (pur, testé) — `src/lib/domain/assistant/` :
- `drafts.ts` (modifié) : six nouveaux brouillons, catalogue élargi, contrôle de la dette.
- `tools.ts` (modifié) : nouveaux outils, `montrer_ecran`, `confirmer`, droits et lecture seule.
- `ecrans.ts` (nouveau) : `montrer_ecran` → adresse de page et cible.
- `mission.ts` (nouveau) : type `Mission`, `missionForModel`.
- `reply.ts` (modifié) : la réponse porte `mission` et `confirmation`.
- `prompt.ts` (modifié) : consignes du mode pilote.
- `phrases.ts` (nouveau) : phrases prêtes, découpage en phrases.

Serveur :
- `src/server/assistant/run.ts`, `readers.ts`, `voix.ts` (nouveau) ; `src/app/api/assistant/route.ts`,
  `voix/route.ts`, `reveil/route.ts` (nouveau) ; `vercel.json` ; `scripts/phrases-voix.ts` (nouveau).

Téléphone — `src/components/assistant/` :
- `pilote/types.ts`, `pilote/recettes.ts`, `pilote/moteur.ts`, `pilote/registre.ts` (purs, testés) ;
  `pilote/use-pilote-ecran.ts`, `pilote/scene-dom.ts`, `pilote/doigt.tsx`, `pilote/bulle.tsx`, `pilote/cibles.ts`.
- `assistant-provider.tsx` (nouveau), `voix.ts` (nouveau), `api.ts`, `assistant-panel.tsx`, `assistant-button.tsx`
  (modifiés), `draft-card.tsx` (supprimé).
- `src/components/ui/garde-bulle.ts` (nouveau) ; `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/alert-dialog.tsx` (modifiés).

Écrans pilotés (modifiés) : `pos/pos-screen.tsx`, `pos/checkout-dialog.tsx`, `stock/purchase-form.tsx`,
`stock/exit-form.tsx`, `orders/order-form.tsx`, `orders/order-actions.tsx`, `products/product-form.tsx`,
`customers/customer-dialog.tsx`, `customers/payment-dialog.tsx`, `suppliers/supplier-dialog.tsx`, les pages
`clients`, `fournisseurs`, `tableau-de-bord`, `rapports`, `ventes`, `produits`, `commandes`, `clients/[id]`,
`produits/[id]` ; composants partagés `shared/product-picker.tsx`, `shared/qty-stepper.tsx`,
`shared/payment-method-picker.tsx`, `customers/customer-combobox.tsx`, `shared/stat-card.tsx`,
`dashboard/mobile-home.tsx`.

---

### Tâche 1 : brouillons des six nouvelles tâches

**Fichiers :**
- Modifier : `src/lib/domain/assistant/tools.ts`
- Modifier : `src/lib/domain/assistant/drafts.ts`
- Tests : `src/lib/domain/assistant/drafts.test.ts`, `src/lib/domain/assistant/tools.test.ts`

**Interfaces :**
- Produit (tools.ts) : `DRAFT_TOOLS` gagne `"brouillon_sortie_stock" | "brouillon_statut_commande" | "brouillon_produit" | "brouillon_prix" | "brouillon_client" | "brouillon_fournisseur"` ;
  `STOCK_REASON_KEYS`, `STATUS_TARGETS`, `UNIT_IDS` exportés ; `ToolAccess.readOnly?: boolean`.
- Produit (drafts.ts) : `Draft` gagne les variantes `stock_exit`, `order_status`, `product`, `price`, `customer`,
  `supplier` (types exacts ci-dessous) ; `DraftCatalog.categories?`, `DraftCatalog.openOrders?`,
  `CatalogCustomer.debt?` ; `StockReason`.

- [ ] **Étape 1 : écrire les tests qui échouent** — ajouter à la fin de `drafts.test.ts` (le catalogue existant ne
  change pas ; `wide` l'élargit avec les catégories, les commandes en cours et les dettes) :

```ts
const wide: DraftCatalog = {
  ...catalog,
  customers: [
    { id: "c1", name: "Awa Ndiaye", phone: "+221771234567", debt: 8000 },
    { id: "c2", name: "Moussa Diop", phone: null, debt: 0 },
  ],
  categories: [{ id: "k1", name: "Céréales" }],
  openOrders: [
    { id: "o1", number: "CMD-0012", customerName: "Awa Ndiaye", status: "shipping" },
    { id: "o2", number: "CMD-0013", customerName: "Moussa Diop", status: "new" },
  ],
};
const withCosts = { costs: true };

describe("buildDraft — sortie de stock", () => {
  it("turns a breakage into a loss", () => {
    const res = buildDraft("brouillon_sortie_stock", { produit: "huile", quantite: 1, motif: "breakage" }, wide, noCosts);
    expect(res).toEqual({
      ok: true,
      draft: {
        action: "stock_exit",
        product: { id: "p3", name: "Huile Dinor 1L", unit: "litre", available: 1 },
        quantity: 1,
        kind: "loss",
        reason: "breakage",
        reasonLabel: "Casse",
        note: "",
      },
    });
  });
  it("turns a gift into an exit", () => {
    const res = buildDraft("brouillon_sortie_stock", { produit: "riz brisé", quantite: 2, motif: "gift", note: "pour la tantie" }, wide, noCosts);
    if (!res.ok || res.draft.action !== "stock_exit") throw new Error("sortie attendue");
    expect(res.draft.kind).toBe("exit");
    expect(res.draft.note).toBe("pour la tantie");
  });
  it("refuses an unknown reason", () => {
    expect(buildDraft("brouillon_sortie_stock", { produit: "huile", quantite: 1, motif: "fete" }, wide, noCosts).ok).toBe(false);
  });
});

describe("buildDraft — état d'une commande", () => {
  it("finds the order by customer and checks the transition", () => {
    const res = buildDraft("brouillon_statut_commande", { commande: "awa", etat: "delivered" }, wide, noCosts);
    expect(res).toEqual({
      ok: true,
      draft: { action: "order_status", order: { id: "o1", number: "CMD-0012", customerName: "Awa Ndiaye" }, from: "shipping", to: "delivered", label: "Marquer livrée" },
    });
  });
  it("finds the order by its number", () => {
    const res = buildDraft("brouillon_statut_commande", { commande: "13", etat: "preparing" }, wide, noCosts);
    if (!res.ok || res.draft.action !== "order_status") throw new Error("état attendu");
    expect(res.draft.order.id).toBe("o2");
  });
  it("refuses a forbidden transition", () => {
    const res = buildDraft("brouillon_statut_commande", { commande: "moussa", etat: "delivered" }, wide, noCosts);
    expect(res).toEqual({ ok: false, reason: "La commande CMD-0013 est « Nouvelle » : elle ne peut pas passer à « Livrée »." });
  });
  it("refuses an unknown order", () => {
    expect(buildDraft("brouillon_statut_commande", { commande: "fatou", etat: "delivered" }, wide, noCosts)).toEqual({
      ok: false,
      reason: "Commande en cours introuvable : « fatou ».",
    });
  });
});

describe("buildDraft — nouveau produit et prix", () => {
  it("prepares a new product in an existing category", () => {
    const res = buildDraft("brouillon_produit", { nom: "Mil 1kg", prix_vente: 700, prix_achat: 500, unite: "kg", categorie: "cereales", stock_initial: 20 }, wide, withCosts);
    expect(res).toEqual({
      ok: true,
      draft: { action: "product", name: "Mil 1kg", unit: "kg", salePrice: 700, costPrice: 500, category: { id: "k1", name: "Céréales" }, initialStock: 20, reference: "" },
    });
  });
  it("creates a new category name and hides the cost without the right", () => {
    const res = buildDraft("brouillon_produit", { nom: "Savon Madar", prix_vente: 250, prix_achat: 180, categorie: "Hygiène" }, wide, noCosts);
    if (!res.ok || res.draft.action !== "product") throw new Error("produit attendu");
    expect(res.draft.category).toEqual({ id: null, name: "Hygiène" });
    expect(res.draft.costPrice).toBeNull();
    expect(res.draft.unit).toBe("piece");
  });
  it("refuses a product that already exists", () => {
    expect(buildDraft("brouillon_produit", { nom: "riz brise", prix_vente: 400 }, wide, noCosts)).toEqual({ ok: false, reason: "Le produit « Riz brisé » existe déjà." });
  });
  it("prepares a new sale price", () => {
    const res = buildDraft("brouillon_prix", { produit: "huile", prix_vente: 1400 }, wide, noCosts);
    expect(res).toEqual({ ok: true, draft: { action: "price", product: { id: "p3", name: "Huile Dinor 1L" }, oldSalePrice: 1300, salePrice: 1400, costPrice: null } });
  });
  it("refuses a price change without any price", () => {
    expect(buildDraft("brouillon_prix", { produit: "huile" }, wide, noCosts).ok).toBe(false);
  });
});

describe("buildDraft — fiches client et fournisseur", () => {
  it("prepares a new customer", () => {
    expect(buildDraft("brouillon_client", { nom: "Fatou Sall", telephone: "77 123 45 67" }, wide, noCosts)).toEqual({
      ok: true,
      draft: { action: "customer", name: "Fatou Sall", phone: "77 123 45 67", address: "" },
    });
  });
  it("refuses a customer that already exists", () => {
    expect(buildDraft("brouillon_client", { nom: "awa ndiaye" }, wide, noCosts)).toEqual({ ok: false, reason: "Le client « Awa Ndiaye » existe déjà." });
  });
  it("prepares a new supplier", () => {
    expect(buildDraft("brouillon_fournisseur", { nom: "Senico", note: "livre le lundi" }, wide, noCosts)).toEqual({
      ok: true,
      draft: { action: "supplier", name: "Senico", phone: "", note: "livre le lundi" },
    });
  });
});

describe("buildDraft — remboursement et dette", () => {
  it("refuses a payment from a customer who owes nothing", () => {
    expect(buildDraft("brouillon_paiement_client", { client: "moussa", montant: 1000, paiement: "cash" }, wide, noCosts)).toEqual({ ok: false, reason: "Moussa Diop ne doit rien." });
  });
  it("refuses a payment above the debt", () => {
    expect(buildDraft("brouillon_paiement_client", { client: "awa", montant: 9000, paiement: "wave" }, wide, noCosts)).toEqual({
      ok: false,
      reason: "Awa Ndiaye doit seulement 8000 francs.",
    });
  });
});

describe("draftForModel — nouvelles tâches", () => {
  it("describes a stock exit without ids", () => {
    const res = buildDraft("brouillon_sortie_stock", { produit: "huile", quantite: 1, motif: "breakage" }, wide, noCosts);
    if (!res.ok) throw new Error("sortie attendue");
    expect(draftForModel(res.draft)).toEqual({ action: "sortie_stock", produit: "Huile Dinor 1L", quantite: 1, unite: "litre", motif: "Casse", note: null });
  });
});
```

  Dans `tools.test.ts`, remplacer les attentes de `allowedTools` :

```ts
  it("gives every tool to the owner, with repondre last", () => {
    const tools = allowedTools(access("owner"));
    expect([...tools].sort()).toEqual(
      [
        "brouillon_client", "brouillon_commande", "brouillon_entree_stock", "brouillon_fournisseur", "brouillon_paiement_client",
        "brouillon_prix", "brouillon_produit", "brouillon_sortie_stock", "brouillon_statut_commande", "brouillon_vente",
        "clients_debiteurs", "commandes_en_cours", "repondre", "resume_ventes", "stock_produit",
      ].sort(),
    );
    expect(tools.at(-1)).toBe("repondre");
  });
  it("gives the storekeeper stock entries and exits only", () => {
    expect(allowedTools(access("storekeeper"))).toEqual(["resume_ventes", "stock_produit", "brouillon_entree_stock", "brouillon_sortie_stock", "repondre"]);
  });
  it("offers no draft at all on a read-only plan", () => {
    expect(allowedTools({ ...access("owner"), readOnly: true }).filter((t) => t.startsWith("brouillon_"))).toEqual([]);
  });
```

- [ ] **Étape 2 : lancer les tests, ils échouent**

  Commande : `npx vitest run src/lib/domain/assistant/drafts.test.ts src/lib/domain/assistant/tools.test.ts`
  Attendu : échecs (outils inconnus, variantes absentes).

- [ ] **Étape 3 : `tools.ts`** — en tête, importer les listes et compléter les constantes :

```ts
import { EXIT_REASONS, LOSS_REASONS } from "@/lib/domain/stock";
import { UNITS, type UnitId } from "@/lib/format";

export const DRAFT_TOOLS = [
  "brouillon_vente",
  "brouillon_entree_stock",
  "brouillon_sortie_stock",
  "brouillon_commande",
  "brouillon_statut_commande",
  "brouillon_paiement_client",
  "brouillon_produit",
  "brouillon_prix",
  "brouillon_client",
  "brouillon_fournisseur",
] as const;

/** Motifs d'une sortie de stock : pertes d'abord, puis sorties (clés de lib/domain/stock). */
export const STOCK_REASON_KEYS = [...Object.keys(LOSS_REASONS), ...Object.keys(EXIT_REASONS)] as [
  keyof typeof LOSS_REASONS | keyof typeof EXIT_REASONS,
  ...(keyof typeof LOSS_REASONS | keyof typeof EXIT_REASONS)[],
];
/** États qu'une commande peut prendre à la demande (jamais « new »). */
export const STATUS_TARGETS = ["preparing", "shipping", "delivered", "cancelled", "returned"] as const;
export const UNIT_IDS = UNITS.map((u) => u.id) as [UnitId, ...UnitId[]];
```

  `ToolAccess` gagne `readOnly?: boolean;` et `allowedTools` devient :

```ts
/** Outils proposés à l'IA pour ce rôle et ces modules. L'écran et l'action revérifient les droits au moment d'enregistrer. */
export function allowedTools(access: ToolAccess): ToolName[] {
  const tools: ToolName[] = ["resume_ventes"];
  if (access.can("products.view")) tools.push("stock_produit");
  if (access.can("customers.manage")) tools.push("clients_debiteurs");
  if (access.can("orders.manage")) tools.push("commandes_en_cours");
  if (!access.readOnly) {
    if (access.can("customers.manage")) tools.push("brouillon_paiement_client", "brouillon_client");
    if (access.can("orders.manage") && access.moduleOrders) tools.push("brouillon_commande", "brouillon_statut_commande");
    if (access.can("sales.create") && access.modulePos) tools.push("brouillon_vente");
    if (access.can("stock.in")) tools.push("brouillon_entree_stock");
    if (access.can("stock.adjust")) tools.push("brouillon_sortie_stock");
    if (access.can("products.manage")) tools.push("brouillon_produit", "brouillon_prix");
    if (access.can("suppliers.manage")) tools.push("brouillon_fournisseur");
  }
  tools.push("repondre");
  return tools;
}
```

  Dans `toolDeclarations`, après `brouillon_paiement_client`, ajouter (et garder `repondre` en dernier) :

```ts
    brouillon_sortie_stock: {
      name: "brouillon_sortie_stock",
      description: "Prépare une sortie de stock : une perte (casse, vol, perte, péremption, erreur de saisie) ou une sortie (vendu hors caisse, utilisé, offert, autre).",
      parameters: object(
        {
          produit: str("Nom exact du produit dans le catalogue si tu le reconnais, sinon tel que dit par le commerçant"),
          quantite: { type: "number", description: "Quantité sortie" },
          motif: oneOf(STOCK_REASON_KEYS, "breakage (casse), theft (vol), loss (perte), expired (péremption), entry_error (erreur de saisie), sold_offline (vendu hors caisse), used (utilisé), gift (offert), other (autre)"),
          note: str("Précision éventuelle"),
        },
        ["produit", "quantite", "motif"],
      ),
    },
    brouillon_statut_commande: {
      name: "brouillon_statut_commande",
      description: "Change l'état d'une commande en cours.",
      parameters: object(
        {
          commande: str("Numéro de la commande, ou nom du client qui l'a passée"),
          etat: oneOf(STATUS_TARGETS, "preparing (en préparation), shipping (en livraison), delivered (livrée), cancelled (annulée), returned (retournée)"),
        },
        ["commande", "etat"],
      ),
    },
    brouillon_produit: {
      name: "brouillon_produit",
      description: "Prépare la fiche d'un nouveau produit.",
      parameters: object(
        {
          nom: str("Nom du produit"),
          prix_vente: int("Prix de vente en FCFA"),
          ...(opts.costs ? { prix_achat: int("Prix d'achat en FCFA, s'il est dit") } : {}),
          unite: oneOf(UNIT_IDS, "Unité de vente : piece, kg, g, m, l, sac, carton, paquet, boite, rouleau, sachet, bouteille, paire, lot"),
          categorie: str("Catégorie, si elle est dite"),
          stock_initial: { type: "number", description: "Quantité déjà en boutique, si elle est dite" },
          reference: str("Référence, si elle est dite"),
        },
        ["nom", "prix_vente"],
      ),
    },
    brouillon_prix: {
      name: "brouillon_prix",
      description: "Change le prix de vente d'un produit existant (et son prix d'achat s'il est dit).",
      parameters: object(
        {
          produit: str("Nom exact du produit dans le catalogue si tu le reconnais, sinon tel que dit par le commerçant"),
          prix_vente: int("Nouveau prix de vente en FCFA"),
          ...(opts.costs ? { prix_achat: int("Nouveau prix d'achat en FCFA, s'il est dit") } : {}),
        },
        ["produit"],
      ),
    },
    brouillon_client: {
      name: "brouillon_client",
      description: "Prépare la fiche d'un nouveau client.",
      parameters: object({ nom: str("Nom du client"), telephone: str("Téléphone, s'il est dit"), adresse: str("Adresse, si elle est dite") }, ["nom"]),
    },
    brouillon_fournisseur: {
      name: "brouillon_fournisseur",
      description: "Prépare la fiche d'un nouveau fournisseur.",
      parameters: object({ nom: str("Nom du fournisseur"), telephone: str("Téléphone, s'il est dit"), note: str("Précision éventuelle") }, ["nom"]),
    },
```

- [ ] **Étape 4 : `drafts.ts`** — imports et types :

```ts
import { nextStatuses, ORDER_ACTION_LABELS, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain/orders";
import { EXIT_REASONS, LOSS_REASONS } from "@/lib/domain/stock";
import type { UnitId } from "@/lib/format";
import { findByName, normalizeName, type MatchResult } from "./match";
import { STATUS_TARGETS, STOCK_REASON_KEYS, UNIT_IDS, type DraftToolName } from "./tools";

export interface CatalogCustomer extends CatalogParty {
  /** Ce que le client doit encore (ventes à crédit), quand il est connu. */
  debt?: number;
}
export interface CatalogOrder {
  id: string;
  number: string;
  customerName: string;
  status: OrderStatus;
}
export interface DraftCatalog {
  products: CatalogProduct[];
  customers: CatalogCustomer[];
  suppliers: CatalogParty[];
  categories?: { id: string; name: string }[];
  openOrders?: CatalogOrder[];
}

const STOCK_REASONS = { ...LOSS_REASONS, ...EXIT_REASONS };
export type StockReason = keyof typeof STOCK_REASONS;
```

  Variantes ajoutées à `Draft` :

```ts
  | { action: "stock_exit"; product: PartyRef & { unit: string; available: number }; quantity: number; kind: "loss" | "exit"; reason: StockReason; reasonLabel: string; note: string }
  | { action: "order_status"; order: { id: string; number: string; customerName: string }; from: OrderStatus; to: OrderStatus; label: string }
  | { action: "product"; name: string; unit: UnitId; salePrice: number; costPrice: number | null; category: { id: string | null; name: string } | null; initialStock: number; reference: string }
  | { action: "price"; product: PartyRef; oldSalePrice: number; salePrice: number | null; costPrice: number | null }
  | { action: "customer"; name: string; phone: string; address: string }
  | { action: "supplier"; name: string; phone: string; note: string };
```

  Schémas des arguments (après `paymentArgs`) :

```ts
const exitArgs = z.object({
  produit: z.string().trim().min(1),
  quantite: z.coerce.number().positive().max(10_000_000),
  motif: z.enum(STOCK_REASON_KEYS),
  note: optionalArg(z.string().trim().max(300)),
});
const orderStatusArgs = z.object({ commande: z.string().trim().min(1), etat: z.enum(STATUS_TARGETS) });
const productArgs = z.object({
  nom: z.string().trim().min(2).max(120),
  prix_vente: z.coerce.number().int().positive(),
  prix_achat: optionalArg(z.coerce.number().int().min(0)),
  unite: optionalArg(z.enum(UNIT_IDS)),
  categorie: optionalArg(z.string().trim().max(60)),
  stock_initial: optionalArg(z.coerce.number().min(0).max(10_000_000)),
  reference: optionalArg(z.string().trim().max(60)),
});
const priceArgs = z.object({
  produit: z.string().trim().min(1),
  prix_vente: optionalArg(z.coerce.number().int().positive()),
  prix_achat: optionalArg(z.coerce.number().int().min(0)),
});
const personArgs = z.object({
  nom: z.string().trim().min(2).max(120),
  telephone: optionalArg(z.string().trim().max(30)),
  adresse: optionalArg(z.string().trim().max(300)),
  note: optionalArg(z.string().trim().max(300)),
});
```

  Constructeurs (après `paymentDraft`) ; `paymentDraft` reçoit le contrôle de la dette :

```ts
function paymentDraft(args: z.infer<typeof paymentArgs>, catalog: DraftCatalog): Draft {
  const found = pick(findByName(args.client, catalog.customers), args.client, "client");
  if (found.debt !== undefined) {
    if (found.debt <= 0) throw new DraftRefusal(`${found.name} ne doit rien.`);
    if (args.montant > found.debt) throw new DraftRefusal(`${found.name} doit seulement ${found.debt} francs.`);
  }
  const customer = ref(found);
  return {
    action: "payment",
    amount: args.montant,
    method: args.paiement,
    customer,
    payload: { customerId: customer.id, amount: args.montant, method: args.paiement },
  };
}

function exitDraft(args: z.infer<typeof exitArgs>, catalog: DraftCatalog): Draft {
  const product = pick(findByName(args.produit, catalog.products), args.produit, "produit");
  return {
    action: "stock_exit",
    product: { id: product.id, name: product.name, unit: product.unit, available: product.available },
    quantity: args.quantite,
    kind: args.motif in LOSS_REASONS ? "loss" : "exit",
    reason: args.motif,
    reasonLabel: STOCK_REASONS[args.motif],
    note: args.note ?? "",
  };
}

function findOrder(query: string, orders: CatalogOrder[]): CatalogOrder {
  const digits = query.replace(/\D/g, "");
  if (digits) {
    const byNumber = orders.filter((o) => Number(o.number.replace(/\D/g, "")) === Number(digits));
    if (byNumber.length === 1) return byNumber[0];
  }
  const match = findByName(query, orders.map((o) => ({ ...o, name: o.customerName })));
  if (match.kind === "one") return match.item;
  if (match.kind === "many") {
    throw new DraftRefusal(`Plusieurs commandes correspondent à « ${query} » : dis le numéro.`, match.items.map((o) => `${o.number} (${o.customerName})`));
  }
  throw new DraftRefusal(`Commande en cours introuvable : « ${query} ».`);
}

function orderStatusDraft(args: z.infer<typeof orderStatusArgs>, catalog: DraftCatalog): Draft {
  const order = findOrder(args.commande, catalog.openOrders ?? []);
  if (!nextStatuses(order.status).includes(args.etat)) {
    throw new DraftRefusal(`La commande ${order.number} est « ${ORDER_STATUS_LABELS[order.status]} » : elle ne peut pas passer à « ${ORDER_STATUS_LABELS[args.etat]} ».`);
  }
  return {
    action: "order_status",
    order: { id: order.id, number: order.number, customerName: order.customerName },
    from: order.status,
    to: args.etat,
    label: ORDER_ACTION_LABELS[args.etat],
  };
}

function productDraft(args: z.infer<typeof productArgs>, catalog: DraftCatalog, costs: boolean): Draft {
  const same = catalog.products.find((p) => normalizeName(p.name) === normalizeName(args.nom));
  if (same) throw new DraftRefusal(`Le produit « ${same.name} » existe déjà.`);
  let category: { id: string | null; name: string } | null = null;
  if (args.categorie) {
    const match = findByName(args.categorie, catalog.categories ?? []);
    if (match.kind === "many") throw new DraftRefusal(`Plusieurs catégories correspondent à « ${args.categorie} ».`, match.items.map((c) => c.name));
    category = match.kind === "one" ? { id: match.item.id, name: match.item.name } : { id: null, name: args.categorie };
  }
  return {
    action: "product",
    name: args.nom,
    unit: args.unite ?? "piece",
    salePrice: args.prix_vente,
    costPrice: costs ? (args.prix_achat ?? null) : null,
    category,
    initialStock: args.stock_initial ?? 0,
    reference: args.reference ?? "",
  };
}

function priceDraft(args: z.infer<typeof priceArgs>, catalog: DraftCatalog, costs: boolean): Draft {
  const product = pick(findByName(args.produit, catalog.products), args.produit, "produit");
  const costPrice = costs ? (args.prix_achat ?? null) : null;
  if (args.prix_vente === undefined && costPrice === null) throw new DraftRefusal("Dis le nouveau prix de vente.");
  return { action: "price", product: ref(product), oldSalePrice: product.salePrice, salePrice: args.prix_vente ?? null, costPrice };
}

function customerDraft(args: z.infer<typeof personArgs>, catalog: DraftCatalog): Draft {
  const same = catalog.customers.find((c) => normalizeName(c.name) === normalizeName(args.nom));
  if (same) throw new DraftRefusal(`Le client « ${same.name} » existe déjà.`);
  return { action: "customer", name: args.nom, phone: args.telephone ?? "", address: args.adresse ?? "" };
}

function supplierDraft(args: z.infer<typeof personArgs>, catalog: DraftCatalog): Draft {
  const same = catalog.suppliers.find((s) => normalizeName(s.name) === normalizeName(args.nom));
  if (same) throw new DraftRefusal(`Le fournisseur « ${same.name} » existe déjà.`);
  return { action: "supplier", name: args.nom, phone: args.telephone ?? "", note: args.note ?? "" };
}
```

  Dans `buildDraft`, ajouter les cas :

```ts
      case "brouillon_sortie_stock":
        return { ok: true, draft: exitDraft(parse(exitArgs, rawArgs), catalog) };
      case "brouillon_statut_commande":
        return { ok: true, draft: orderStatusDraft(parse(orderStatusArgs, rawArgs), catalog) };
      case "brouillon_produit":
        return { ok: true, draft: productDraft(parse(productArgs, rawArgs), catalog, opts.costs) };
      case "brouillon_prix":
        return { ok: true, draft: priceDraft(parse(priceArgs, rawArgs), catalog, opts.costs) };
      case "brouillon_client":
        return { ok: true, draft: customerDraft(parse(personArgs, rawArgs), catalog) };
      case "brouillon_fournisseur":
        return { ok: true, draft: supplierDraft(parse(personArgs, rawArgs), catalog) };
```

  Dans `draftForModel`, ajouter :

```ts
    case "stock_exit":
      return { action: "sortie_stock", produit: draft.product.name, quantite: draft.quantity, unite: draft.product.unit, motif: draft.reasonLabel, note: draft.note || null };
    case "order_status":
      return { action: "statut_commande", commande: draft.order.number, client: draft.order.customerName, etat_actuel: ORDER_STATUS_LABELS[draft.from], nouvel_etat: ORDER_STATUS_LABELS[draft.to] };
    case "product":
      return { action: "nouveau_produit", nom: draft.name, unite: draft.unit, prix_vente: draft.salePrice, prix_achat: draft.costPrice, categorie: draft.category?.name ?? null, stock_initial: draft.initialStock };
    case "price":
      return { action: "prix", produit: draft.product.name, ancien_prix_vente: draft.oldSalePrice, prix_vente: draft.salePrice, prix_achat: draft.costPrice };
    case "customer":
      return { action: "nouveau_client", nom: draft.name, telephone: draft.phone || null, adresse: draft.address || null };
    case "supplier":
      return { action: "nouveau_fournisseur", nom: draft.name, telephone: draft.phone || null, note: draft.note || null };
```

- [ ] **Étape 5 : relancer les tests** — même commande ; attendu : tout passe. Puis `npm run typecheck` : si
  `draft-card.tsx` ou `run.ts` se plaint d'un `switch` non exhaustif sur `draft.action`, ajouter `default: return null;`
  dans le composant (il sera supprimé à la tâche 11) ; `npm run lint`.

- [ ] **Étape 6 : commit**

```bash
git add src/lib/domain/assistant/tools.ts src/lib/domain/assistant/drafts.ts src/lib/domain/assistant/drafts.test.ts src/lib/domain/assistant/tools.test.ts src/components/assistant/draft-card.tsx
git commit -m "feat(assistant): brouillons de sortie de stock, état de commande, produit, prix, client et fournisseur"
```

---

### Tâche 2 : écrans « montre-moi », mission, `montrer_ecran` et `confirmer`

**Fichiers :**
- Créer : `src/lib/domain/assistant/ecrans.ts`, `src/lib/domain/assistant/mission.ts`
- Modifier : `src/lib/domain/assistant/tools.ts`
- Tests : `src/lib/domain/assistant/ecrans.test.ts` (nouveau), `src/lib/domain/assistant/tools.test.ts`

**Interfaces :**
- Consomme : `Draft`, `draftForModel`, `CatalogProduct`, `CatalogParty` (tâche 1) ; `findByName`.
- Produit (tools.ts) : `ECRANS`, `SpecialToolName = "montrer_ecran" | "confirmer"`, `ToolName` élargi,
  `allowedTools(access, opts?: { attente?: boolean })`.
- Produit (ecrans.ts) : `NomEcran`, `EcranMission { ecran; url; cible; titre }`,
  `EcranAccess { reports; products; orders; customers }`, `EcranResult`,
  `buildEcran(raw, catalog: { products; customers }, access): EcranResult`.
- Produit (mission.ts) : `Mission = { type: "tache"; tache: Draft } | { type: "ecran"; ecran: EcranMission }`,
  `Confirmation = "oui" | "non"`, `missionForModel(mission): string`.

- [ ] **Étape 1 : tests qui échouent** — `ecrans.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildEcran, type EcranAccess } from "./ecrans";

const catalog = {
  products: [{ id: "p1", name: "Riz parfumé 1kg", unit: "kg", salePrice: 600, costPrice: null, available: 40 }],
  customers: [{ id: "c1", name: "Awa Ndiaye", phone: null }],
};
const all: EcranAccess = { reports: true, products: true, orders: true, customers: true };

describe("buildEcran", () => {
  it("opens the dashboard", () => {
    expect(buildEcran({ ecran: "tableau_de_bord" }, catalog, all)).toEqual({
      ok: true,
      ecran: { ecran: "tableau_de_bord", url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" },
    });
  });
  it("maps the period of the sales page", () => {
    expect(buildEcran({ ecran: "ventes", periode: "hier" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/ventes?periode=yesterday", cible: "ventes.total" } });
    expect(buildEcran({ ecran: "ventes_credit" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/ventes?periode=mois&etat=credit" } });
  });
  it("falls back to the dashboard without advanced reports", () => {
    expect(buildEcran({ ecran: "rapports", periode: "mois" }, catalog, { ...all, reports: false })).toMatchObject({ ok: true, ecran: { ecran: "tableau_de_bord" } });
    expect(buildEcran({ ecran: "rapports", periode: "7jours" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/rapports?periode=7j" } });
  });
  it("opens low stock and out of stock lists", () => {
    expect(buildEcran({ ecran: "stock_bas" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits?etat=bas", cible: "produits.liste" } });
    expect(buildEcran({ ecran: "ruptures" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits?etat=rupture" } });
  });
  it("opens a customer or a product found by name", () => {
    expect(buildEcran({ ecran: "client", nom: "awa" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/clients/c1", cible: "client.solde", titre: "Awa Ndiaye" } });
    expect(buildEcran({ ecran: "produit", nom: "riz" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits/p1", cible: "produit.stock" } });
  });
  it("refuses what the user cannot open, or a missing name", () => {
    expect(buildEcran({ ecran: "commandes" }, catalog, { ...all, orders: false })).toEqual({ ok: false, reason: "Tu n'as pas accès aux commandes." });
    expect(buildEcran({ ecran: "client" }, catalog, all)).toEqual({ ok: false, reason: "Dis le nom du client." });
    expect(buildEcran({ ecran: "client", nom: "fatou" }, catalog, all)).toEqual({ ok: false, reason: "Client introuvable : « fatou »." });
    expect(buildEcran({ ecran: "cuisine" }, catalog, all)).toEqual({ ok: false, reason: "Écran inconnu." });
  });
});
```

  Dans `tools.test.ts` : l'attente du propriétaire gagne `"montrer_ecran"`, celle du magasinier devient
  `["resume_ventes", "montrer_ecran", "stock_produit", "brouillon_entree_stock", "brouillon_sortie_stock", "repondre"]`, et :

```ts
  it("adds confirmer only while a task waits for the user's answer", () => {
    expect(allowedTools(access("owner"))).not.toContain("confirmer");
    expect(allowedTools(access("owner"), { attente: true }).slice(-2)).toEqual(["confirmer", "repondre"]);
  });
```

- [ ] **Étape 2 : lancer** `npx vitest run src/lib/domain/assistant/ecrans.test.ts src/lib/domain/assistant/tools.test.ts` → échecs.

- [ ] **Étape 3 : `tools.ts`** — constantes et types :

```ts
export const ECRANS = ["tableau_de_bord", "rapports", "stock_bas", "ruptures", "ventes", "ventes_credit", "commandes", "client", "produit"] as const;
export type SpecialToolName = "montrer_ecran" | "confirmer";
export type ToolName = ReadToolName | DraftToolName | SpecialToolName | "repondre";
```

  `allowedTools(access: ToolAccess, opts: { attente?: boolean } = {})` : `const tools: ToolName[] = ["resume_ventes", "montrer_ecran"];`
  au début, et juste avant `tools.push("repondre")` : `if (opts.attente) tools.push("confirmer");`.
  Déclarations (avant `repondre`) :

```ts
    montrer_ecran: {
      name: "montrer_ecran",
      description: "Ouvre un écran de l'application devant le commerçant et montre du doigt le chiffre ou la liste demandés.",
      parameters: object(
        {
          ecran: oneOf(ECRANS, "tableau_de_bord, rapports, stock_bas, ruptures, ventes, ventes_credit (ventes à crédit), commandes, client (fiche d'un client), produit (fiche d'un produit)"),
          periode: oneOf(PERIODS, "Période pour les ventes ou les rapports"),
          nom: str("Nom du client ou du produit, pour ouvrir sa fiche"),
        },
        ["ecran"],
      ),
    },
    confirmer: {
      name: "confirmer",
      description: "Réponse du commerçant à « Je l'enregistre ? » pour la tâche remplie à l'écran.",
      parameters: object({ reponse: oneOf(["oui", "non"], "oui : waaw, oui, bind ko, def ko ; non : déedéet, non, bayyil") }, ["reponse"]),
    },
```

- [ ] **Étape 4 : `ecrans.ts`**

```ts
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
```

- [ ] **Étape 5 : `mission.ts`**

```ts
// src/lib/domain/assistant/mission.ts
import { draftForModel, type Draft } from "./drafts";
import type { EcranMission } from "./ecrans";

/** Ce que le téléphone doit jouer : une tâche à remplir à l'écran, ou un écran à montrer. */
export type Mission = { type: "tache"; tache: Draft } | { type: "ecran"; ecran: EcranMission };
export type Confirmation = "oui" | "non";

/** Texte renvoyé au serveur pendant l'attente du « oui » : la tâche sans aucun identifiant. */
export function missionForModel(mission: Mission): string {
  return JSON.stringify(mission.type === "tache" ? draftForModel(mission.tache) : { ecran: mission.ecran.titre });
}
```

  Ajouter à `ecrans.test.ts` :

```ts
import { missionForModel } from "./mission";

describe("missionForModel", () => {
  it("keeps names and amounts, never ids", () => {
    const text = missionForModel({ type: "tache", tache: { action: "customer", name: "Fatou Sall", phone: "", address: "" } });
    expect(text).toBe('{"action":"nouveau_client","nom":"Fatou Sall","telephone":null,"adresse":null}');
  });
});
```

- [ ] **Étape 6 : relancer** les tests (attendu : tout passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 7 : commit**

```bash
git add src/lib/domain/assistant/ecrans.ts src/lib/domain/assistant/ecrans.test.ts src/lib/domain/assistant/mission.ts src/lib/domain/assistant/tools.ts src/lib/domain/assistant/tools.test.ts
git commit -m "feat(assistant): écrans « montre-moi », missions et outil de confirmation"
```

---

### Tâche 3 : consignes du mode pilote

**Fichiers :** modifier `src/lib/domain/assistant/prompt.ts` ; tests `src/lib/domain/assistant/prompt.test.ts`.

**Interfaces :** `buildSystemPrompt` garde sa signature.

- [ ] **Étape 1 : tests qui échouent** — remplacer le test « asks for the draft and the final answer in the same
  turn, without amounts » par :

```ts
  it("explains the screen tasks, the agreement and the single task rule", () => {
    const text = buildSystemPrompt({ ...base, products: [] });
    expect(text).toContain("dans le même tour");
    expect(text).toContain("ne répète pas les montants");
    expect(text).toContain("l'assistant remplit l'écran devant le commerçant puis lui demande s'il peut enregistrer");
    expect(text).toContain("Une seule tâche par demande");
    expect(text).toContain("« montrer_ecran »");
    expect(text).not.toContain("Tu ne peux ni créer de produit");
  });
```

- [ ] **Étape 2 : lancer** `npx vitest run src/lib/domain/assistant/prompt.test.ts` → échec.

- [ ] **Étape 3 : implémenter** — dans `Règles`, remplacer la ligne du brouillon, la ligne « Pour les ventes, les
  dettes… » et la ligne « Tu ne peux ni créer… » par :

```ts
    "- Pour une tâche (vente, entrée ou sortie de stock, commande, état d'une commande, remboursement d'un client, nouveau produit, prix, nouveau client, nouveau fournisseur), appelle l'outil de brouillon et, dans le même tour, « repondre » avec une phrase courte : l'assistant remplit l'écran devant le commerçant puis lui demande s'il peut enregistrer. Ne répète pas les montants. Rien n'est enregistré sans son accord.",
    "- Une seule tâche par demande : s'il en demande plusieurs, prépare la première et dis-lui de redire la suite ensuite.",
    "- Pour montrer quelque chose (tableau de bord, rapports, stock bas, ruptures, ventes, ventes à crédit, commandes, fiche d'un client ou d'un produit), appelle « montrer_ecran » et, dans le même tour, « repondre ».",
    "- Pour les ventes, les dettes et les commandes, appelle d'abord l'outil de lecture, puis réponds avec le résultat en appelant aussi « montrer_ecran » sur l'écran qui le montre.",
    "- Tu ne peux ni annuler, ni supprimer, ni faire un inventaire ou un transfert : renvoie vers l'application.",
```

- [ ] **Étape 4 : relancer** (passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/domain/assistant/prompt.ts src/lib/domain/assistant/prompt.test.ts
git commit -m "feat(assistant): consignes du mode pilote (tâche à l'écran, accord, montre-moi)"
```

---

### Tâche 4 : boucle serveur, route et catalogue élargi

**Fichiers :**
- Modifier : `src/lib/domain/assistant/reply.ts`, `src/server/assistant/run.ts`, `src/server/assistant/readers.ts`,
  `src/app/api/assistant/route.ts`
- Modifier si le typecheck le demande : `scripts/assistant-essai.ts`
- Modifier temporairement : `src/components/assistant/assistant-panel.tsx` (lire `reply.mission`)
- Tests : `src/server/assistant/run.test.ts`

**Interfaces :**
- Consomme : `Mission`, `Confirmation`, `missionForModel` ; `buildEcran`, `EcranResult`, `EcranAccess` ;
  `allowedTools(access, { attente })`.
- Produit : `AssistantReply = { transcription; langue; texte; mission: Mission | null; confirmation: Confirmation | null }` ;
  `RunInput.attente?: string | null` ; `RunDeps.ecran(args): Promise<EcranResult> | EcranResult` ;
  corps de `POST /api/assistant` : `{ audio, history, attente? }` (`attente` = `missionForModel(...)`, 3000 caractères au plus).

- [ ] **Étape 1 : tests** — dans `run.test.ts` :
  - `deps` reçoit `ecran: vi.fn(() => ({ ok: true as const, ecran: SCREEN }))` avec
    `const SCREEN = { ecran: "tableau_de_bord" as const, url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" };`
  - chaque attente `brouillon: null` devient `mission: null, confirmation: null` ; chaque `expect(reply.brouillon).toEqual(PAYMENT)`
    devient `expect(reply.mission).toEqual({ type: "tache", tache: PAYMENT })` ; `expect(reply.brouillon).toBeNull()`
    devient `expect(reply.mission).toBeNull()`.
  - `input.tools` devient `toolDeclarations(["stock_produit", "brouillon_paiement_client", "montrer_ecran", "confirmer", "repondre"], { costs: false })`.
  - ajouter :

```ts
describe("runAssistant — écrans et accord", () => {
  it("shows a screen in a single call when montrer_ecran comes with repondre", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("montrer_ecran", { ecran: "tableau_de_bord" }).parts, ...final("Voilà ton tableau de bord.").parts] };
    const { gemini, requests } = scripted(both);
    const reply = await runAssistant(input, deps(gemini));
    expect(requests).toHaveLength(1);
    expect(reply.mission).toEqual({ type: "ecran", ecran: SCREEN });
  });
  it("returns the user's agreement", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("confirmer", { reponse: "oui" }).parts, ...final("Je l'enregistre.").parts] };
    const { gemini } = scripted(both);
    const reply = await runAssistant({ ...input, attente: '{"action":"paiement_client"}' }, deps(gemini));
    expect(reply).toMatchObject({ confirmation: "oui", mission: null });
  });
  it("puts the waiting task before the audio", async () => {
    const { gemini, requests } = scripted(final("D'accord."));
    await runAssistant({ ...input, attente: '{"action":"paiement_client"}' }, deps(gemini));
    const parts = requests[0].contents[0].parts;
    expect(parts[0].text).toContain('Tâche remplie à l\'écran, en attente de l\'accord du commerçant : {"action":"paiement_client"}');
    expect(parts[1].inlineData).toBeDefined();
  });
  it("asks again when the screen is refused", async () => {
    const d = deps(scripted().gemini);
    const { gemini, requests } = scripted(call("montrer_ecran", { ecran: "client" }), final("Quel client ?"));
    d.gemini = gemini;
    d.ecran.mockReturnValueOnce({ ok: false, reason: "Dis le nom du client." } as never);
    const reply = await runAssistant(input, d);
    expect(requests).toHaveLength(2);
    expect(reply.mission).toBeNull();
  });
});
```

- [ ] **Étape 2 : lancer** `npx vitest run src/server/assistant/run.test.ts` → échecs.

- [ ] **Étape 3 : `reply.ts`**

```ts
// src/lib/domain/assistant/reply.ts
import type { Confirmation, Mission } from "./mission";
import type { Lang } from "./tools";

/** Un message du fil, gardé dans le téléphone et renvoyé avec la demande suivante (texte seulement). */
export interface HistoryItem {
  role: "user" | "assistant";
  text: string;
}

/** Réponse de POST /api/assistant. */
export interface AssistantReply {
  transcription: string;
  langue: Lang;
  texte: string;
  /** Ce que le téléphone doit jouer à l'écran, ou null pour une simple réponse. */
  mission: Mission | null;
  /** Pendant l'attente d'un accord : la réponse du commerçant, sinon null. */
  confirmation: Confirmation | null;
}
```

- [ ] **Étape 4 : `run.ts`** — remplacer le contenu par :

```ts
// Pas de "server-only" : les dépendances (Gemini, base) sont injectées, ce qui rend la boucle testable.
import { z } from "zod";
import { draftForModel, type DraftResult } from "@/lib/domain/assistant/drafts";
import type { EcranResult } from "@/lib/domain/assistant/ecrans";
import type { Confirmation, Mission } from "@/lib/domain/assistant/mission";
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";
import { isDraftTool, isReadTool, LANGS, type DraftToolName, type FunctionDeclaration, type ReadToolName } from "@/lib/domain/assistant/tools";
import type { GeminiCall, GeminiContent, GeminiPart } from "./gemini";

/** 3 tours d'outils au plus, puis la réponse finale. */
export const MAX_GEMINI_CALLS = 4;

export const USER_INSTRUCTION = "Note vocale du commerçant ci-dessus. Réponds à sa demande avec les outils, puis termine par « repondre ».";

const NOT_UNDERSTOOD = "Je n'ai pas compris, peux-tu répéter ?";

export class AssistantError extends Error {
  constructor(message = NOT_UNDERSTOOD) {
    super(message);
    this.name = "AssistantError";
  }
}

export interface RunInput {
  system: string;
  history: HistoryItem[];
  audio: { mimeType: string; data: string };
  tools: FunctionDeclaration[];
  /** Tâche remplie à l'écran qui attend le « oui » du commerçant (texte de missionForModel). */
  attente?: string | null;
}

export interface RunDeps {
  gemini: GeminiCall;
  read: (name: ReadToolName, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  draft: (name: DraftToolName, args: Record<string, unknown>) => Promise<DraftResult> | DraftResult;
  ecran: (args: Record<string, unknown>) => Promise<EcranResult> | EcranResult;
}

const MAX_TEXT = 800;
/** Un texte trop long est coupé plutôt que refusé : sinon le panneau reste bloqué sur « Je n'ai pas compris ». */
const clipped = (value: string) => value.trim().slice(0, MAX_TEXT);
const finalArgs = z.object({
  transcription: z.string().default("").transform(clipped),
  langue: z.enum(LANGS),
  texte: z.string().transform(clipped).pipe(z.string().min(1)),
});
const confirmArgs = z.object({ reponse: z.enum(["oui", "non"]) });

type CallPart = GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> };

/** Les 5 derniers échanges (10 messages), en texte, placés avant l'audio de la nouvelle demande. */
export function historyText(history: HistoryItem[]): string | null {
  const recent = history.slice(-10);
  if (!recent.length) return null;
  return `Échanges précédents :\n${recent.map((h) => `${h.role === "user" ? "Commerçant" : "Assistant"} : ${h.text}`).join("\n")}`;
}

export function attenteText(attente: string): string {
  return [
    `Tâche remplie à l'écran, en attente de l'accord du commerçant : ${attente}`,
    "S'il dit oui (waaw, oui, bind ko, def ko) ou non (déedéet, non, bayyil), appelle « confirmer ».",
    "S'il corrige quelque chose, appelle le même outil de brouillon avec la tâche entière corrigée.",
  ].join("\n");
}

export async function runAssistant(input: RunInput, deps: RunDeps): Promise<AssistantReply> {
  const allowed = new Set<string>(input.tools.map((t) => t.name));
  const intro = [historyText(input.history), input.attente ? attenteText(input.attente) : null].filter((t): t is string => Boolean(t));
  const contents: GeminiContent[] = [
    { role: "user", parts: [...intro.map((text) => ({ text })), { inlineData: input.audio }, { text: USER_INSTRUCTION }] },
  ];
  let mission: Mission | null = null;
  let confirmation: Confirmation | null = null;
  const done = (args: z.infer<typeof finalArgs>): AssistantReply => ({ ...args, mission, confirmation });

  for (let i = 0; i < MAX_GEMINI_CALLS; i++) {
    const content = await deps.gemini({ system: input.system, contents, tools: input.tools });
    const calls = content.parts.filter((p): p is CallPart => Boolean(p.functionCall));
    if (!calls.length) throw new AssistantError();

    const others = calls.filter((c) => c.functionCall.name !== "repondre");
    if (!others.length) {
      const parsed = finalArgs.safeParse(calls[0].functionCall.args ?? {});
      if (!parsed.success) throw new AssistantError();
      return done(parsed.data);
    }

    // Les appels du tour (sauf « repondre ») sont exécutés ; « réglé » = mission valide ou accord reçu
    const results = new Map<CallPart, Record<string, unknown>>();
    let allSettled = true;
    for (const part of others) {
      const { name } = part.functionCall;
      const args = part.functionCall.args ?? {};
      let response: Record<string, unknown>;
      let settled = false;
      if (!allowed.has(name)) {
        response = { erreur: "Outil non autorisé pour cet utilisateur." };
      } else if (isReadTool(name)) {
        response = await deps.read(name, args);
      } else if (isDraftTool(name)) {
        const result = await deps.draft(name, args);
        if (result.ok) {
          mission = { type: "tache", tache: result.draft };
          settled = true;
          response = {
            ok: true,
            brouillon: draftForModel(result.draft),
            message: "Tâche lancée à l'écran : l'assistant remplit le formulaire puis demande au commerçant s'il peut enregistrer.",
          };
        } else {
          response = { ok: false, raison: result.reason, ...(result.candidates ? { candidats: result.candidates } : {}) };
        }
      } else if (name === "montrer_ecran") {
        const result = await deps.ecran(args);
        if (result.ok) {
          mission = { type: "ecran", ecran: result.ecran };
          settled = true;
          response = { ok: true, ecran: result.ecran.titre, message: "Écran ouvert devant le commerçant." };
        } else {
          response = { ok: false, raison: result.reason, ...(result.candidates ? { candidats: result.candidates } : {}) };
        }
      } else if (name === "confirmer") {
        const parsed = confirmArgs.safeParse(args);
        if (parsed.success) {
          confirmation = parsed.data.reponse;
          settled = true;
          response = { ok: true };
        } else {
          response = { ok: false, raison: "La réponse doit être oui ou non." };
        }
      } else {
        response = { erreur: "Outil inconnu." };
      }
      if (!settled) allSettled = false;
      results.set(part, response);
    }

    // Chemin rapide : mission ou accord valides + réponse finale dans le même tour → pas de second appel.
    const finalCall = calls.find((c) => c.functionCall.name === "repondre");
    if (finalCall && allSettled) {
      const parsed = finalArgs.safeParse(finalCall.functionCall.args ?? {});
      if (parsed.success) return done(parsed.data);
    }

    // Sinon chaque appel reçoit sa functionResponse, dans le même ordre ; « repondre » est ignoré
    // (sa phrase n'a pas encore vu les résultats d'une lecture ou d'un refus).
    const responses: GeminiPart[] = calls.map((part) => ({
      functionResponse: {
        ...(part.functionCall.id ? { id: part.functionCall.id } : {}),
        name: part.functionCall.name,
        response:
          part.functionCall.name === "repondre"
            ? { ok: false, message: "Réponse finale ignorée : réponds avec « repondre » après avoir lu les résultats des autres outils." }
            : results.get(part)!,
      },
    }));
    contents.push(content, { role: "user", parts: responses });
  }
  throw new AssistantError();
}
```

- [ ] **Étape 5 : `readers.ts`** — `loadDraftCatalog` charge aussi les catégories, les commandes en cours et la dette :

```ts
import { isOrderStatus } from "@/lib/domain/orders";
import { listCategories, type ProductRow } from "../queries/products";

/** Catalogue servant à vérifier les brouillons et les écrans. Il reste sur le serveur. */
export async function loadDraftCatalog(ctx: BusinessContext, products: ProductRow[]): Promise<DraftCatalog> {
  const [customers, suppliers, categories, orders] = await Promise.all([
    listCustomers(ctx.business.id),
    listSuppliers(ctx.business.id),
    listCategories(ctx.business.id),
    ctx.can("orders.manage") ? listOrders(ctx, "open", {}, { limit: 50, offset: 0 }) : Promise.resolve([]),
  ]);
  const costs = ctx.can("costs.view");
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, salePrice: p.salePrice, costPrice: costs ? p.costPrice : null, available: p.available })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, debt: c.debt })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    openOrders: orders.flatMap((o) =>
      isOrderStatus(o.status) ? [{ id: o.id, number: String(o.number), customerName: o.customerName ?? "", status: o.status }] : [],
    ),
  };
}
```

  (Si `listOrders` ne renvoie pas `id`, l'ajouter à son `select` dans `src/server/queries/orders.ts`.)

- [ ] **Étape 6 : `route.ts`** — remplacer le corps de la requête et l'appel :

```ts
import { buildEcran } from "@/lib/domain/assistant/ecrans";

const bodySchema = z.object({
  audio: z.string().min(1000).max(MAX_AUDIO_BASE64),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(800) }))
    .max(10)
    .default([]),
  /** Tâche remplie à l'écran qui attend le « oui » (missionForModel). */
  attente: z.string().max(3000).optional(),
});
```

  et dans `POST`, après le quota :

```ts
  const costs = ctx.can("costs.view");
  const attente = parsed.data.attente ?? null;
  const tools = toolDeclarations(
    allowedTools(
      { can: ctx.can, modulePos: ctx.business.modulePos, moduleOrders: ctx.business.moduleOrders, readOnly: ctx.plan.readOnly },
      { attente: Boolean(attente) },
    ),
    { costs },
  );
  const system = buildSystemPrompt({ businessName: ctx.business.name, roleLabel: ROLE_LABELS[ctx.role], today: new Date(), products });
  let catalog: Promise<DraftCatalog> | null = null;
  const loadCatalog = () => (catalog ??= loadDraftCatalog(ctx, products));
  const access = {
    reports: ctx.can("reports.view") && ctx.plan.limits.advancedReports,
    products: ctx.can("products.view"),
    orders: ctx.can("orders.manage") && ctx.business.moduleOrders,
    customers: ctx.can("customers.manage"),
  };

  try {
    const reply = await runAssistant(
      { system, history: parsed.data.history, audio: { mimeType: "audio/wav", data: parsed.data.audio }, tools, attente },
      {
        gemini: createGemini({ apiKey, models: parseModels(process.env.GEMINI_MODEL) }),
        read: createReaders(ctx, products),
        draft: async (name, args) => buildDraft(name, args, await loadCatalog(), { costs }),
        ecran: async (args) => buildEcran(args, await loadCatalog(), access),
      },
    );
```

  (Vérifier les noms `ctx.plan.readOnly` et `ctx.plan.limits.advancedReports` dans `src/server/context.ts` ; ils sont
  utilisés par `vendre/page.tsx` et `rapports/page.tsx`.)

- [ ] **Étape 7 : panneau provisoire** — dans `assistant-panel.tsx`, remplacer `draft: res.reply.brouillon` par
  `draft: res.reply.mission?.type === "tache" ? res.reply.mission.tache : null` (le panneau est refait à la tâche 11).
  Si `scripts/assistant-essai.ts` appelle `runAssistant`, ajouter `ecran: () => ({ ok: false, reason: "Écrans désactivés dans l'essai." })` à ses dépendances.

- [ ] **Étape 8 : relancer** `npx vitest run src/server/assistant src/lib/domain/assistant` (passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 9 : commit**

```bash
git add src/lib/domain/assistant/reply.ts src/server/assistant/run.ts src/server/assistant/run.test.ts src/server/assistant/readers.ts src/server/queries/orders.ts src/app/api/assistant/route.ts src/components/assistant/assistant-panel.tsx scripts/assistant-essai.ts
git commit -m "feat(assistant): le serveur renvoie une mission (tâche ou écran) et l'accord du commerçant"
```

---

### Tâche 5 : phrases prêtes et voix côté serveur

**Fichiers :**
- Créer : `src/lib/domain/assistant/phrases.ts`, `src/server/assistant/voix.ts`, `src/app/api/assistant/reveil/route.ts`,
  `scripts/phrases-voix.ts`
- Modifier : `src/app/api/assistant/voix/route.ts`, `vercel.json`
- Tests : `src/lib/domain/assistant/phrases.test.ts`, `src/server/assistant/voix.test.ts`

**Interfaces :**
- Produit : `PHRASES`, `ClePhrase`, `fichierPhrase(cle): string`, `decouperPhrases(texte): string[]` ;
  `voixPrete(base, timeoutMs, fetchImpl?): Promise<boolean>` ; `GET /api/assistant/voix` → `{ configuree, pret }` ;
  `GET /api/assistant/reveil` (tâche planifiée, protégée comme `/api/sauvegardes/nuit`).

- [ ] **Étape 1 : tests qui échouent** — `phrases.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { decouperPhrases, fichierPhrase, PHRASES } from "./phrases";

describe("phrases prêtes", () => {
  it("has a wolof and a french text for each key, and a file path", () => {
    for (const [cle, phrase] of Object.entries(PHRASES)) {
      expect(phrase.wo.length).toBeGreaterThan(2);
      expect(phrase.fr.length).toBeGreaterThan(2);
      expect(fichierPhrase(cle as keyof typeof PHRASES)).toBe(`/assistant/voix/${cle}.wav`);
    }
    expect(PHRASES["je-peux-enregistrer"].wo).toBe("Ndax ma bind ko ?");
  });
});

describe("decouperPhrases", () => {
  it("splits on sentence ends and keeps the punctuation", () => {
    expect(decouperPhrases("Tay am nga 12 jaay. Xaalis bi 45 000 francs la ! Jërëjëf ?")).toEqual(["Tay am nga 12 jaay.", "Xaalis bi 45 000 francs la !", "Jërëjëf ?"]);
  });
  it("glues very short pieces to the previous sentence", () => {
    expect(decouperPhrases("Waaw. Bind naa ko ci kàrt bi.")).toEqual(["Waaw. Bind naa ko ci kàrt bi."]);
  });
  it("returns the whole text when there is no sentence end", () => {
    expect(decouperPhrases("  Mii ngi nii  ")).toEqual(["Mii ngi nii"]);
    expect(decouperPhrases("   ")).toEqual([]);
  });
});
```

  `src/server/assistant/voix.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { voixPrete } from "./voix";

describe("voixPrete", () => {
  it("is ready when /health answers healthy", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "healthy" }), { status: 200 }));
    await expect(voixPrete("https://x.hf.space/", 1000, fetchImpl)).resolves.toBe(true);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe("https://x.hf.space/health");
  });
  it("is not ready while the space sleeps or fails", async () => {
    await expect(voixPrete("https://x.hf.space", 1000, vi.fn(async () => new Response("<html>", { status: 503 })))).resolves.toBe(false);
    await expect(voixPrete("https://x.hf.space", 1000, vi.fn(async () => { throw new TypeError("fetch failed"); }))).resolves.toBe(false);
  });
});
```

- [ ] **Étape 2 : lancer** `npx vitest run src/lib/domain/assistant/phrases.test.ts src/server/assistant/voix.test.ts` → échecs.

- [ ] **Étape 3 : `phrases.ts`**

```ts
// src/lib/domain/assistant/phrases.ts
/** Phrases du parcours, produites une fois avec la voix Anta (public/assistant/voix) : elles se jouent tout de suite. */
export const PHRASES = {
  "je-m-en-occupe": { wo: "Waaw, maa ngi ko def.", fr: "D'accord, je m'en occupe." },
  "je-peux-enregistrer": { wo: "Ndax ma bind ko ?", fr: "Je l'enregistre ?" },
  enregistre: { wo: "Bind naa ko.", fr: "C'est enregistré." },
  laisse: { wo: "Baax na, bayyi naa ko ci écran bi.", fr: "D'accord, je le laisse à l'écran." },
  reprise: { wo: "Yaa ngi ko jël.", fr: "Tu as repris la main." },
  souci: { wo: "Am na jafe-jafe, xoolal écran bi.", fr: "Il y a un souci, regarde l'écran." },
  voici: { wo: "Mii ngi nii.", fr: "Voilà." },
} as const;

export type ClePhrase = keyof typeof PHRASES;

export function fichierPhrase(cle: ClePhrase): string {
  return `/assistant/voix/${cle}.wav`;
}

/** Morceau plus court : collé à la phrase précédente (une voix lancée pour trois lettres coûte plus qu'elle ne rapporte). */
const MIN_PHRASE = 12;

/** Découpe une réponse en phrases, pour lire la première pendant que la suivante se prépare. */
export function decouperPhrases(texte: string): string[] {
  const morceaux = texte.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const phrases: string[] = [];
  for (const brut of morceaux) {
    const morceau = brut.trim();
    if (!morceau) continue;
    const dernier = phrases.at(-1);
    if (dernier !== undefined && dernier.length < MIN_PHRASE) phrases[phrases.length - 1] = `${dernier} ${morceau}`;
    else phrases.push(morceau);
  }
  return phrases;
}
```

- [ ] **Étape 4 : `src/server/assistant/voix.ts`**

```ts
// Pas de "server-only" : testé avec Vitest.
/** La copie de la voix Anta (Hugging Face) répond-elle ? Un espace endormi renvoie une page HTML ou rien. */
export async function voixPrete(base: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${base.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { status?: string } | null;
    return data?.status === "healthy";
  } catch {
    return false;
  }
}
```

- [ ] **Étape 5 : routes** — dans `src/app/api/assistant/voix/route.ts`, ajouter :

```ts
import { voixPrete } from "@/server/assistant/voix";

/** Réveil de la voix, demandé par le téléphone à l'ouverture de l'assistant (il n'attend pas la réponse). */
export async function GET() {
  const app = await getContext();
  if (!app?.business) return fail("Votre session a expiré. Reconnectez-vous.", 401);
  const base = process.env.ANTA_TTS_URL;
  if (!base) return NextResponse.json({ configuree: false, pret: false }, { headers: NO_STORE });
  return NextResponse.json({ configuree: true, pret: await voixPrete(base, 5_000) }, { headers: NO_STORE });
}
```

  Créer `src/app/api/assistant/reveil/route.ts` :

```ts
import { NextResponse } from "next/server";
import { voixPrete } from "@/server/assistant/voix";
import { isBackupKeyValid } from "@/server/backup/key";

export const maxDuration = 60;

/** Tâche planifiée quotidienne : garde la voix Anta éveillée (l'espace s'endort après 48 h sans usage). */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const base = process.env.ANTA_TTS_URL;
  if (!base) return NextResponse.json({ configuree: false });
  return NextResponse.json({ configuree: true, pret: await voixPrete(base, 55_000) });
}
```

  `vercel.json` : `"crons": [{ "path": "/api/sauvegardes/nuit", "schedule": "0 2 * * *" }, { "path": "/api/assistant/reveil", "schedule": "0 6 * * *" }]`.

- [ ] **Étape 6 : `scripts/phrases-voix.ts`**

```ts
// Produit les phrases prêtes avec la voix Anta : npx tsx scripts/phrases-voix.ts
// Lit ANTA_TTS_URL dans l'environnement ou dans .env.local, écrit public/assistant/voix/<clé>.wav.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PHRASES, type ClePhrase } from "../src/lib/domain/assistant/phrases";

function adresseVoix(): string {
  const local = existsSync(".env.local") ? readFileSync(".env.local", "utf8").match(/^ANTA_TTS_URL=(.+)$/m)?.[1]?.trim() : undefined;
  const base = process.env.ANTA_TTS_URL ?? local;
  if (!base) throw new Error("ANTA_TTS_URL manquant (environnement ou .env.local).");
  return base.replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}

async function main() {
  const base = adresseVoix();
  mkdirSync("public/assistant/voix", { recursive: true });
  for (const cle of Object.keys(PHRASES) as ClePhrase[]) {
    const res = await fetch(`${base}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: PHRASES[cle].wo }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio/")) throw new Error(`${cle} : HTTP ${res.status}`);
    writeFileSync(`public/assistant/voix/${cle}.wav`, Buffer.from(await res.arrayBuffer()));
    console.log(`ok ${cle}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Étape 7 : relancer** les tests (passent), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 8 : commit**

```bash
git add src/lib/domain/assistant/phrases.ts src/lib/domain/assistant/phrases.test.ts src/server/assistant/voix.ts src/server/assistant/voix.test.ts src/app/api/assistant/voix/route.ts src/app/api/assistant/reveil/route.ts vercel.json scripts/phrases-voix.ts
git commit -m "feat(assistant): phrases prêtes, réveil de la voix wolof et tâche planifiée"
```

---

### Tâche 6 : types des pilotes, recettes et exemples

**Fichiers :**
- Créer : `src/components/assistant/pilote/types.ts`, `src/components/assistant/pilote/recettes.ts`,
  `src/components/assistant/pilote/exemples.ts`
- Tests : `src/components/assistant/pilote/recettes.test.ts`

**Interfaces :**
- Consomme : `Mission` (tâche 2), `Draft` (tâche 1), `formatFCFA` (`@/lib/format`).
- Produit : `ResultatPilote`, les interfaces `PiloteVente`, `PiloteEncaisser`, `PiloteEntree`, `PiloteSortie`,
  `PiloteCommande`, `PiloteStatutCommande`, `PilotePaiement`, `PiloteProduit`, `PiloteFiche`, `Pilotes`, `NomPilote`,
  `Etape`, `agir()`, `finir()` ; `etapesPour(mission): Etape[]` ; `MISSIONS_EXEMPLES: Mission[]`.

- [ ] **Étape 1 : `types.ts`**

```ts
// src/components/assistant/pilote/types.ts
import type { OrderChannel, PayingMethod } from "@/lib/domain/assistant/drafts";
import type { OrderStatus } from "@/lib/domain/orders";
import type { SaleMethod } from "@/lib/domain/sales";

/** Ce que rend le bouton final d'un écran quand l'assistant appuie dessus. */
export interface ResultatPilote {
  ok: boolean;
  message: string;
}

export interface PiloteVente {
  vider(): void;
  ajouterProduit(productId: string, quantite: number): void;
  prixNegocie(productId: string, prix: number): void;
  ouvrirEncaisser(): void;
}
export interface PiloteEncaisser {
  paiement(methode: SaleMethod): void;
  montantRecu(montant: number): void;
  client(customerId: string | null): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteEntree {
  vider(): void;
  ajouterLigne(productId: string, quantite: number, coutUnitaire: number | null): void;
  fournisseur(supplierId: string | null): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteSortie {
  produit(productId: string): void;
  genre(genre: "loss" | "exit"): void;
  motif(motif: string): void;
  quantite(quantite: number): void;
  note(texte: string): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteCommande {
  vider(): void;
  client(customerId: string): void;
  canal(canal: OrderChannel): void;
  ajouterLigne(productId: string, quantite: number): void;
  livraison(adresse: string, frais: number): void;
  acompte(montant: number, methode: PayingMethod | null): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteStatutCommande {
  changerStatut(etat: OrderStatus): Promise<ResultatPilote>;
}
export interface PilotePaiement {
  ouvrir(): void;
  montant(montant: number): void;
  methode(methode: PayingMethod): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteProduit {
  champ(cle: "name" | "reference" | "salePrice" | "costPrice", valeur: string | number): void;
  unite(unite: string): void;
  categorie(categoryId: string | null, nouvelle: string | null): void;
  stockInitial(quantite: number): void;
  enregistrer(): Promise<ResultatPilote>;
}
/** Fiches client et fournisseur (champs non contrôlés, écrits directement). */
export interface PiloteFiche {
  ouvrir(): void;
  champ(nom: "name" | "phone" | "address" | "note", valeur: string): void;
  enregistrer(): Promise<ResultatPilote>;
}

export interface Pilotes {
  vente: PiloteVente;
  "vente.encaisser": PiloteEncaisser;
  entree: PiloteEntree;
  sortie: PiloteSortie;
  commande: PiloteCommande;
  "commande.statut": PiloteStatutCommande;
  paiement: PilotePaiement;
  produit: PiloteProduit;
  client: PiloteFiche;
  fournisseur: PiloteFiche;
}
export type NomPilote = keyof Pilotes;

export type Etape =
  | { type: "ouvrir"; url: string; texte: string }
  | { type: "attendre"; pilote: NomPilote }
  | { type: "agir"; pilote: NomPilote; op: string; args: unknown[]; cible: string | null; texte: string }
  | { type: "confirmer"; cible: string; resume: string }
  | { type: "enregistrer"; pilote: NomPilote; op: string; args: unknown[]; cible: string }
  | { type: "montrer"; cible: string; texte: string };

type Operations<P> = { [K in keyof P]: P[K] extends (...args: never[]) => unknown ? K : never }[keyof P] & string;
type Arguments<P, K extends keyof P> = P[K] extends (...args: infer A) => unknown ? A : never;

/** Un geste sur l'écran : le doigt va sur `cible`, puis l'opération du pilote s'exécute. */
export function agir<N extends NomPilote, O extends Operations<Pilotes[N]>>(
  pilote: N,
  op: O,
  args: Arguments<Pilotes[N], O>,
  cible: string | null,
  texte: string,
): Etape {
  return { type: "agir", pilote, op, args: args as unknown[], cible, texte };
}

/** Le bouton final : n'est joué qu'après le « oui » du commerçant. */
export function finir<N extends NomPilote, O extends Operations<Pilotes[N]>>(pilote: N, op: O, args: Arguments<Pilotes[N], O>, cible: string): Etape {
  return { type: "enregistrer", pilote, op, args: args as unknown[], cible };
}
```

- [ ] **Étape 2 : `exemples.ts`** (une mission de chaque sorte, pour les tests des recettes et des cibles)

```ts
// src/components/assistant/pilote/exemples.ts
import type { Mission } from "@/lib/domain/assistant/mission";

const ligne = (productId: string, name: string, quantity: number, unitPrice: number | null) => ({
  productId,
  name,
  unit: "kg",
  quantity,
  unitPrice,
  lineTotal: unitPrice === null ? null : quantity * unitPrice,
  available: 40,
  short: false,
});

export const VENTE_WAVE: Mission = {
  type: "tache",
  tache: {
    action: "sale",
    lines: [ligne("p1", "Riz parfumé 1kg", 2, 550)],
    total: 1100,
    paymentMethod: "wave",
    amountReceived: 1100,
    customer: { id: "c1", name: "Awa Ndiaye" },
    payload: { items: [{ productId: "p1", quantity: 2, unitPrice: 550 }], paymentMethod: "wave", customerId: "c1", amountReceived: 1100 },
  },
};
export const VENTE_CREDIT: Mission = {
  type: "tache",
  tache: {
    action: "sale",
    lines: [ligne("p2", "Riz brisé", 1, 400)],
    total: 400,
    paymentMethod: "credit",
    amountReceived: 0,
    customer: { id: "c1", name: "Awa Ndiaye" },
    payload: { items: [{ productId: "p2", quantity: 1 }], paymentMethod: "credit", customerId: "c1", amountReceived: 0 },
  },
};
export const ENTREE: Mission = {
  type: "tache",
  tache: {
    action: "purchase",
    lines: [ligne("p1", "Riz parfumé 1kg", 10, 450)],
    total: 4500,
    supplier: { id: "s1", name: "Sedima" },
    payload: { items: [{ productId: "p1", quantity: 10, unitCost: 450 }], supplierId: "s1" },
  },
};
export const SORTIE: Mission = {
  type: "tache",
  tache: { action: "stock_exit", product: { id: "p3", name: "Huile Dinor 1L", unit: "l", available: 5 }, quantity: 1, kind: "loss", reason: "breakage", reasonLabel: "Casse", note: "" },
};
export const COMMANDE: Mission = {
  type: "tache",
  tache: {
    action: "order",
    lines: [ligne("p1", "Riz parfumé 1kg", 3, 600)],
    total: 2800,
    deliveryFee: 1000,
    channel: "whatsapp",
    customer: { id: "c1", name: "Awa Ndiaye" },
    payload: { customerId: "c1", channel: "whatsapp", items: [{ productId: "p1", quantity: 3 }], deliveryFee: 1000, deliveryAddress: "Parcelles U17", amountPaid: 1000, paymentMethod: "wave" },
  },
};
export const STATUT: Mission = {
  type: "tache",
  tache: { action: "order_status", order: { id: "o1", number: "CMD-0012", customerName: "Awa Ndiaye" }, from: "shipping", to: "delivered", label: "Marquer livrée" },
};
export const PAIEMENT: Mission = {
  type: "tache",
  tache: { action: "payment", amount: 5000, method: "cash", customer: { id: "c1", name: "Awa Ndiaye" }, payload: { customerId: "c1", amount: 5000, method: "cash" } },
};
export const PRODUIT: Mission = {
  type: "tache",
  tache: { action: "product", name: "Savon Madar", unit: "piece", salePrice: 250, costPrice: 180, category: { id: null, name: "Hygiène" }, initialStock: 24, reference: "" },
};
export const PRIX: Mission = { type: "tache", tache: { action: "price", product: { id: "p3", name: "Huile Dinor 1L" }, oldSalePrice: 1300, salePrice: 1400, costPrice: null } };
export const CLIENT: Mission = { type: "tache", tache: { action: "customer", name: "Fatou Sall", phone: "771234567", address: "" } };
export const FOURNISSEUR: Mission = { type: "tache", tache: { action: "supplier", name: "Senico", phone: "", note: "livre le lundi" } };

const ecran = (e: Extract<Mission, { type: "ecran" }>["ecran"]): Mission => ({ type: "ecran", ecran: e });

export const MISSIONS_EXEMPLES: Mission[] = [
  VENTE_WAVE,
  VENTE_CREDIT,
  ENTREE,
  SORTIE,
  COMMANDE,
  STATUT,
  PAIEMENT,
  PRODUIT,
  PRIX,
  CLIENT,
  FOURNISSEUR,
  ecran({ ecran: "tableau_de_bord", url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" }),
  ecran({ ecran: "rapports", url: "/rapports?periode=mois", cible: "rapports.chiffre", titre: "Rapports" }),
  ecran({ ecran: "ventes", url: "/ventes?periode=today", cible: "ventes.total", titre: "Ventes" }),
  ecran({ ecran: "stock_bas", url: "/produits?etat=bas", cible: "produits.liste", titre: "Stock bas" }),
  ecran({ ecran: "commandes", url: "/commandes", cible: "commandes.liste", titre: "Commandes" }),
  ecran({ ecran: "client", url: "/clients/c1", cible: "client.solde", titre: "Awa Ndiaye" }),
  ecran({ ecran: "produit", url: "/produits/p1", cible: "produit.stock", titre: "Riz parfumé 1kg" }),
];
```

- [ ] **Étape 3 : tests qui échouent** — `recettes.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { CLIENT, COMMANDE, ENTREE, FOURNISSEUR, PAIEMENT, PRIX, PRODUIT, SORTIE, STATUT, VENTE_CREDIT, VENTE_WAVE } from "./exemples";
import { etapesPour } from "./recettes";
import type { Etape } from "./types";

const plan = (etapes: Etape[]) =>
  etapes.map((e) => {
    switch (e.type) {
      case "ouvrir":
        return `ouvrir ${e.url}`;
      case "attendre":
        return `attendre ${e.pilote}`;
      case "agir":
      case "enregistrer":
        return `${e.type} ${e.pilote}.${e.op}(${JSON.stringify(e.args).slice(1, -1)})${e.cible ? ` @${e.cible}` : ""}`;
      case "confirmer":
      case "montrer":
        return `${e.type} @${e.cible}`;
    }
  });

describe("etapesPour — tâches", () => {
  it("plays a sale at the till: products, negotiated price, payment, customer, then asks", () => {
    expect(plan(etapesPour(VENTE_WAVE))).toEqual([
      "ouvrir /vendre",
      "attendre vente",
      "agir vente.vider()",
      'agir vente.ajouterProduit("p1",2) @vente.produit.p1',
      'agir vente.prixNegocie("p1",550) @vente.produit.p1',
      "agir vente.ouvrirEncaisser() @vente.encaisser",
      "attendre vente.encaisser",
      'agir vente.encaisser.paiement("wave") @vente.paiement.wave',
      "agir vente.encaisser.montantRecu(1100) @vente.montant-recu",
      'agir vente.encaisser.client("c1") @vente.client',
      "confirmer @vente.valider",
      "enregistrer vente.encaisser.enregistrer() @vente.valider",
    ]);
  });
  it("skips the amount received for a credit sale", () => {
    expect(plan(etapesPour(VENTE_CREDIT)).some((l) => l.includes("montantRecu"))).toBe(false);
  });
  it("puts the summary of the sale in the question", () => {
    const confirmer = etapesPour(VENTE_WAVE).find((e) => e.type === "confirmer");
    expect(confirmer?.type === "confirmer" && confirmer.resume).toContain("Wave · Awa Ndiaye");
  });
  it("plays a stock entry with its supplier", () => {
    expect(plan(etapesPour(ENTREE))).toEqual([
      "ouvrir /stock/entree",
      "attendre entree",
      "agir entree.vider()",
      'agir entree.ajouterLigne("p1",10,450) @entree.ajouter',
      'agir entree.fournisseur("s1") @entree.fournisseur',
      "confirmer @entree.valider",
      "enregistrer entree.enregistrer() @entree.valider",
    ]);
  });
  it("chooses the kind before the reason of a stock exit", () => {
    expect(plan(etapesPour(SORTIE))).toEqual([
      "ouvrir /stock/sortie?produit=p3",
      "attendre sortie",
      'agir sortie.produit("p3") @sortie.produit',
      'agir sortie.genre("loss") @sortie.genre.loss',
      'agir sortie.motif("breakage") @sortie.motif',
      "agir sortie.quantite(1) @sortie.quantite",
      "confirmer @sortie.valider",
      "enregistrer sortie.enregistrer() @sortie.valider",
    ]);
  });
  it("plays an order with delivery and deposit", () => {
    expect(plan(etapesPour(COMMANDE))).toEqual([
      "ouvrir /commandes/nouvelle",
      "attendre commande",
      "agir commande.vider()",
      'agir commande.client("c1") @commande.client',
      'agir commande.canal("whatsapp") @commande.canal.whatsapp',
      'agir commande.ajouterLigne("p1",3) @commande.ajouter',
      'agir commande.livraison("Parcelles U17",1000) @commande.livraison',
      'agir commande.acompte(1000,"wave") @commande.acompte',
      "confirmer @commande.valider",
      "enregistrer commande.enregistrer() @commande.valider",
    ]);
  });
  it("changes an order status after asking, without the « are you sure » window", () => {
    expect(plan(etapesPour(STATUT))).toEqual([
      "ouvrir /commandes/o1",
      "attendre commande.statut",
      "confirmer @commande.statut.delivered",
      'enregistrer commande.statut.changerStatut("delivered") @commande.statut.delivered',
    ]);
  });
  it("records a customer payment from the customer page", () => {
    expect(plan(etapesPour(PAIEMENT))).toEqual([
      "ouvrir /clients/c1",
      "attendre paiement",
      "agir paiement.ouvrir() @paiement.ouvrir",
      "agir paiement.montant(5000) @paiement.montant",
      'agir paiement.methode("cash") @paiement.methode.cash',
      "confirmer @paiement.valider",
      "enregistrer paiement.enregistrer() @paiement.valider",
    ]);
  });
  it("fills a new product with a new category", () => {
    expect(plan(etapesPour(PRODUIT))).toEqual([
      "ouvrir /produits/nouveau",
      "attendre produit",
      'agir produit.champ("name","Savon Madar") @produit.nom',
      'agir produit.unite("piece") @produit.unite',
      'agir produit.categorie(null,"Hygiène") @produit.categorie',
      'agir produit.champ("costPrice",180) @produit.prix-achat',
      'agir produit.champ("salePrice",250) @produit.prix-vente',
      "agir produit.stockInitial(24) @produit.stock-initial",
      "confirmer @produit.valider",
      "enregistrer produit.enregistrer() @produit.valider",
    ]);
  });
  it("changes a price on the edit page", () => {
    expect(plan(etapesPour(PRIX))).toEqual([
      "ouvrir /produits/p3/modifier",
      "attendre produit",
      'agir produit.champ("salePrice",1400) @produit.prix-vente',
      "confirmer @produit.valider",
      "enregistrer produit.enregistrer() @produit.valider",
    ]);
  });
  it("fills only the fields that were said on a customer or supplier card", () => {
    expect(plan(etapesPour(CLIENT))).toEqual([
      "ouvrir /clients",
      "attendre client",
      "agir client.ouvrir() @client.nouveau",
      'agir client.champ("name","Fatou Sall") @client.nom',
      'agir client.champ("phone","771234567") @client.telephone',
      "confirmer @client.valider",
      "enregistrer client.enregistrer() @client.valider",
    ]);
    expect(plan(etapesPour(FOURNISSEUR))).toContain('agir fournisseur.champ("note","livre le lundi") @fournisseur.note');
  });
});

describe("etapesPour — écrans", () => {
  it("opens the page and points at the figure", () => {
    expect(etapesPour({ type: "ecran", ecran: { ecran: "ventes", url: "/ventes?periode=today", cible: "ventes.total", titre: "Ventes" } })).toEqual([
      { type: "ouvrir", url: "/ventes?periode=today", texte: "J'ouvre Ventes…" },
      { type: "montrer", cible: "ventes.total", texte: "Ventes" },
    ]);
  });
});
```

- [ ] **Étape 4 : lancer** `npx vitest run src/components/assistant/pilote/recettes.test.ts` → échec (module absent).

- [ ] **Étape 5 : `recettes.ts`**

```ts
// src/components/assistant/pilote/recettes.ts
import type { Draft } from "@/lib/domain/assistant/drafts";
import type { Mission } from "@/lib/domain/assistant/mission";
import { formatFCFA } from "@/lib/format";
import { agir, finir, type Etape, type NomPilote } from "./types";

const PAIEMENT: Record<string, string> = { cash: "espèces", wave: "Wave", orange_money: "Orange Money", credit: "à crédit" };

const ouvrir = (url: string, texte: string): Etape => ({ type: "ouvrir", url, texte });
const attendre = (pilote: NomPilote): Etape => ({ type: "attendre", pilote });
const confirmer = (cible: string, resume: string): Etape => ({ type: "confirmer", cible, resume });
const si = (condition: unknown, ...etapes: Etape[]): Etape[] => (condition ? etapes : []);

/** Les étapes que le téléphone joue pour une mission ; le bouton final vient toujours après « confirmer ». */
export function etapesPour(mission: Mission): Etape[] {
  if (mission.type === "ecran") {
    return [ouvrir(mission.ecran.url, `J'ouvre ${mission.ecran.titre}…`), { type: "montrer", cible: mission.ecran.cible, texte: mission.ecran.titre }];
  }
  return etapesTache(mission.tache);
}

function fiche(pilote: "client" | "fournisseur", t: Extract<Draft, { action: "customer" | "supplier" }>): Etape[] {
  const champs: ["name" | "phone" | "address" | "note", string, string][] =
    t.action === "customer"
      ? [["name", t.name, "client.nom"], ["phone", t.phone, "client.telephone"], ["address", t.address, "client.adresse"]]
      : [["name", t.name, "fournisseur.nom"], ["phone", t.phone, "fournisseur.telephone"], ["note", t.note, "fournisseur.note"]];
  return [
    ouvrir(pilote === "client" ? "/clients" : "/fournisseurs", pilote === "client" ? "J'ouvre les clients…" : "J'ouvre les fournisseurs…"),
    attendre(pilote),
    { type: "agir", pilote, op: "ouvrir", args: [], cible: `${pilote}.nouveau`, texte: "J'ouvre une nouvelle fiche…" },
    ...champs.filter(([, valeur]) => valeur).map(([nom, valeur, cible]): Etape => ({ type: "agir", pilote, op: "champ", args: [nom, valeur], cible, texte: `${valeur}…` })),
    confirmer(`${pilote}.valider`, `${pilote === "client" ? "Nouveau client" : "Nouveau fournisseur"} : ${t.name}`),
    { type: "enregistrer", pilote, op: "enregistrer", args: [], cible: `${pilote}.valider` },
  ];
}

function etapesTache(t: Draft): Etape[] {
  switch (t.action) {
    case "sale":
      return [
        ouvrir("/vendre", "J'ouvre la caisse…"),
        attendre("vente"),
        agir("vente", "vider", [], null, "Je prépare un panier vide…"),
        ...t.lines.map((l) => agir("vente", "ajouterProduit", [l.productId, l.quantity], `vente.produit.${l.productId}`, `J'ajoute ${l.quantity} × ${l.name}…`)),
        ...t.payload.items.flatMap((i) =>
          i.unitPrice === undefined ? [] : [agir("vente", "prixNegocie", [i.productId, i.unitPrice], `vente.produit.${i.productId}`, `Prix négocié : ${formatFCFA(i.unitPrice)}…`)],
        ),
        agir("vente", "ouvrirEncaisser", [], "vente.encaisser", "J'ouvre l'encaissement…"),
        attendre("vente.encaisser"),
        agir("vente.encaisser", "paiement", [t.paymentMethod], `vente.paiement.${t.paymentMethod}`, `Paiement : ${PAIEMENT[t.paymentMethod]}…`),
        ...si(t.paymentMethod !== "credit", agir("vente.encaisser", "montantRecu", [t.amountReceived], "vente.montant-recu", `Montant reçu : ${formatFCFA(t.amountReceived)}…`)),
        ...si(t.customer, agir("vente.encaisser", "client", [t.customer?.id ?? null], "vente.client", `Client : ${t.customer?.name}…`)),
        confirmer("vente.valider", `Vente de ${formatFCFA(t.total)} · ${PAIEMENT[t.paymentMethod]}${t.customer ? ` · ${t.customer.name}` : ""}`),
        finir("vente.encaisser", "enregistrer", [], "vente.valider"),
      ];
    case "purchase":
      return [
        ouvrir("/stock/entree", "J'ouvre l'entrée de stock…"),
        attendre("entree"),
        agir("entree", "vider", [], null, "Je prépare une entrée vide…"),
        ...t.lines.map((l, i) =>
          agir("entree", "ajouterLigne", [l.productId, l.quantity, t.payload.items[i]?.unitCost ?? null], "entree.ajouter", `J'ajoute ${l.quantity} × ${l.name}…`),
        ),
        ...si(t.supplier, agir("entree", "fournisseur", [t.supplier?.id ?? null], "entree.fournisseur", `Fournisseur : ${t.supplier?.name}…`)),
        confirmer("entree.valider", `Entrée de ${t.lines.length} produit${t.lines.length > 1 ? "s" : ""}${t.total !== null ? ` · ${formatFCFA(t.total)}` : ""}`),
        finir("entree", "enregistrer", [], "entree.valider"),
      ];
    case "stock_exit":
      return [
        ouvrir(`/stock/sortie?produit=${t.product.id}`, "J'ouvre la sortie de stock…"),
        attendre("sortie"),
        agir("sortie", "produit", [t.product.id], "sortie.produit", `Produit : ${t.product.name}…`),
        agir("sortie", "genre", [t.kind], `sortie.genre.${t.kind}`, t.kind === "loss" ? "C'est une perte…" : "C'est une sortie…"),
        agir("sortie", "motif", [t.reason], "sortie.motif", `Motif : ${t.reasonLabel}…`),
        agir("sortie", "quantite", [t.quantity], "sortie.quantite", `Quantité : ${t.quantity}…`),
        ...si(t.note, agir("sortie", "note", [t.note], "sortie.note", "J'ajoute la note…")),
        confirmer("sortie.valider", `${t.kind === "loss" ? "Perte" : "Sortie"} : ${t.quantity} × ${t.product.name} (${t.reasonLabel})`),
        finir("sortie", "enregistrer", [], "sortie.valider"),
      ];
    case "order":
      return [
        ouvrir("/commandes/nouvelle", "J'ouvre une nouvelle commande…"),
        attendre("commande"),
        agir("commande", "vider", [], null, "Je prépare une commande vide…"),
        agir("commande", "client", [t.customer.id], "commande.client", `Client : ${t.customer.name}…`),
        agir("commande", "canal", [t.channel], `commande.canal.${t.channel}`, "Canal de la commande…"),
        ...t.lines.map((l) => agir("commande", "ajouterLigne", [l.productId, l.quantity], "commande.ajouter", `J'ajoute ${l.quantity} × ${l.name}…`)),
        ...si(t.payload.deliveryAddress || t.deliveryFee, agir("commande", "livraison", [t.payload.deliveryAddress, t.deliveryFee], "commande.livraison", "Livraison…")),
        ...si(t.payload.amountPaid > 0, agir("commande", "acompte", [t.payload.amountPaid, t.payload.paymentMethod], "commande.acompte", `Acompte : ${formatFCFA(t.payload.amountPaid)}…`)),
        confirmer("commande.valider", `Commande de ${t.customer.name} · ${formatFCFA(t.total)}`),
        finir("commande", "enregistrer", [], "commande.valider"),
      ];
    case "order_status":
      return [
        ouvrir(`/commandes/${t.order.id}`, `J'ouvre la commande ${t.order.number}…`),
        attendre("commande.statut"),
        confirmer(`commande.statut.${t.to}`, `Commande ${t.order.number} (${t.order.customerName}) : ${t.label}`),
        finir("commande.statut", "changerStatut", [t.to], `commande.statut.${t.to}`),
      ];
    case "payment":
      return [
        ouvrir(`/clients/${t.customer.id}`, `J'ouvre la fiche de ${t.customer.name}…`),
        attendre("paiement"),
        agir("paiement", "ouvrir", [], "paiement.ouvrir", "J'ouvre le remboursement…"),
        agir("paiement", "montant", [t.amount], "paiement.montant", `Montant : ${formatFCFA(t.amount)}…`),
        agir("paiement", "methode", [t.method], `paiement.methode.${t.method}`, `Paiement : ${PAIEMENT[t.method]}…`),
        confirmer("paiement.valider", `Remboursement de ${t.customer.name} : ${formatFCFA(t.amount)} · ${PAIEMENT[t.method]}`),
        finir("paiement", "enregistrer", [], "paiement.valider"),
      ];
    case "product":
      return [
        ouvrir("/produits/nouveau", "J'ouvre un nouveau produit…"),
        attendre("produit"),
        agir("produit", "champ", ["name", t.name], "produit.nom", `Nom : ${t.name}…`),
        agir("produit", "unite", [t.unit], "produit.unite", "Unité de vente…"),
        ...si(t.category, agir("produit", "categorie", [t.category?.id ?? null, t.category?.id ? null : (t.category?.name ?? null)], "produit.categorie", `Catégorie : ${t.category?.name}…`)),
        ...si(t.costPrice !== null, agir("produit", "champ", ["costPrice", t.costPrice ?? 0], "produit.prix-achat", `Prix d'achat : ${formatFCFA(t.costPrice ?? 0)}…`)),
        agir("produit", "champ", ["salePrice", t.salePrice], "produit.prix-vente", `Prix de vente : ${formatFCFA(t.salePrice)}…`),
        ...si(t.reference, agir("produit", "champ", ["reference", t.reference], "produit.reference", "Référence…")),
        ...si(t.initialStock > 0, agir("produit", "stockInitial", [t.initialStock], "produit.stock-initial", `Stock de départ : ${t.initialStock}…`)),
        confirmer("produit.valider", `Nouveau produit : ${t.name} · ${formatFCFA(t.salePrice)}`),
        finir("produit", "enregistrer", [], "produit.valider"),
      ];
    case "price":
      return [
        ouvrir(`/produits/${t.product.id}/modifier`, `J'ouvre la fiche de ${t.product.name}…`),
        attendre("produit"),
        ...si(t.salePrice !== null, agir("produit", "champ", ["salePrice", t.salePrice ?? 0], "produit.prix-vente", `Nouveau prix : ${formatFCFA(t.salePrice ?? 0)}…`)),
        ...si(t.costPrice !== null, agir("produit", "champ", ["costPrice", t.costPrice ?? 0], "produit.prix-achat", `Prix d'achat : ${formatFCFA(t.costPrice ?? 0)}…`)),
        confirmer("produit.valider", `${t.product.name} : ${t.salePrice !== null ? `${formatFCFA(t.oldSalePrice)} → ${formatFCFA(t.salePrice)}` : "nouveau prix d'achat"}`),
        finir("produit", "enregistrer", [], "produit.valider"),
      ];
    case "customer":
      return fiche("client", t);
    case "supplier":
      return fiche("fournisseur", t);
  }
}
```

- [ ] **Étape 6 : relancer** (passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 7 : commit**

```bash
git add src/components/assistant/pilote/types.ts src/components/assistant/pilote/exemples.ts src/components/assistant/pilote/recettes.ts src/components/assistant/pilote/recettes.test.ts
git commit -m "feat(assistant): recettes du mode pilote pour les dix tâches et les écrans"
```

---

### Tâche 7 : le joueur

**Fichiers :** créer `src/components/assistant/pilote/moteur.ts` ; tests `src/components/assistant/pilote/moteur.test.ts`.

**Interfaces :**
- Consomme : `Etape`, `NomPilote`, `Pilotes`, `ResultatPilote` (tâche 6) ; `ClePhrase` (tâche 5) ; `Mission`.
- Produit : `Scene`, `ReponseAccord`, `FinMission`, `DELAIS`, `jouer(etapes, scene, signal): Promise<FinMission>`.

- [ ] **Étape 1 : tests qui échouent** — `moteur.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import type { Mission } from "@/lib/domain/assistant/mission";
import { jouer, type ReponseAccord, type Scene } from "./moteur";
import type { Etape, NomPilote } from "./types";

function fausseScene(o: { pilotes?: Partial<Record<NomPilote, unknown>>; reponse?: ReponseAccord; navigation?: boolean; cibles?: boolean; avantDemande?: () => void } = {}) {
  const journal: string[] = [];
  const scene: Scene = {
    ouvrir: async (url) => {
      journal.push(`ouvrir ${url}`);
      return o.navigation ?? true;
    },
    pilote: async (nom) => (o.pilotes?.[nom] ?? null) as never,
    pointer: async (cible) => {
      journal.push(`doigt ${cible}`);
      return o.cibles ?? true;
    },
    pause: async () => {},
    statut: () => {},
    dire: (cle) => journal.push(`dire ${cle}`),
    demander: async (resume) => {
      journal.push(`demander ${resume}`);
      o.avantDemande?.();
      return o.reponse ?? { type: "oui" };
    },
  };
  return { scene, journal };
}

const ETAPES: Etape[] = [
  { type: "ouvrir", url: "/stock/entree", texte: "J'ouvre" },
  { type: "attendre", pilote: "entree" },
  { type: "agir", pilote: "entree", op: "ajouterLigne", args: ["p1", 10, null], cible: "entree.ajouter", texte: "J'ajoute" },
  { type: "confirmer", cible: "entree.valider", resume: "Entrée de 1 produit" },
  { type: "enregistrer", pilote: "entree", op: "enregistrer", args: [], cible: "entree.valider" },
];
const entree = (resultat = { ok: true, message: "Entrée de stock enregistrée" }) => ({ ajouterLigne: vi.fn(), enregistrer: vi.fn(async () => resultat) });
const signal = () => new AbortController().signal;

describe("jouer", () => {
  it("plays the gestures, asks, then presses the final button after yes", async () => {
    const pilote = entree();
    const { scene, journal } = fausseScene({ pilotes: { entree: pilote } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "enregistre", message: "Entrée de stock enregistrée" });
    expect(pilote.ajouterLigne).toHaveBeenCalledWith("p1", 10, null);
    expect(journal).toEqual([
      "ouvrir /stock/entree",
      "doigt entree.ajouter",
      "doigt entree.valider",
      "dire je-peux-enregistrer",
      "demander Entrée de 1 produit",
      "doigt entree.valider",
      "dire enregistre",
    ]);
  });
  it("leaves the screen filled on no", async () => {
    const pilote = entree();
    const { scene, journal } = fausseScene({ pilotes: { entree: pilote }, reponse: { type: "non" } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "laisse" });
    expect(pilote.enregistrer).not.toHaveBeenCalled();
    expect(journal.at(-1)).toBe("dire laisse");
  });
  it("hands a spoken correction back to the caller", async () => {
    const mission = { type: "ecran", ecran: { ecran: "commandes", url: "/commandes", cible: "commandes.liste", titre: "Commandes" } } as Mission;
    const { scene } = fausseScene({ pilotes: { entree: entree() }, reponse: { type: "correction", mission } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "corrige", mission });
  });
  it("stops when the screen never answers or the page does not open", async () => {
    await expect(jouer(ETAPES, fausseScene().scene, signal())).resolves.toEqual({ etat: "arrete", raison: "ecran" });
    await expect(jouer(ETAPES, fausseScene({ pilotes: { entree: entree() }, navigation: false }).scene, signal())).resolves.toEqual({ etat: "arrete", raison: "ecran" });
  });
  it("keeps going without the finger when a target is missing", async () => {
    const pilote = entree();
    await expect(jouer(ETAPES, fausseScene({ pilotes: { entree: pilote }, cibles: false }).scene, signal())).resolves.toMatchObject({ etat: "enregistre" });
    expect(pilote.ajouterLigne).toHaveBeenCalled();
  });
  it("reports the refusal of the action and says there is a problem", async () => {
    const { scene, journal } = fausseScene({ pilotes: { entree: entree({ ok: false, message: "Stock insuffisant" }) } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "refuse", message: "Stock insuffisant" });
    expect(journal.at(-1)).toBe("dire souci");
  });
  it("turns a crash of the screen into a refusal", async () => {
    const pilote = {
      ajouterLigne: vi.fn(),
      enregistrer: vi.fn(async () => {
        throw new Error("boum");
      }),
    };
    await expect(jouer(ETAPES, fausseScene({ pilotes: { entree: pilote } }).scene, signal())).resolves.toEqual({
      etat: "refuse",
      message: "Une erreur est survenue à l'enregistrement.",
    });
  });
  it("stops at once when the user takes back control", async () => {
    const controle = new AbortController();
    const pilote = entree();
    const { scene } = fausseScene({ pilotes: { entree: pilote }, avantDemande: () => controle.abort() });
    await expect(jouer(ETAPES, scene, controle.signal)).resolves.toEqual({ etat: "arrete", raison: "reprise" });
    expect(pilote.enregistrer).not.toHaveBeenCalled();
  });
  it("ends a screen mission with « montre »", async () => {
    const { scene, journal } = fausseScene();
    const etapes: Etape[] = [
      { type: "ouvrir", url: "/commandes", texte: "J'ouvre" },
      { type: "montrer", cible: "commandes.liste", texte: "Commandes" },
    ];
    await expect(jouer(etapes, scene, signal())).resolves.toEqual({ etat: "montre" });
    expect(journal).toEqual(["ouvrir /commandes", "doigt commandes.liste"]);
  });
});
```

- [ ] **Étape 2 : lancer** `npx vitest run src/components/assistant/pilote/moteur.test.ts` → échec.

- [ ] **Étape 3 : `moteur.ts`**

```ts
// src/components/assistant/pilote/moteur.ts
import type { Mission } from "@/lib/domain/assistant/mission";
import type { ClePhrase } from "@/lib/domain/assistant/phrases";
import type { Etape, NomPilote, Pilotes, ResultatPilote } from "./types";

/** Ce que le joueur demande au téléphone (le vrai écran, ou des faux dans les tests). */
export interface Scene {
  /** Ouvre la page ; false si elle ne s'ouvre pas à temps. */
  ouvrir(url: string): Promise<boolean>;
  pilote<N extends NomPilote>(nom: N, delaiMs: number): Promise<Pilotes[N] | null>;
  /** Pose le doigt sur la cible ; false si elle n'apparaît pas (le geste se fait quand même). */
  pointer(cible: string, delaiMs: number): Promise<boolean>;
  pause(ms: number): Promise<void>;
  statut(texte: string): void;
  dire(cle: ClePhrase): void;
  demander(resume: string, signal: AbortSignal): Promise<ReponseAccord>;
}

export type ReponseAccord = { type: "oui" } | { type: "non" } | { type: "correction"; mission: Mission };

export type FinMission =
  | { etat: "enregistre"; message: string }
  | { etat: "refuse"; message: string }
  | { etat: "laisse" }
  | { etat: "montre" }
  | { etat: "corrige"; mission: Mission }
  | { etat: "arrete"; raison: "reprise" | "ecran" };

export const DELAIS = { pilote: 8_000, cible: 3_000, pas: 450 } as const;

function appeler(pilote: unknown, op: string, args: unknown[]): unknown {
  const fonction = (pilote as Record<string, unknown>)[op];
  if (typeof fonction !== "function") throw new Error(`Opération inconnue : ${op}`);
  return (fonction as (...a: unknown[]) => unknown)(...args);
}

/** Joue les étapes une à une. Rien n'est enregistré avant un « oui ». */
export async function jouer(etapes: readonly Etape[], scene: Scene, signal: AbortSignal): Promise<FinMission> {
  const reprise: FinMission = { etat: "arrete", raison: "reprise" };
  const ecran: FinMission = { etat: "arrete", raison: "ecran" };
  for (const etape of etapes) {
    if (signal.aborted) return reprise;
    switch (etape.type) {
      case "ouvrir":
        scene.statut(etape.texte);
        if (!(await scene.ouvrir(etape.url))) return ecran;
        break;
      case "attendre":
        if (!(await scene.pilote(etape.pilote, DELAIS.pilote))) return ecran;
        break;
      case "agir": {
        const pilote = await scene.pilote(etape.pilote, DELAIS.pilote);
        if (!pilote) return ecran;
        scene.statut(etape.texte);
        if (etape.cible) await scene.pointer(etape.cible, DELAIS.cible);
        if (signal.aborted) return reprise;
        appeler(pilote, etape.op, etape.args);
        await scene.pause(DELAIS.pas);
        break;
      }
      case "montrer":
        scene.statut(etape.texte);
        await scene.pointer(etape.cible, DELAIS.cible);
        break;
      case "confirmer": {
        await scene.pointer(etape.cible, DELAIS.cible);
        if (signal.aborted) return reprise;
        scene.dire("je-peux-enregistrer");
        const reponse = await scene.demander(etape.resume, signal);
        if (signal.aborted) return reprise;
        if (reponse.type === "non") {
          scene.dire("laisse");
          return { etat: "laisse" };
        }
        if (reponse.type === "correction") return { etat: "corrige", mission: reponse.mission };
        break;
      }
      case "enregistrer": {
        const pilote = await scene.pilote(etape.pilote, DELAIS.pilote);
        if (!pilote) return ecran;
        scene.statut("J'enregistre…");
        await scene.pointer(etape.cible, DELAIS.cible);
        let resultat: ResultatPilote;
        try {
          resultat = await (appeler(pilote, etape.op, etape.args) as Promise<ResultatPilote>);
        } catch {
          resultat = { ok: false, message: "Une erreur est survenue à l'enregistrement." };
        }
        scene.dire(resultat.ok ? "enregistre" : "souci");
        return resultat.ok ? { etat: "enregistre", message: resultat.message } : { etat: "refuse", message: resultat.message };
      }
    }
  }
  return { etat: "montre" };
}
```

- [ ] **Étape 4 : relancer** (passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 5 : commit**

```bash
git add src/components/assistant/pilote/moteur.ts src/components/assistant/pilote/moteur.test.ts
git commit -m "feat(assistant): joueur du mode pilote (gestes, accord, arrêt, résultat)"
```

---

### Tâche 8 : registre des pilotes et crochet des écrans

**Fichiers :**
- Créer : `src/components/assistant/pilote/registre.ts`, `src/components/assistant/pilote/use-pilote-ecran.ts`
- Tests : `src/components/assistant/pilote/registre.test.ts`

**Interfaces :**
- Produit : `enregistrerPilote(nom, pilote): () => void`, `lirePilote(nom)`, `attendrePilote(nom, delaiMs)`,
  `viderRegistre()` (tests) ; `usePiloteEcran(nom, pilote, actif = true): void`.

- [ ] **Étape 1 : tests qui échouent** — `registre.test.ts` :

```ts
import { afterEach, describe, expect, it } from "vitest";
import { attendrePilote, enregistrerPilote, lirePilote, viderRegistre } from "./registre";
import type { PiloteFiche } from "./types";

const fiche = (): PiloteFiche => ({ ouvrir: () => {}, champ: () => {}, enregistrer: async () => ({ ok: true, message: "ok" }) });

afterEach(viderRegistre);

describe("registre des pilotes", () => {
  it("returns the registered pilot, then nothing once its screen is gone", () => {
    const p = fiche();
    const retirer = enregistrerPilote("client", p);
    expect(lirePilote("client")).toBe(p);
    retirer();
    expect(lirePilote("client")).toBeNull();
  });
  it("keeps the newest screen when an old one unmounts late", () => {
    const ancien = fiche();
    const nouveau = fiche();
    const retirerAncien = enregistrerPilote("client", ancien);
    enregistrerPilote("client", nouveau);
    retirerAncien();
    expect(lirePilote("client")).toBe(nouveau);
  });
  it("waits for a screen that appears later", async () => {
    const p = fiche();
    setTimeout(() => enregistrerPilote("fournisseur", p), 10);
    await expect(attendrePilote("fournisseur", 500)).resolves.toBe(p);
  });
  it("gives up after the delay", async () => {
    await expect(attendrePilote("vente", 20)).resolves.toBeNull();
  });
});
```

- [ ] **Étape 2 : lancer** `npx vitest run src/components/assistant/pilote/registre.test.ts` → échec.

- [ ] **Étape 3 : `registre.ts`**

```ts
// src/components/assistant/pilote/registre.ts
import type { NomPilote, Pilotes } from "./types";

/** Pilotes des écrans affichés, par nom (un seul écran de chaque sorte à la fois). */
const pilotes = new Map<NomPilote, unknown>();
const ecouteurs = new Set<() => void>();

/** Enregistre le pilote d'un écran ; la fonction rendue le retire (seulement s'il n'a pas été remplacé). */
export function enregistrerPilote<N extends NomPilote>(nom: N, pilote: Pilotes[N]): () => void {
  pilotes.set(nom, pilote);
  for (const ecouter of [...ecouteurs]) ecouter();
  return () => {
    if (pilotes.get(nom) === pilote) pilotes.delete(nom);
  };
}

export function lirePilote<N extends NomPilote>(nom: N): Pilotes[N] | null {
  return (pilotes.get(nom) as Pilotes[N] | undefined) ?? null;
}

/** Le pilote de l'écran, dès qu'il apparaît, ou null après `delaiMs`. */
export function attendrePilote<N extends NomPilote>(nom: N, delaiMs: number): Promise<Pilotes[N] | null> {
  const deja = lirePilote(nom);
  if (deja) return Promise.resolve(deja);
  return new Promise((resolve) => {
    const finir = (valeur: Pilotes[N] | null) => {
      clearTimeout(minuterie);
      ecouteurs.delete(verifier);
      resolve(valeur);
    };
    const verifier = () => {
      const pilote = lirePilote(nom);
      if (pilote) finir(pilote);
    };
    const minuterie = setTimeout(() => finir(null), delaiMs);
    ecouteurs.add(verifier);
  });
}

/** Pour les tests. */
export function viderRegistre(): void {
  pilotes.clear();
  ecouteurs.clear();
}
```

- [ ] **Étape 4 : `use-pilote-ecran.ts`**

```ts
// src/components/assistant/pilote/use-pilote-ecran.ts
"use client";

import { useEffect, useRef } from "react";
import { enregistrerPilote } from "./registre";
import type { NomPilote, Pilotes } from "./types";

/**
 * Branche l'écran sur l'assistant pendant qu'il est affiché. Les opérations appellent toujours la version la plus
 * récente des fonctions de l'écran (donc son état à jour), sans réenregistrer le pilote à chaque rendu.
 */
export function usePiloteEcran<N extends NomPilote>(nom: N, pilote: Pilotes[N], actif = true): void {
  const courant = useRef(pilote);
  useEffect(() => {
    courant.current = pilote;
  });
  useEffect(() => {
    if (!actif) return;
    const relais = Object.fromEntries(
      Object.keys(courant.current as object).map((op) => [
        op,
        (...args: unknown[]) => (courant.current as unknown as Record<string, (...a: unknown[]) => unknown>)[op](...args),
      ]),
    ) as unknown as Pilotes[N];
    return enregistrerPilote(nom, relais);
  }, [nom, actif]);
}
```

- [ ] **Étape 5 : relancer** (passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 6 : commit**

```bash
git add src/components/assistant/pilote/registre.ts src/components/assistant/pilote/registre.test.ts src/components/assistant/pilote/use-pilote-ecran.ts
git commit -m "feat(assistant): registre des pilotes d'écran"
```

---

### Tâche 9 : voix du téléphone et appel du serveur

**Fichiers :** créer `src/components/assistant/voix.ts` ; modifier `src/components/assistant/api.ts`.

**Interfaces :**
- Consomme : `PHRASES`, `fichierPhrase`, `decouperPhrases`, `ClePhrase` (tâche 5) ; `Lang`.
- Produit : `creerVoix(): Voix` avec `phrase(cle, langue): Promise<void>`, `dire(texte, langue): Promise<ResultatVoix>`,
  `couper(): void` ; `ResultatVoix = { etat: "ok" } | { etat: "indisponible" } | { etat: "bloque"; rejouer: () => void }` ;
  `askAssistant(audio, history, attente?: string | null)` ; `reveillerVoix(): Promise<{ configuree: boolean; pret: boolean } | null>`.

(Code de navigateur : pas de test unitaire ; le découpage en phrases est testé à la tâche 5.)

- [ ] **Étape 1 : `api.ts`** — `askAssistant` reçoit `attente`, et `reveillerVoix` s'ajoute :

```ts
export async function askAssistant(audio: string, history: HistoryItem[], attente: string | null = null): Promise<AskResult> {
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ audio, history, ...(attente ? { attente } : {}) }),
    });
    const data = (await res.json().catch(() => null)) as (AssistantReply & { error?: string }) | null;
    if (!res.ok || !data) return { ok: false, error: data?.error ?? "L'assistant ne répond pas. Réessaie." };
    return { ok: true, reply: data };
  } catch {
    return { ok: false, error: "Pas de connexion internet." };
  }
}

/** Réveille la voix wolof (le serveur gratuit s'endort) ; on n'attend pas sa réponse pour continuer. */
export async function reveillerVoix(): Promise<{ configuree: boolean; pret: boolean } | null> {
  try {
    const res = await fetch("/api/assistant/voix", { method: "GET" });
    return res.ok ? ((await res.json()) as { configuree: boolean; pret: boolean }) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Étape 2 : `voix.ts`**

```ts
// src/components/assistant/voix.ts
import { decouperPhrases, fichierPhrase, PHRASES, type ClePhrase } from "@/lib/domain/assistant/phrases";
import type { Lang } from "@/lib/domain/assistant/tools";
import { wolofVoice } from "./api";

export type ResultatVoix = { etat: "ok" } | { etat: "indisponible" } | { etat: "bloque"; rejouer: () => void };

export interface Voix {
  /** Phrase prête du parcours : fichier Anta en wolof, voix du téléphone en français. */
  phrase(cle: ClePhrase, langue: Lang): Promise<void>;
  /** Réponse libre ; en wolof, phrase par phrase (la suivante se prépare pendant la lecture). */
  dire(texte: string, langue: Lang): Promise<ResultatVoix>;
  couper(): void;
}

function jouerAudio(audio: HTMLAudioElement): Promise<"fin" | "bloque"> {
  return new Promise((resolve) => {
    audio.onended = () => resolve("fin");
    audio.onerror = () => resolve("fin");
    audio.play().catch(() => resolve("bloque"));
  });
}

function parlerFrancais(texte: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = "fr-FR";
    const voix = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
    if (voix) enonce.voice = voix;
    enonce.onend = () => resolve();
    enonce.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(enonce);
  });
}

export function creerVoix(): Voix {
  let courant: HTMLAudioElement | null = null;
  /** Chaque nouvelle parole interrompt la précédente. */
  let generation = 0;

  function couper() {
    generation++;
    courant?.pause();
    courant = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  return {
    couper,
    async phrase(cle, langue) {
      couper();
      if (langue === "fr") return parlerFrancais(PHRASES[cle].fr);
      const audio = new Audio(fichierPhrase(cle));
      courant = audio;
      await jouerAudio(audio);
    },
    async dire(texte, langue) {
      couper();
      const moi = generation;
      if (langue === "fr") {
        await parlerFrancais(texte);
        return { etat: "ok" };
      }
      const phrases = decouperPhrases(texte);
      let prochaine = phrases.length ? wolofVoice(phrases[0]) : null;
      for (let i = 0; i < phrases.length && prochaine; i++) {
        const son = await prochaine;
        if (moi !== generation) return { etat: "ok" };
        if (!son) return i === 0 ? { etat: "indisponible" } : { etat: "ok" };
        prochaine = i + 1 < phrases.length ? wolofVoice(phrases[i + 1]) : null;
        const url = URL.createObjectURL(son);
        const audio = new Audio(url);
        courant = audio;
        if ((await jouerAudio(audio)) === "bloque") return { etat: "bloque", rejouer: () => void new Audio(url).play() };
        if (moi !== generation) return { etat: "ok" };
      }
      return { etat: "ok" };
    },
  };
}
```

- [ ] **Étape 3 : vérifier** `npm run typecheck`, `npm run lint`.

- [ ] **Étape 4 : commit**

```bash
git add src/components/assistant/voix.ts src/components/assistant/api.ts
git commit -m "feat(assistant): voix du téléphone (phrases prêtes, wolof phrase par phrase) et réveil"
```

---

### Tâche 10 : doigt, scène et garde des fenêtres

**Fichiers :**
- Créer : `src/components/ui/garde-bulle.ts`, `src/components/assistant/pilote/scene-dom.ts`,
  `src/components/assistant/pilote/doigt.tsx`
- Modifier : `src/components/ui/dialog.tsx` (`DialogContent`), `src/components/ui/sheet.tsx` (`SheetContent`)
- Tests : `src/components/ui/garde-bulle.test.ts`

**Interfaces :**
- Consomme : `Scene`, `DELAIS`, `ReponseAccord` (tâche 7) ; `attendrePilote` (tâche 8) ; `ClePhrase`.
- Produit : `ATTRIBUT_BULLE`, `dansLaBulle(event)`, `garderBulle(suite?)` ; `PositionDoigt`, `trouverCible(cible)`,
  `creerScene(deps): Scene` ; `<Doigt position touche />`.

(La fenêtre `AlertDialog` de Radix n'est jamais ouverte par l'assistant et ne se ferme pas sur un toucher extérieur :
elle ne change pas.)

- [ ] **Étape 1 : test qui échoue** — `garde-bulle.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { dansLaBulle, garderBulle } from "./garde-bulle";

const element = (dedans: boolean) => ({ closest: (s: string) => (dedans && s === "[data-assistant-bulle]" ? {} : null) });

describe("garde de la bulle", () => {
  it("recognises a touch on the assistant bubble, directly or through Radix", () => {
    expect(dansLaBulle({ target: element(true) as never })).toBe(true);
    expect(dansLaBulle({ target: null, detail: { originalEvent: { target: element(true) as never } } })).toBe(true);
    expect(dansLaBulle({ target: element(false) as never })).toBe(false);
    expect(dansLaBulle({ target: null })).toBe(false);
  });
  it("keeps the window open for the bubble and calls the screen's handler otherwise", () => {
    const suite = vi.fn();
    const garde = garderBulle(suite);
    const dedans = { target: element(true), preventDefault: vi.fn() };
    garde(dedans as never);
    expect(dedans.preventDefault).toHaveBeenCalled();
    expect(suite).not.toHaveBeenCalled();
    const dehors = { target: element(false), preventDefault: vi.fn() };
    garde(dehors as never);
    expect(dehors.preventDefault).not.toHaveBeenCalled();
    expect(suite).toHaveBeenCalledWith(dehors);
  });
});
```

- [ ] **Étape 2 : lancer** `npx vitest run src/components/ui/garde-bulle.test.ts` → échec.

- [ ] **Étape 3 : `garde-bulle.ts`**

```ts
// src/components/ui/garde-bulle.ts
/** Posé sur la bulle de l'assistant : la toucher ne ferme pas la fenêtre ouverte (encaissement, paiement…). */
export const ATTRIBUT_BULLE = "data-assistant-bulle";

interface Evenement {
  target: EventTarget | null;
  detail?: { originalEvent?: { target: EventTarget | null } };
}

export function dansLaBulle(event: Evenement): boolean {
  const cible = (event.detail?.originalEvent?.target ?? event.target) as { closest?: (selecteur: string) => unknown } | null;
  return typeof cible?.closest === "function" && cible.closest(`[${ATTRIBUT_BULLE}]`) != null;
}

/** Enveloppe `onPointerDownOutside` / `onInteractOutside` d'une fenêtre Radix. */
export function garderBulle<E extends { preventDefault(): void }>(suite?: (event: E) => void): (event: E) => void {
  return (event) => {
    if (dansLaBulle(event as unknown as Evenement)) {
      event.preventDefault();
      return;
    }
    suite?.(event);
  };
}
```

- [ ] **Étape 4 : fenêtres** — dans `ui/dialog.tsx`, `DialogContent` récupère `onPointerDownOutside` et
  `onInteractOutside` dans ses props (à côté de `className`, `children`, `showCloseButton`) et les passe enveloppés à
  `DialogPrimitive.Content` :

```tsx
        onPointerDownOutside={garderBulle(onPointerDownOutside)}
        onInteractOutside={garderBulle(onInteractOutside)}
```

  Même changement dans `ui/sheet.tsx` (`SheetContent` → `SheetPrimitive.Content`). Importer `garderBulle` depuis
  `./garde-bulle`. Ne rien changer d'autre dans ces composants.

- [ ] **Étape 5 : `scene-dom.ts`**

```ts
// src/components/assistant/pilote/scene-dom.ts
import type { ClePhrase } from "@/lib/domain/assistant/phrases";
import { DELAIS, type ReponseAccord, type Scene } from "./moteur";
import { attendrePilote } from "./registre";

export interface PositionDoigt {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function attendreQue<T>(lire: () => T | null, delaiMs: number): Promise<T | null> {
  const fin = Date.now() + delaiMs;
  for (;;) {
    const valeur = lire();
    if (valeur) return valeur;
    if (Date.now() >= fin) return null;
    await attendre(100);
  }
}

/** Le premier élément visible qui porte la cible (une même cible peut exister en version téléphone et ordinateur). */
export function trouverCible(cible: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-assistant="${CSS.escape(cible)}"]`)) {
    if (element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden") return element;
  }
  return null;
}

export function creerScene(deps: {
  router: { push(url: string): void };
  deplacerDoigt(position: PositionDoigt | null): void;
  toucher(): void;
  statut(texte: string): void;
  dire(cle: ClePhrase): void;
  demander(resume: string, signal: AbortSignal): Promise<ReponseAccord>;
}): Scene {
  return {
    async ouvrir(url) {
      const cible = new URL(url, window.location.origin);
      if (cible.pathname === window.location.pathname && cible.search === window.location.search) return true;
      deps.deplacerDoigt(null);
      deps.router.push(url);
      const arrive = await attendreQue(() => (window.location.pathname === cible.pathname ? true : null), DELAIS.pilote);
      // Le nouvel écran enregistre son pilote juste après son affichage
      if (arrive) await attendre(300);
      return Boolean(arrive);
    },
    pilote: (nom, delaiMs) => attendrePilote(nom, delaiMs),
    async pointer(cible, delaiMs) {
      const element = await attendreQue(() => trouverCible(cible), delaiMs);
      if (!element) return false;
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      await attendre(300);
      const r = element.getBoundingClientRect();
      deps.deplacerDoigt({ x: r.left + r.width / 2, y: r.top + r.height / 2, largeur: r.width, hauteur: r.height });
      await attendre(400);
      deps.toucher();
      return true;
    },
    pause: attendre,
    statut: deps.statut,
    dire: deps.dire,
    demander: deps.demander,
  };
}
```

- [ ] **Étape 6 : `doigt.tsx`**

```tsx
// src/components/assistant/pilote/doigt.tsx
"use client";

import { Pointer } from "lucide-react";
import type { PositionDoigt } from "./scene-dom";

/** Doigt et anneau au-dessus de la page ; ils ne captent jamais les touches. */
export function Doigt({ position, touche }: { position: PositionDoigt | null; touche: number }) {
  if (!position) return null;
  const { x, y, largeur, hauteur } = position;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] print:hidden">
      <div
        className="absolute rounded-xl ring-4 ring-primary/70 transition-all duration-300 ease-out"
        style={{ left: x - largeur / 2 - 6, top: y - hauteur / 2 - 6, width: largeur + 12, height: hauteur + 12 }}
      />
      <div className="absolute transition-all duration-[400ms] ease-out" style={{ left: x - 6, top: y - 2 }}>
        <span key={touche} className="absolute -top-3 -left-3 size-8 animate-ping rounded-full bg-primary/40 [animation-iteration-count:1]" />
        <Pointer className="size-9 fill-white text-primary drop-shadow-lg" />
      </div>
    </div>
  );
}
```

- [ ] **Étape 7 : relancer** le test (passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 8 : commit**

```bash
git add src/components/ui/garde-bulle.ts src/components/ui/garde-bulle.test.ts src/components/ui/dialog.tsx src/components/ui/sheet.tsx src/components/assistant/pilote/scene-dom.ts src/components/assistant/pilote/doigt.tsx
git commit -m "feat(assistant): doigt animé, scène du vrai écran et fenêtres qui laissent la bulle utilisable"
```

---

### Tâche 11 : fournisseur d'état, bulle, panneau et bouton

**Fichiers :**
- Créer : `src/components/assistant/assistant-provider.tsx`, `src/components/assistant/bouton-micro.tsx`,
  `src/components/assistant/pilote/bulle.tsx`
- Modifier : `src/components/assistant/assistant-panel.tsx`, `src/components/assistant/assistant-button.tsx`,
  `src/components/assistant/api.ts` (retirer `speakFrench`), `src/app/(app)/layout.tsx`
- Supprimer : `src/components/assistant/draft-card.tsx`

**Interfaces :**
- Consomme : `askAssistant`, `reveillerVoix`, `creerVoix` (tâche 9) ; `jouer`, `FinMission`, `ReponseAccord` (tâche 7) ;
  `etapesPour` (tâche 6) ; `creerScene`, `PositionDoigt`, `Doigt`, `dansLaBulle` (tâche 10) ; `missionForModel`
  (tâche 2) ; l'enregistreur actuel (`recorder.ts`).
- Produit : `AssistantProvider`, `useAssistant()`, `Phase`, `STATUTS`, `BoutonMicro`, `BulleAssistant`, `DoigtAssistant`.

(Composants de navigateur : vérifiés par le typecheck, le lint et l'essai réel ; la logique testée vit dans le joueur.)

- [ ] **Étape 1 : `assistant-provider.tsx`**

```tsx
// src/components/assistant/assistant-provider.tsx
"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dansLaBulle } from "@/components/ui/garde-bulle";
import { missionForModel, type Mission } from "@/lib/domain/assistant/mission";
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";
import type { Lang } from "@/lib/domain/assistant/tools";
import { askAssistant, reveillerVoix } from "./api";
import { jouer, type FinMission, type ReponseAccord } from "./pilote/moteur";
import { etapesPour } from "./pilote/recettes";
import { creerScene, type PositionDoigt } from "./pilote/scene-dom";
import { MAX_RECORDING_MS, MIN_RECORDING_MS, startRecording, toBase64, toWav16k, type Recording } from "./recorder";
import { creerVoix } from "./voix";

export type Phase = "idle" | "recording" | "thinking" | "speaking" | "pilote" | "confirmation";

export const STATUTS: Record<Phase, string> = {
  idle: "Garde le doigt appuyé et parle, en wolof ou en français.",
  recording: "Je t'écoute… relâche quand tu as fini.",
  thinking: "Je réfléchis…",
  speaking: "Je te réponds…",
  pilote: "Je fais la tâche à l'écran…",
  confirmation: "Je l'enregistre ?",
};

export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface AssistantValue {
  ouvert: boolean;
  setOuvert: (ouvert: boolean) => void;
  phase: Phase;
  turns: Turn[];
  notice: string | null;
  statut: string | null;
  resume: string | null;
  doigt: PositionDoigt | null;
  touche: number;
  rejouer: (() => void) | null;
  appuyer: () => void;
  relacher: () => void;
  accord: (oui: boolean) => void;
  arreter: () => void;
  fermerStatut: () => void;
}

const AssistantContext = createContext<AssistantValue | null>(null);

export function useAssistant(): AssistantValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant doit être utilisé dans AssistantProvider.");
  return value;
}

/** Après une mission, le résultat reste dans la bulle quelques secondes. */
const STATUT_MS = 5_000;
/** Un réveil de la voix au plus toutes les 10 minutes. */
const REVEIL_MS = 10 * 60_000;

/** État de l'assistant pour toute l'application : il survit à la fermeture du panneau et aux changements de page. */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ouvert, setOuvertEtat] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [doigt, setDoigt] = useState<PositionDoigt | null>(null);
  const [touche, setTouche] = useState(0);
  const [rejouer, setRejouer] = useState<(() => void) | null>(null);
  const [voix] = useState(creerVoix);

  const langue = useRef<Lang>("fr");
  const turnsRef = useRef<Turn[]>([]);
  const pressed = useRef(false);
  const starting = useRef(false);
  const recording = useRef<{ rec: Recording; startedAt: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const controle = useRef<AbortController | null>(null);
  const attente = useRef<{ mission: Mission; resoudre: (reponse: ReponseAccord) => void } | null>(null);
  const missionCourante = useRef<Mission | null>(null);
  const dernierReveil = useRef(0);
  const voixEnReveil = useRef(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Départ de l'application : micro libéré, voix coupée, mission arrêtée.
  useEffect(() => {
    const rec = recording;
    const c = controle;
    return () => {
      if (rec.current) {
        clearTimeout(rec.current.timer);
        rec.current.rec.cancel();
      }
      c.current?.abort();
      voix.couper();
    };
  }, [voix]);

  // Toucher la page pendant une mission = reprendre la main (la bulle ne compte pas).
  useEffect(() => {
    if (phase !== "pilote" && phase !== "confirmation") return;
    const surToucher = (event: PointerEvent) => {
      if (!dansLaBulle({ target: event.target })) controle.current?.abort();
    };
    document.addEventListener("pointerdown", surToucher, true);
    return () => document.removeEventListener("pointerdown", surToucher, true);
  }, [phase]);

  function montrerStatut(texte: string | null, garder = false) {
    if (minuterie.current) clearTimeout(minuterie.current);
    setStatut(texte);
    if (texte && !garder) minuterie.current = setTimeout(() => setStatut(null), STATUT_MS);
  }

  function addTurns(...items: Omit<Turn, "id">[]) {
    setTurns((t) => [...t, ...items.map((item) => ({ ...item, id: crypto.randomUUID() }))]);
  }

  const scene = useMemo(
    () =>
      creerScene({
        router,
        deplacerDoigt: setDoigt,
        toucher: () => setTouche((n) => n + 1),
        statut: (texte) => {
          if (minuterie.current) clearTimeout(minuterie.current);
          setStatut(texte);
        },
        dire: (cle) => void voix.phrase(cle, langue.current),
        demander: (texte, signal) =>
          new Promise<ReponseAccord>((resolve) => {
            const finir = (reponse: ReponseAccord) => {
              if (attente.current?.resoudre !== finir) return;
              attente.current = null;
              setResume(null);
              setPhase("pilote");
              resolve(reponse);
            };
            attente.current = { mission: missionCourante.current!, resoudre: finir };
            setResume(texte);
            setPhase("confirmation");
            signal.addEventListener("abort", () => finir({ type: "non" }), { once: true });
          }),
      }),
    [router, voix],
  );

  async function parler(texte: string, l: Lang) {
    setRejouer(null);
    const resultat = await voix.dire(texte, l);
    if (resultat.etat === "bloque") setRejouer(() => resultat.rejouer);
    if (resultat.etat === "indisponible") {
      setNotice(
        voixEnReveil.current
          ? "La voix wolof se réveille, elle revient dans quelques minutes : la réponse est écrite."
          : "Voix wolof indisponible pour le moment : la réponse est écrite.",
      );
    }
  }

  async function lancer(mission: Mission, texte: string): Promise<void> {
    setOuvertEtat(false);
    setNotice(null);
    setPhase("pilote");
    missionCourante.current = mission;
    const c = new AbortController();
    controle.current = c;
    if (mission.type === "tache") void voix.phrase("je-m-en-occupe", langue.current);
    let fin: FinMission;
    try {
      fin = await jouer(etapesPour(mission), scene, c.signal);
    } catch {
      fin = { etat: "arrete", raison: "ecran" };
    }
    controle.current = null;
    setDoigt(null);
    if (fin.etat === "corrige") return lancer(fin.mission, texte);
    missionCourante.current = null;
    switch (fin.etat) {
      case "enregistre":
        montrerStatut(fin.message);
        addTurns({ role: "assistant", text: `✓ ${fin.message}` });
        break;
      case "refuse":
        montrerStatut(fin.message);
        setNotice(fin.message);
        break;
      case "laisse":
        montrerStatut("D'accord, l'écran reste rempli : tu peux corriger et enregistrer toi-même.");
        break;
      case "arrete":
        if (fin.raison === "reprise") {
          void voix.phrase("reprise", langue.current);
          montrerStatut("Tu as repris la main.");
        } else {
          void voix.phrase("souci", langue.current);
          montrerStatut("L'écran ne répond pas : rien n'est enregistré.");
        }
        break;
      case "montre":
        montrerStatut(texte);
        setPhase("speaking");
        await parler(texte, langue.current);
        break;
    }
    setPhase("idle");
  }

  async function traiter(reply: AssistantReply) {
    langue.current = reply.langue;
    addTurns({ role: "user", text: reply.transcription || "…" }, { role: "assistant", text: reply.texte });
    const enAttente = attente.current;
    if (enAttente) {
      if (reply.confirmation) return enAttente.resoudre({ type: reply.confirmation });
      if (reply.mission?.type === "tache") return enAttente.resoudre({ type: "correction", mission: reply.mission });
      setPhase("confirmation");
      void parler(reply.texte, reply.langue);
      return;
    }
    if (reply.mission) return lancer(reply.mission, reply.texte);
    setPhase("speaking");
    await parler(reply.texte, reply.langue);
    setPhase("idle");
  }

  async function demarrer() {
    if (recording.current || starting.current || phase === "thinking" || phase === "pilote") return;
    starting.current = true;
    setNotice(null);
    voix.couper();
    try {
      const rec = await startRecording();
      recording.current = { rec, startedAt: Date.now(), timer: setTimeout(() => void finEnregistrement(), MAX_RECORDING_MS) };
      setPhase("recording");
      if (!pressed.current) void finEnregistrement();
    } catch {
      setNotice("Le micro est bloqué. Autorise-le : touche le cadenas à côté de l'adresse, puis Micro → Autoriser.");
    } finally {
      starting.current = false;
    }
  }

  async function finEnregistrement() {
    pressed.current = false;
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    clearTimeout(current.timer);
    const blob = await current.rec.stop();
    const retour: Phase = attente.current ? "confirmation" : "idle";
    if (Date.now() - current.startedAt < MIN_RECORDING_MS || blob.size === 0) {
      setPhase(retour);
      setNotice("Je n'ai rien entendu. Garde le doigt appuyé pendant que tu parles.");
      return;
    }
    setPhase("thinking");
    let audio: string;
    try {
      audio = toBase64(await toWav16k(blob));
    } catch {
      setPhase(retour);
      setNotice("Impossible de lire l'enregistrement. Réessaie.");
      return;
    }
    const history: HistoryItem[] = turnsRef.current.slice(-10).map(({ role, text }) => ({ role, text: text.slice(0, 800) }));
    const enAttente = attente.current;
    const res = await askAssistant(audio, history, enAttente ? missionForModel(enAttente.mission) : null);
    if (!res.ok) {
      setPhase(attente.current ? "confirmation" : "idle");
      setNotice(res.error);
      return;
    }
    await traiter(res.reply);
  }

  function setOuvert(valeur: boolean) {
    setOuvertEtat(valeur);
    if (valeur && Date.now() - dernierReveil.current > REVEIL_MS) {
      dernierReveil.current = Date.now();
      void reveillerVoix().then((r) => {
        voixEnReveil.current = Boolean(r?.configuree && !r.pret);
      });
    }
  }

  const value: AssistantValue = {
    ouvert,
    setOuvert,
    phase,
    turns,
    notice,
    statut,
    resume,
    doigt,
    touche,
    rejouer,
    appuyer: () => {
      pressed.current = true;
      void demarrer();
    },
    relacher: () => {
      if (!pressed.current) return;
      pressed.current = false;
      void finEnregistrement();
    },
    accord: (oui) => attente.current?.resoudre({ type: oui ? "oui" : "non" }),
    arreter: () => controle.current?.abort(),
    fermerStatut: () => montrerStatut(null),
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
```

- [ ] **Étape 2 : `bouton-micro.tsx`**

```tsx
// src/components/assistant/bouton-micro.tsx
"use client";

import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";

/** Appuyer pour parler (panneau et bulle). */
export function BoutonMicro({ grand = false }: { grand?: boolean }) {
  const a = useAssistant();
  return (
    <button
      type="button"
      aria-label="Appuyer pour parler"
      disabled={a.phase === "thinking" || a.phase === "pilote"}
      onPointerDown={(e) => {
        e.preventDefault();
        a.appuyer();
      }}
      onPointerUp={a.relacher}
      onPointerLeave={a.relacher}
      onPointerCancel={a.relacher}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex shrink-0 touch-none items-center justify-center rounded-full text-white shadow-lg transition select-none active:scale-95 disabled:opacity-50",
        grand ? "size-16" : "size-11",
        a.phase === "recording" ? "scale-110 bg-red-600" : "bg-primary",
      )}
    >
      <Mic className={grand ? "size-7" : "size-5"} />
    </button>
  );
}
```

- [ ] **Étape 3 : `pilote/bulle.tsx`** (avec `DoigtAssistant`)

```tsx
// src/components/assistant/pilote/bulle.tsx
"use client";

import { Check, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "../assistant-provider";
import { BoutonMicro } from "../bouton-micro";
import { Doigt } from "./doigt";

/** Barre flottante pendant une mission : ce que fait l'assistant, Arrêter, puis Oui / Non et le micro. */
export function BulleAssistant() {
  const a = useAssistant();
  if (a.ouvert || (a.phase === "idle" && a.statut === null)) return null;
  const accord = a.phase === "confirmation";
  return (
    <div
      data-assistant-bulle=""
      role="status"
      aria-live="polite"
      style={{ pointerEvents: "auto" }}
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-md rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur lg:bottom-6 print:hidden"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            "mt-0.5 size-8 shrink-0 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-teal-700",
            (a.phase === "pilote" || a.phase === "thinking") && "animate-pulse",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{accord ? STATUTS.confirmation : (a.statut ?? STATUTS[a.phase])}</p>
          {accord && a.resume && <p className="mt-0.5 text-sm text-muted-foreground">{a.resume}</p>}
          {a.notice && <p className="mt-1 text-sm text-destructive">{a.notice}</p>}
        </div>
        {a.phase === "idle" && (
          <button type="button" aria-label="Fermer" onClick={a.fermerStatut} className="rounded-full p-1 text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>
      {accord && (
        <div className="mt-3 flex items-center gap-2">
          <Button className="flex-1" onClick={() => a.accord(true)}>
            <Check /> Oui
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => a.accord(false)}>
            Non
          </Button>
          <BoutonMicro />
        </div>
      )}
      {a.phase === "pilote" && (
        <Button variant="outline" className="mt-3 w-full" onClick={a.arreter}>
          <Square /> Arrêter
        </Button>
      )}
    </div>
  );
}

export function DoigtAssistant() {
  const a = useAssistant();
  return <Doigt position={a.doigt} touche={a.touche} />;
}
```

- [ ] **Étape 4 : `assistant-panel.tsx`** — remplacer par la version qui lit le fournisseur :

```tsx
"use client";

import { Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "./assistant-provider";
import { BoutonMicro } from "./bouton-micro";

export function AssistantPanel() {
  const a = useAssistant();
  const list = useRef<HTMLDivElement | null>(null);

  // La liste défile jusqu'au dernier message.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [a.turns]);

  return (
    <div className="flex max-h-[70dvh] flex-col gap-4 px-4 pb-6">
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {a.turns.map((t) => (
          <div key={t.id} className={cn("max-w-[85%]", t.role === "user" ? "ml-auto text-right" : "")}>
            <p className={cn("inline-block rounded-2xl px-3 py-2 text-sm", t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {t.text}
            </p>
          </div>
        ))}
        {a.rejouer && (
          <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-primary" onClick={a.rejouer}>
            <Play className="size-4" /> Écouter la réponse
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className={cn(
            "size-20 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-teal-700 shadow-[0_0_40px_rgba(20,184,166,0.45)] transition-transform duration-300",
            a.phase === "recording" && "scale-110 animate-pulse",
            a.phase === "thinking" && "animate-spin [animation-duration:2.5s]",
            a.phase === "speaking" && "animate-pulse",
          )}
        />
        <p className="text-center text-sm text-muted-foreground">{STATUTS[a.phase]}</p>
        {a.notice && <p className="text-center text-sm text-destructive">{a.notice}</p>}
        <BoutonMicro grand />
      </div>
    </div>
  );
}
```

- [ ] **Étape 5 : `assistant-button.tsx`**

```tsx
"use client";

import { Mic } from "lucide-react";
import { useOfflineMode } from "@/components/offline/offline-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssistantPanel } from "./assistant-panel";
import { useAssistant } from "./assistant-provider";

/** Bouton micro flottant ; la conversation est gardée par AssistantProvider. Pendant une mission, la bulle le remplace. */
export function AssistantButton() {
  const { online } = useOfflineMode();
  const a = useAssistant();
  const label = online ? "Assistant vocal" : "Assistant indisponible hors connexion";
  const enMission = a.phase === "pilote" || a.phase === "confirmation";

  return (
    <>
      {!enMission && (
        <button
          type="button"
          onClick={() => a.setOuvert(true)}
          disabled={!online}
          aria-label={label}
          title={label}
          className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground lg:bottom-6 print:hidden"
        >
          <Mic className="size-6" />
        </button>
      )}
      <Sheet open={a.ouvert} onOpenChange={a.setOuvert}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Assistant vocal</SheetTitle>
          </SheetHeader>
          {a.ouvert && <AssistantPanel />}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Étape 6 : layout et nettoyage** — dans `src/app/(app)/layout.tsx`, remplacer
  `{ctx.business.assistantEnabled && <AssistantButton />}` par :

```tsx
          {ctx.business.assistantEnabled && (
            <AssistantProvider>
              <AssistantButton />
              <BulleAssistant />
              <DoigtAssistant />
            </AssistantProvider>
          )}
```

  avec les imports `AssistantProvider` (`@/components/assistant/assistant-provider`) et `BulleAssistant`,
  `DoigtAssistant` (`@/components/assistant/pilote/bulle`). Supprimer `src/components/assistant/draft-card.tsx` et la
  fonction `speakFrench` de `api.ts` (plus utilisée).

- [ ] **Étape 7 : vérifier** `npm test` (tout passe), `npm run typecheck`, `npm run lint`.

- [ ] **Étape 8 : commit**

```bash
git add -A src/components/assistant "src/app/(app)/layout.tsx"
git commit -m "feat(assistant): conversation gardée, bulle du mode pilote et doigt sur toute l'application"
```

---

### Tâche 12 : pilote de la caisse

**Fichiers :**
- Modifier : `src/components/shared/payment-method-picker.tsx`, `src/components/customers/customer-combobox.tsx`,
  `src/components/pos/pos-screen.tsx`, `src/components/pos/checkout-dialog.tsx`

**Interfaces :**
- Consomme : `usePiloteEcran` (tâche 8), `PiloteVente`, `PiloteEncaisser`, `ResultatPilote` (tâche 6).
- Produit : pilotes `vente` et `vente.encaisser` ; cibles `vente.produit.<id>`, `vente.encaisser`,
  `vente.paiement.<méthode>`, `vente.montant-recu`, `vente.client`, `vente.valider` ; props `cible?: string` sur
  `PaymentMethodPicker` et `CustomerCombobox` (réutilisées aux tâches 14 et 16).

Rien ne change pour le vendeur qui travaille à la main. Pas de pilote en correction de vente (`initial` / `defaults`).

- [ ] **Étape 1 : composants partagés** — `PaymentMethodPicker` reçoit `cible?: string` et le pose sur chaque bouton :

```tsx
export function PaymentMethodPicker<M extends PaymentMethod>({
  value,
  onChange,
  methods,
  cible,
}: {
  value: M;
  onChange: (method: M) => void;
  methods: readonly M[];
  /** Préfixe des cibles de l'assistant : chaque bouton porte `<cible>.<méthode>`. */
  cible?: string;
}) {
```

  et, sur le `<button role="radio">` de chaque méthode : `data-assistant={cible ? `${cible}.${m}` : undefined}`.
  `CustomerCombobox` reçoit `cible?: string` et le pose sur son bouton déclencheur (`role="combobox"`) :
  `data-assistant={cible}`.

- [ ] **Étape 2 : `pos-screen.tsx`** — `checkout` rend le résultat, et le pilote s'enregistre après `add` :

```tsx
import { usePiloteEcran } from "@/components/assistant/pilote/use-pilote-ecran";

  function checkout(result: CheckoutResult): Promise<string | null> {
    setError(null);
    const customer = result.customerId ? (customers.find((c) => c.id === result.customerId) ?? null) : null;
    const draft: SaleDraft = {
      /* … inchangé … */
    };
    return new Promise((resolve) => {
      startTransition(async () => {
        const failure = await submit(draft);
        if (failure) {
          setError(failure);
          resolve(failure);
          return;
        }
        setCheckoutOpen(false);
        setCartOpen(false);
        clearCart();
        setDiscount("");
        setShowDiscount(false);
        resolve(null);
      });
    });
  }

  // L'assistant vocal remplit la caisse avec les mêmes fonctions que les doigts du vendeur (jamais en correction)
  usePiloteEcran(
    "vente",
    {
      vider: () => {
        clearCart();
        setDiscount("");
        setShowDiscount(false);
        setQ("");
        setCategory("all");
        setError(null);
      },
      ajouterProduit: (id, quantite) => {
        setQ("");
        setCategory("all");
        setQty(id, quantite);
      },
      prixNegocie: (id, prix) => setPrice(id, prix),
      ouvrirEncaisser: () => setCheckoutOpen(true),
    },
    !initial,
  );
```

  Cibles : sur le `<button>` de chaque tuile produit, `data-assistant={`vente.produit.${p.id}`}` ; sur le bouton
  « Encaisser {total} » du panier ET sur la barre « Voir le panier » du téléphone, `data-assistant="vente.encaisser"`.

- [ ] **Étape 3 : `checkout-dialog.tsx`** — `onConfirm` rend une promesse, `confirm` aussi, et le pilote
  `vente.encaisser` vit dans `CheckoutForm` :

```tsx
// Dans CheckoutProps :
  onConfirm: (result: CheckoutResult) => Promise<string | null>;

  function confirm(): Promise<string | null> {
    if (needsCustomer && !customerId) {
      const message = "Choisissez le client qui doit le reste.";
      setLocalError(message);
      return Promise.resolve(message);
    }
    setLocalError(null);
    return onConfirm({ paymentMethod: method, amountReceived: amount, customerId });
  }

  usePiloteEcran(
    "vente.encaisser",
    {
      paiement: (m) => changeMethod(m),
      montantRecu: (montant) => setReceived(montant),
      client: (id) => {
        setCustomerId(id);
        setLocalError(null);
      },
      enregistrer: async () => {
        const failure = await confirm();
        return failure ? { ok: false, message: failure } : { ok: true, message: "Vente enregistrée" };
      },
    },
    !defaults,
  );
```

  Cibles : `<PaymentMethodPicker … cible="vente.paiement" />`, `data-assistant="vente.montant-recu"` sur le
  `SuffixInput id="received"`, `<CustomerCombobox … cible="vente.client" />`, `data-assistant="vente.valider"` sur
  le bouton « Valider la vente » dont l'`onClick` devient `() => void confirm()`. Chercher les autres appelants de
  `CheckoutDialog` (`grep -rn "CheckoutDialog" src`) : ils passent `checkout`, qui rend déjà une promesse.

- [ ] **Étape 4 : vérifier** `npm test`, `npm run typecheck`, `npm run lint`.

- [ ] **Étape 5 : commit**

```bash
git add src/components/shared/payment-method-picker.tsx src/components/customers/customer-combobox.tsx src/components/pos/pos-screen.tsx src/components/pos/checkout-dialog.tsx
git commit -m "feat(assistant): la caisse se laisse remplir par l'assistant"
```

---

### Tâche 13 : pilotes de l'entrée et de la sortie de stock

**Fichiers :**
- Modifier : `src/components/shared/product-picker.tsx`, `src/components/shared/qty-stepper.tsx`,
  `src/components/stock/purchase-form.tsx`, `src/components/stock/exit-form.tsx`

**Interfaces :**
- Consomme : `usePiloteEcran`, `PiloteEntree`, `PiloteSortie`, `ResultatPilote`.
- Produit : pilotes `entree`, `sortie` ; props `cible?: string` sur `ProductPicker` (bouton déclencheur) et
  `QtyStepper` (élément racine) ; cibles `entree.ajouter`, `entree.fournisseur`, `entree.valider`, `sortie.produit`,
  `sortie.genre.loss`, `sortie.genre.exit`, `sortie.motif`, `sortie.quantite`, `sortie.note`, `sortie.valider`.

- [ ] **Étape 1 : composants partagés** — `ProductPicker` : prop `cible?: string`, posée en `data-assistant={cible}`
  sur le bouton « Ajouter un produit ». `QtyStepper` : prop `cible?: string`, posée en `data-assistant={cible}` sur
  son élément racine.

- [ ] **Étape 2 : `purchase-form.tsx`** — `submit` rend le résultat :

```tsx
import type { ResultatPilote } from "@/components/assistant/pilote/types";
import { usePiloteEcran } from "@/components/assistant/pilote/use-pilote-ecran";

  function submit(): Promise<ResultatPilote> {
    setError(null);
    const refus = (message: string) => {
      setError(message);
      return Promise.resolve({ ok: false, message });
    };
    if (lines.length === 0) return refus("Ajoutez au moins un produit.");
    if (lines.some((l) => !l.quantity || Number(l.quantity) <= 0)) return refus("Chaque quantité doit être supérieure à 0.");
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await createPurchase({
          supplierId: supplierId === NONE ? null : supplierId,
          note,
          items: lines.map((l) => ({
            productId: l.product.id,
            quantity: Number(l.quantity),
            unitCost: showCost && l.unitCost !== "" ? Number(l.unitCost) : null,
          })),
        });
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        toast.success("Entrée de stock enregistrée");
        resolve({ ok: true, message: "Entrée de stock enregistrée" });
        router.push("/stock");
        router.refresh();
      });
    });
  }

  usePiloteEcran("entree", {
    vider: () => {
      setLines([]);
      setSupplierId(NONE);
      setNote("");
      setError(null);
    },
    ajouterLigne: (id, quantite, cout) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      setLines((prev) => [...prev.filter((l) => l.product.id !== id), { product: p, quantity: quantite, unitCost: cout ?? p.costPrice ?? "" }]);
    },
    fournisseur: (id) => setSupplierId(id ?? NONE),
    enregistrer: () => submit(),
  });
```

  Le bouton « Valider l'entrée » : `onClick={() => void submit()}` et `data-assistant="entree.valider"`. Cibles :
  `<ProductPicker … cible="entree.ajouter" />`, `data-assistant="entree.fournisseur"` sur le `SelectTrigger` du
  fournisseur. (Garder le type `Line` du fichier ; adapter `quantity`/`unitCost` s'il diffère.)

- [ ] **Étape 3 : `exit-form.tsx`** — même forme :

```tsx
  function submit(): Promise<ResultatPilote> {
    setError(null);
    const refus = (message: string) => {
      setError(message);
      return Promise.resolve({ ok: false, message });
    };
    if (!product) return refus("Choisissez un produit.");
    if (!quantity || quantity <= 0) return refus("La quantité doit être supérieure à 0.");
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await createStockExit({ productId: product.id, quantity, kind, reason, note });
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        const message = kind === "loss" ? "Perte enregistrée" : "Sortie enregistrée";
        toast.success(message);
        resolve({ ok: true, message });
        router.push(`/produits/${product.id}`);
        router.refresh();
      });
    });
  }

  usePiloteEcran("sortie", {
    produit: (id) => {
      const p = products.find((x) => x.id === id);
      if (p) setProduct(p);
    },
    genre: (k) => changeKind(k),
    motif: (r) => setReason(r),
    quantite: (n) => setQuantity(n),
    note: (t) => setNote(t),
    enregistrer: () => submit(),
  });
```

  Cibles : un `<div data-assistant="sortie.produit">` autour du bloc produit (choisi ou à choisir) ;
  `data-assistant="sortie.genre.loss"` sur le bouton « Perte » et `data-assistant="sortie.genre.exit"` sur « Sortie » ;
  `data-assistant="sortie.motif"` sur le `SelectTrigger` du motif ; `<QtyStepper … cible="sortie.quantite" />` ;
  `data-assistant="sortie.note"` sur le `Textarea id="note"` ; bouton final `onClick={() => void submit()}` et
  `data-assistant="sortie.valider"`.

- [ ] **Étape 4 : vérifier** `npm test`, `npm run typecheck`, `npm run lint`.

- [ ] **Étape 5 : commit**

```bash
git add src/components/shared/product-picker.tsx src/components/shared/qty-stepper.tsx src/components/stock/purchase-form.tsx src/components/stock/exit-form.tsx
git commit -m "feat(assistant): entrée et sortie de stock pilotables"
```

---

### Tâche 14 : pilotes de la commande et de son état

**Fichiers :** modifier `src/components/orders/order-form.tsx`, `src/components/orders/order-actions.tsx`.

**Interfaces :**
- Consomme : `usePiloteEcran`, `PiloteCommande`, `PiloteStatutCommande`, `ResultatPilote` ; props `cible` de
  `ProductPicker` et `CustomerCombobox`.
- Produit : pilotes `commande` et `commande.statut` ; cibles `commande.client`, `commande.canal.<canal>`,
  `commande.ajouter`, `commande.livraison`, `commande.acompte`, `commande.valider`, `commande.statut.<état>`.

- [ ] **Étape 1 : `order-form.tsx`**

```tsx
  function submit(): Promise<ResultatPilote> {
    setError(null);
    const refus = (message: string) => {
      setError(message);
      return Promise.resolve({ ok: false, message });
    };
    if (!customerId) return refus("Choisissez le client de la commande.");
    if (lines.length === 0) return refus("Ajoutez au moins un produit.");
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await createOrder({
          customerId,
          channel,
          items: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity) })),
          deliveryFee: Number(deliveryFee) || 0,
          deliveryAddress: address,
          amountPaid: Number(paid) || 0,
          paymentMethod: Number(paid) > 0 ? method : null,
          note,
        });
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        toast.success("Commande enregistrée — les produits sont réservés");
        resolve({ ok: true, message: "Commande enregistrée" });
        router.push(`/commandes/${res.data.id}`);
        router.refresh();
      });
    });
  }

  usePiloteEcran("commande", {
    vider: () => {
      setCustomerId(null);
      setChannel("whatsapp");
      setLines([]);
      setDeliveryFee("");
      setAddress("");
      setPaid("");
      setMethod("wave");
      setNote("");
      setError(null);
    },
    client: (id) => setCustomerId(id),
    canal: (c) => setChannel(c),
    ajouterLigne: (id, quantite) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      setLines((prev) => [...prev.filter((l) => l.product.id !== id), { product: p, quantity: quantite }]);
    },
    livraison: (adresse, frais) => {
      setAddress(adresse);
      setDeliveryFee(frais || "");
    },
    acompte: (montant, methode) => {
      setPaid(montant || "");
      if (methode) setMethod(methode);
    },
    enregistrer: () => submit(),
  });
```

  Cibles : `<CustomerCombobox … cible="commande.client" />` ; sur chaque puce de canal
  `data-assistant={`commande.canal.${c}`}` (nom de la variable de la boucle) ; `<ProductPicker … cible="commande.ajouter" />` ;
  `data-assistant="commande.livraison"` sur l'`Input id="address"` ; `data-assistant="commande.acompte"` sur le
  `SuffixInput id="paid"` ; bouton « Enregistrer la commande » `onClick={() => void submit()}` et
  `data-assistant="commande.valider"`. Si le type `Channel` du fichier diffère de `OrderChannel`, caster dans `canal`.

- [ ] **Étape 2 : `order-actions.tsx`** — dans `OrderStatusButtons` :

```tsx
import { usePiloteEcran } from "@/components/assistant/pilote/use-pilote-ecran";

  // L'assistant a déjà demandé l'accord : il change l'état sans la fenêtre « Êtes-vous sûr ? »
  usePiloteEcran("commande.statut", {
    changerStatut: (to) =>
      new Promise((resolve) => {
        if (!next.includes(to)) {
          resolve({ ok: false, message: "Cette commande ne peut plus passer à cet état." });
          return;
        }
        startTransition(async () => {
          const res = await updateOrderStatus(id, to);
          if (!res.ok) {
            toast.error(res.error);
            resolve({ ok: false, message: res.error });
          } else {
            toast.success("Statut mis à jour");
            resolve({ ok: true, message: "Statut mis à jour" });
          }
          router.refresh();
        });
      }),
  });
```

  Cibles : `data-assistant={`commande.statut.${to}`}` sur le `Button` passé en `trigger` à `ConfirmAction` ET sur le
  `Button` direct.

- [ ] **Étape 3 : vérifier** `npm test`, `npm run typecheck`, `npm run lint`.

- [ ] **Étape 4 : commit**

```bash
git add src/components/orders/order-form.tsx src/components/orders/order-actions.tsx
git commit -m "feat(assistant): commande et changement d'état pilotables"
```

---

### Tâche 15 : pilote de la fiche produit (création et prix)

**Fichiers :** modifier `src/components/products/product-form.tsx`.

**Interfaces :**
- Consomme : `usePiloteEcran`, `PiloteProduit`, `ResultatPilote`.
- Produit : pilote `produit` (sur `/produits/nouveau` et `/produits/<id>/modifier`) ; cibles `produit.nom`,
  `produit.unite`, `produit.categorie`, `produit.reference`, `produit.prix-achat`, `produit.prix-vente`,
  `produit.stock-initial`, `produit.valider`.

- [ ] **Étape 1 : enregistrer en promesse** — `onSubmit` appelle `save`, qui contient l'ancien corps :

```tsx
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void save();
  }

  function save(): Promise<ResultatPilote> {
    setError(null);
    const payload = {
      /* … inchangé … */
    };
    if (categoryChoice === NEW_CATEGORY && !newCategory.trim()) {
      const message = "Donnez un nom à la nouvelle catégorie.";
      setError(message);
      return Promise.resolve({ ok: false, message });
    }
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = isEdit ? await updateProduct(productId!, payload) : await createProduct(payload);
        if (!res.ok) {
          setError(res.error);
          // Stock changé entre-temps : on relit la quantité en rayon pour le prochain essai
          if (isEdit) router.refresh();
          resolve({ ok: false, message: res.error });
          return;
        }
        const message = isEdit ? "Produit mis à jour" : "Produit ajouté";
        toast.success(message);
        resolve({ ok: true, message });
        router.push(`/produits/${res.data.id}`);
        router.refresh();
      });
    });
  }

  usePiloteEcran("produit", {
    champ: (cle, valeur) => setValues((prev) => ({ ...prev, [cle]: valeur })),
    unite: (u) => set("unit", u as ProductFormValues["unit"]),
    categorie: (id, nouvelle) => {
      if (id) setCategoryChoice(id);
      else if (nouvelle) {
        setCategoryChoice(NEW_CATEGORY);
        setNewCategory(nouvelle);
      } else setCategoryChoice(NO_CATEGORY);
    },
    stockInitial: (n) => setInitialStock(n),
    enregistrer: () => save(),
  });
```

- [ ] **Étape 2 : cibles** — `data-assistant="produit.nom"` sur l'`Input id="name"`, `"produit.categorie"` sur le
  `SelectTrigger` de la catégorie, `"produit.unite"` sur celui de l'unité, `"produit.reference"` sur
  `id="reference"`, `"produit.prix-achat"` sur `id="costPrice"`, `"produit.prix-vente"` sur `id="salePrice"`,
  `"produit.stock-initial"` sur `id="initialStock"`, `"produit.valider"` sur le bouton d'envoi.

- [ ] **Étape 3 : vérifier** `npm test`, `npm run typecheck`, `npm run lint`.

- [ ] **Étape 4 : commit**

```bash
git add src/components/products/product-form.tsx
git commit -m "feat(assistant): fiche produit et prix pilotables"
```

---

### Tâche 16 : pilotes des fiches client et fournisseur, et du remboursement

**Fichiers :**
- Modifier : `src/components/customers/customer-dialog.tsx`, `src/app/(app)/clients/page.tsx`,
  `src/components/customers/payment-dialog.tsx`, `src/components/suppliers/supplier-dialog.tsx`,
  `src/app/(app)/fournisseurs/page.tsx`

**Interfaces :**
- Consomme : `usePiloteEcran`, `PiloteFiche`, `PilotePaiement`, `ResultatPilote` ; prop `cible` de `PaymentMethodPicker`.
- Produit : prop `pilote?: boolean` sur `CustomerDialog` et `SupplierDialog` (seules les fiches des pages Clients et
  Fournisseurs sont pilotées, pas celles ouvertes depuis une liste de choix) ; pilotes `client`, `fournisseur`,
  `paiement` ; cibles `client.nouveau`, `client.nom`, `client.telephone`, `client.adresse`, `client.valider`,
  `fournisseur.nouveau`, `fournisseur.nom`, `fournisseur.telephone`, `fournisseur.note`, `fournisseur.valider`,
  `paiement.ouvrir`, `paiement.montant`, `paiement.methode.<méthode>`, `paiement.valider`.

- [ ] **Étape 1 : `customer-dialog.tsx`**

```tsx
  // nouvelle prop : pilote = false
  const formRef = useRef<HTMLFormElement | null>(null);

  function lireFiche(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      address: String(data.get("address") ?? ""),
      note: String(data.get("note") ?? ""),
    };
  }

  function save(input: ReturnType<typeof lireFiche>): Promise<ResultatPilote> {
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = customer ? await updateCustomer(customer.id, input) : await createCustomer(input);
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        const message = customer ? "Client mis à jour" : "Client ajouté";
        toast.success(message);
        setOpen(false);
        onSaved?.(res.data);
        resolve({ ok: true, message });
        router.refresh();
      });
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    void save(lireFiche(e.currentTarget));
  }

  usePiloteEcran(
    "client",
    {
      ouvrir: () => setOpen(true),
      champ: (nom, valeur) => {
        const champ = formRef.current?.elements.namedItem(nom);
        if (champ instanceof HTMLInputElement || champ instanceof HTMLTextAreaElement) champ.value = valeur;
      },
      enregistrer: () => (formRef.current ? save(lireFiche(formRef.current)) : Promise.resolve({ ok: false, message: "La fiche client n'est pas ouverte." })),
    },
    pilote,
  );
```

  `<form ref={formRef} onSubmit={onSubmit} …>` ; cibles sur les champs : `data-assistant="client.nom"` (name),
  `"client.telephone"` (phone), `"client.adresse"` (address), `"client.valider"` sur « Enregistrer ».
  Dans `clients/page.tsx` : `<CustomerDialog pilote …>` et `data-assistant="client.nouveau"` sur le `Button`
  « Nouveau client » passé en `trigger`.

- [ ] **Étape 2 : `supplier-dialog.tsx`** — même forme (prop `pilote = false`, `formRef`, `lireFiche` avec
  name/phone/note, `save`, `onSubmit`, `usePiloteEcran("fournisseur", { ouvrir: () => setOpen(true), champ, enregistrer }, pilote)`),
  message « La fiche fournisseur n'est pas ouverte. » ; cibles `fournisseur.nom`, `fournisseur.telephone`,
  `fournisseur.note`, `fournisseur.valider`. Dans `fournisseurs/page.tsx` : `<SupplierDialog pilote …>` et
  `data-assistant="fournisseur.nouveau"` sur le bouton déclencheur.

- [ ] **Étape 3 : `payment-dialog.tsx`**

```tsx
  function save(): Promise<ResultatPilote> {
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await recordCustomerPayment({ customerId, amount: Number(amount), method, note });
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        toast.success("Remboursement enregistré");
        setOpen(false);
        resolve({ ok: true, message: "Remboursement enregistré" });
        router.refresh();
      });
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void save();
  }

  usePiloteEcran("paiement", {
    ouvrir: () => {
      setOpen(true);
      setAmount(debt);
    },
    montant: (n) => setAmount(n),
    methode: (m) => setMethod(m),
    enregistrer: () => save(),
  });
```

  Cibles : `data-assistant="paiement.ouvrir"` sur le bouton « Enregistrer un remboursement »,
  `"paiement.montant"` sur `SuffixInput id="pay-amount"`, `<PaymentMethodPicker … cible="paiement.methode" />`,
  `"paiement.valider"` sur « Valider ».

- [ ] **Étape 4 : vérifier** `npm test`, `npm run typecheck`, `npm run lint`.

- [ ] **Étape 5 : commit**

```bash
git add src/components/customers/customer-dialog.tsx "src/app/(app)/clients/page.tsx" src/components/customers/payment-dialog.tsx src/components/suppliers/supplier-dialog.tsx "src/app/(app)/fournisseurs/page.tsx"
git commit -m "feat(assistant): fiches client et fournisseur, remboursement pilotables"
```

---

### Tâche 17 : cibles « montre-moi »

**Fichiers :** modifier `src/components/shared/stat-card.tsx`, `src/app/(app)/tableau-de-bord/page.tsx`,
`src/components/dashboard/mobile-home.tsx`, `src/app/(app)/rapports/page.tsx`, `src/app/(app)/ventes/page.tsx`,
`src/app/(app)/produits/page.tsx`, `src/app/(app)/commandes/page.tsx`, `src/app/(app)/clients/[id]/page.tsx`,
`src/app/(app)/produits/[id]/page.tsx`.

**Interfaces :** produit les cibles `tdb.chiffre`, `rapports.chiffre`, `ventes.total`, `produits.liste`,
`commandes.liste`, `client.solde`, `produit.stock`.

- [ ] **Étape 1 : `StatCard`** reçoit `cible?: string` et le pose en `data-assistant={cible}` sur son élément racine.

- [ ] **Étape 2 : poser les cibles** (sur l'élément qui affiche le chiffre, pas sur toute la page) :
  - `tableau-de-bord/page.tsx` : `cible="tdb.chiffre"` sur la `StatCard` du chiffre d'affaires du jour ;
    `mobile-home.tsx` : `data-assistant="tdb.chiffre"` sur le bloc qui affiche le chiffre du jour sur téléphone.
  - `rapports/page.tsx` : `cible="rapports.chiffre"` sur la `StatCard` du chiffre d'affaires.
  - `ventes/page.tsx` : `data-assistant="ventes.total"` sur l'élément qui affiche le total de la période.
  - `produits/page.tsx` : `<div data-assistant="produits.liste">` autour de `ProductList`.
  - `commandes/page.tsx` : `<div data-assistant="commandes.liste">` autour de la liste des commandes.
  - `clients/[id]/page.tsx` : `data-assistant="client.solde"` sur l'élément qui affiche ce que doit le client.
  - `produits/[id]/page.tsx` : `data-assistant="produit.stock"` sur l'élément qui affiche la quantité en stock.

  Si l'élément vit dans un composant enfant, poser l'attribut dans ce composant et **noter son chemin dans le rapport**
  (la tâche 18 en a besoin).

- [ ] **Étape 3 : vérifier** `npm test`, `npm run typecheck`, `npm run lint`.

- [ ] **Étape 4 : commit**

```bash
git add -A src/components/shared/stat-card.tsx src/components/dashboard "src/app/(app)"
git commit -m "feat(assistant): chiffres et listes que l'assistant peut montrer du doigt"
```

---

### Tâche 18 : contrat des cibles

**Fichiers :** créer `src/components/assistant/pilote/cibles.ts` ; tests `src/components/assistant/pilote/cibles.test.ts`.

**Interfaces :**
- Consomme : `etapesPour` (tâche 6), `MISSIONS_EXEMPLES` (tâche 6), les fichiers des tâches 12 à 17.
- Produit : `CIBLES: readonly { cible: string; fichier: string; motif: string }[]` (une cible finissant par « . » est
  un préfixe).

- [ ] **Étape 1 : test** — `cibles.test.ts` :

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CIBLES } from "./cibles";
import { MISSIONS_EXEMPLES } from "./exemples";
import { etapesPour } from "./recettes";

const listee = (cible: string) => CIBLES.some((c) => (c.cible.endsWith(".") ? cible.startsWith(c.cible) : cible === c.cible));

describe("contrat des cibles de l'assistant", () => {
  it("lists every target that a recipe points at", () => {
    for (const mission of MISSIONS_EXEMPLES) {
      for (const etape of etapesPour(mission)) {
        const cible = "cible" in etape ? etape.cible : null;
        if (cible) expect(listee(cible), cible).toBe(true);
      }
    }
  });
  it("finds every listed target in its screen", () => {
    for (const { cible, fichier, motif } of CIBLES) {
      expect(readFileSync(fichier, "utf8").includes(motif), `${cible} absent de ${fichier}`).toBe(true);
    }
  });
});
```

- [ ] **Étape 2 : lancer** `npx vitest run src/components/assistant/pilote/cibles.test.ts` → échec (module absent).

- [ ] **Étape 3 : `cibles.ts`** — fichiers et motifs exacts posés aux tâches 12 à 17 (pour les cibles « montre-moi »,
  reprendre les chemins notés par la tâche 17) :

```ts
// src/components/assistant/pilote/cibles.ts
/** Où chaque cible de l'assistant est posée. Un écran qui perd une cible fait échouer les tests. */
export const CIBLES: readonly { cible: string; fichier: string; motif: string }[] = [
  { cible: "vente.produit.", fichier: "src/components/pos/pos-screen.tsx", motif: "vente.produit.${" },
  { cible: "vente.encaisser", fichier: "src/components/pos/pos-screen.tsx", motif: 'data-assistant="vente.encaisser"' },
  { cible: "vente.paiement.", fichier: "src/components/pos/checkout-dialog.tsx", motif: 'cible="vente.paiement"' },
  { cible: "vente.montant-recu", fichier: "src/components/pos/checkout-dialog.tsx", motif: 'data-assistant="vente.montant-recu"' },
  { cible: "vente.client", fichier: "src/components/pos/checkout-dialog.tsx", motif: 'cible="vente.client"' },
  { cible: "vente.valider", fichier: "src/components/pos/checkout-dialog.tsx", motif: 'data-assistant="vente.valider"' },
  { cible: "entree.ajouter", fichier: "src/components/stock/purchase-form.tsx", motif: 'cible="entree.ajouter"' },
  { cible: "entree.fournisseur", fichier: "src/components/stock/purchase-form.tsx", motif: 'data-assistant="entree.fournisseur"' },
  { cible: "entree.valider", fichier: "src/components/stock/purchase-form.tsx", motif: 'data-assistant="entree.valider"' },
  { cible: "sortie.produit", fichier: "src/components/stock/exit-form.tsx", motif: 'data-assistant="sortie.produit"' },
  { cible: "sortie.genre.", fichier: "src/components/stock/exit-form.tsx", motif: "sortie.genre." },
  { cible: "sortie.motif", fichier: "src/components/stock/exit-form.tsx", motif: 'data-assistant="sortie.motif"' },
  { cible: "sortie.quantite", fichier: "src/components/stock/exit-form.tsx", motif: 'cible="sortie.quantite"' },
  { cible: "sortie.note", fichier: "src/components/stock/exit-form.tsx", motif: 'data-assistant="sortie.note"' },
  { cible: "sortie.valider", fichier: "src/components/stock/exit-form.tsx", motif: 'data-assistant="sortie.valider"' },
  { cible: "commande.client", fichier: "src/components/orders/order-form.tsx", motif: 'cible="commande.client"' },
  { cible: "commande.canal.", fichier: "src/components/orders/order-form.tsx", motif: "commande.canal.${" },
  { cible: "commande.ajouter", fichier: "src/components/orders/order-form.tsx", motif: 'cible="commande.ajouter"' },
  { cible: "commande.livraison", fichier: "src/components/orders/order-form.tsx", motif: 'data-assistant="commande.livraison"' },
  { cible: "commande.acompte", fichier: "src/components/orders/order-form.tsx", motif: 'data-assistant="commande.acompte"' },
  { cible: "commande.valider", fichier: "src/components/orders/order-form.tsx", motif: 'data-assistant="commande.valider"' },
  { cible: "commande.statut.", fichier: "src/components/orders/order-actions.tsx", motif: "commande.statut.${" },
  { cible: "paiement.ouvrir", fichier: "src/components/customers/payment-dialog.tsx", motif: 'data-assistant="paiement.ouvrir"' },
  { cible: "paiement.montant", fichier: "src/components/customers/payment-dialog.tsx", motif: 'data-assistant="paiement.montant"' },
  { cible: "paiement.methode.", fichier: "src/components/customers/payment-dialog.tsx", motif: 'cible="paiement.methode"' },
  { cible: "paiement.valider", fichier: "src/components/customers/payment-dialog.tsx", motif: 'data-assistant="paiement.valider"' },
  { cible: "produit.nom", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.nom"' },
  { cible: "produit.unite", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.unite"' },
  { cible: "produit.categorie", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.categorie"' },
  { cible: "produit.reference", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.reference"' },
  { cible: "produit.prix-achat", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.prix-achat"' },
  { cible: "produit.prix-vente", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.prix-vente"' },
  { cible: "produit.stock-initial", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.stock-initial"' },
  { cible: "produit.valider", fichier: "src/components/products/product-form.tsx", motif: 'data-assistant="produit.valider"' },
  { cible: "client.nouveau", fichier: "src/app/(app)/clients/page.tsx", motif: 'data-assistant="client.nouveau"' },
  { cible: "client.nom", fichier: "src/components/customers/customer-dialog.tsx", motif: 'data-assistant="client.nom"' },
  { cible: "client.telephone", fichier: "src/components/customers/customer-dialog.tsx", motif: 'data-assistant="client.telephone"' },
  { cible: "client.adresse", fichier: "src/components/customers/customer-dialog.tsx", motif: 'data-assistant="client.adresse"' },
  { cible: "client.valider", fichier: "src/components/customers/customer-dialog.tsx", motif: 'data-assistant="client.valider"' },
  { cible: "fournisseur.nouveau", fichier: "src/app/(app)/fournisseurs/page.tsx", motif: 'data-assistant="fournisseur.nouveau"' },
  { cible: "fournisseur.nom", fichier: "src/components/suppliers/supplier-dialog.tsx", motif: 'data-assistant="fournisseur.nom"' },
  { cible: "fournisseur.telephone", fichier: "src/components/suppliers/supplier-dialog.tsx", motif: 'data-assistant="fournisseur.telephone"' },
  { cible: "fournisseur.note", fichier: "src/components/suppliers/supplier-dialog.tsx", motif: 'data-assistant="fournisseur.note"' },
  { cible: "fournisseur.valider", fichier: "src/components/suppliers/supplier-dialog.tsx", motif: 'data-assistant="fournisseur.valider"' },
  { cible: "tdb.chiffre", fichier: "src/app/(app)/tableau-de-bord/page.tsx", motif: 'cible="tdb.chiffre"' },
  { cible: "tdb.chiffre", fichier: "src/components/dashboard/mobile-home.tsx", motif: 'data-assistant="tdb.chiffre"' },
  { cible: "rapports.chiffre", fichier: "src/app/(app)/rapports/page.tsx", motif: 'cible="rapports.chiffre"' },
  { cible: "ventes.total", fichier: "src/app/(app)/ventes/page.tsx", motif: 'data-assistant="ventes.total"' },
  { cible: "produits.liste", fichier: "src/app/(app)/produits/page.tsx", motif: 'data-assistant="produits.liste"' },
  { cible: "commandes.liste", fichier: "src/app/(app)/commandes/page.tsx", motif: 'data-assistant="commandes.liste"' },
  { cible: "client.solde", fichier: "src/app/(app)/clients/[id]/page.tsx", motif: 'data-assistant="client.solde"' },
  { cible: "produit.stock", fichier: "src/app/(app)/produits/[id]/page.tsx", motif: 'data-assistant="produit.stock"' },
];
```

- [ ] **Étape 4 : relancer** (passe), `npm run typecheck`, `npm run lint`. Si un motif manque, corriger l'écran
  (pas la liste), sauf si la tâche 17 a noté un autre fichier.

- [ ] **Étape 5 : commit**

```bash
git add src/components/assistant/pilote/cibles.ts src/components/assistant/pilote/cibles.test.ts
git commit -m "test(assistant): contrat entre les recettes et les cibles des écrans"
```

---

### Tâche 19 : voix wolof en ligne (opérations, faites par le contrôleur avec le commerçant)

Pas de sous-agent : cette tâche touche le compte Hugging Face et le projet Vercel du commerçant.

- [ ] **Étape 1 : copie de l'espace** — ouvrir `https://huggingface.co/spaces/ndaosaer/wolof-tts` dans le navigateur
  intégré ; le commerçant se connecte à Hugging Face (gratuit) ; « Duplicate this Space » : nom `wolof-tts`, visibilité
  publique, matériel « CPU basic » (gratuit).
- [ ] **Étape 2 : attendre le démarrage** — `curl -s https://huggingface.co/api/spaces/<compte>/wolof-tts/runtime`
  jusqu'à `"stage":"RUNNING"` (le premier démarrage télécharge le modèle, 10 à 20 min), puis
  `curl -s https://<compte>-wolof-tts.hf.space/health` → `{"status":"healthy",…}`.
- [ ] **Étape 3 : brancher l'adresse** — Vercel (production) :
  `printf "%s" "https://<compte>-wolof-tts.hf.space" | npx vercel env add ANTA_TTS_URL production` ; et dans
  `.env.local` : `ANTA_TTS_URL=https://<compte>-wolof-tts.hf.space`.
- [ ] **Étape 4 : phrases prêtes** — `npx tsx scripts/phrases-voix.ts` → sept fichiers dans `public/assistant/voix/` ;
  en écouter un ou deux.
- [ ] **Étape 5 : commit**

```bash
git add public/assistant/voix
git commit -m "feat(assistant): phrases prêtes en wolof (voix Anta)"
```

---

### Tâche 20 : documentation et vérification finale

**Fichiers :** modifier `LISEZ-MOI.md`, `docs/superpowers/specs/2026-11-11-assistant-pilote-design.md`.

- [ ] **Étape 1 : LISEZ-MOI** — dans la partie assistant : le mode pilote (doigt, bulle, « Ndax ma bind ko ? », Oui /
  Non à la voix ou au bouton, Arrêter, toucher l'écran pour reprendre la main), les dix tâches et les écrans
  « montre-moi », `ANTA_TTS_URL` (copie Hugging Face, réveil quotidien `/api/assistant/reveil`), la commande
  `npx tsx scripts/phrases-voix.ts` pour refaire les phrases prêtes.
- [ ] **Étape 2 : spécification** — aligner deux points sur ce qui est construit : une correction à la voix rejoue la
  mission corrigée sur l'écran déjà ouvert (le formulaire est vidé puis rempli à nouveau) ; seules `Dialog` et `Sheet`
  reçoivent la garde de la bulle (`AlertDialog` n'est jamais ouverte par l'assistant).
- [ ] **Étape 3 : vérification complète** — `npm test`, `npm run typecheck`, `npm run lint`, puis `npm run build`
  (doit réussir sans erreur).
- [ ] **Étape 4 : commit**

```bash
git add LISEZ-MOI.md docs/superpowers/specs/2026-11-11-assistant-pilote-design.md
git commit -m "docs(assistant): mode pilote, voix wolof en ligne et phrases prêtes"
```
