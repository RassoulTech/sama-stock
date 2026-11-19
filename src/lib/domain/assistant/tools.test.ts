// src/lib/domain/assistant/tools.test.ts
import { describe, expect, it } from "vitest";
import { can, type Permission, type Role } from "@/lib/domain/permissions";
import { allowedTools, isDraftTool, isReadTool, periodRange, toolDeclarations } from "./tools";

const access = (role: Role, modules = { modulePos: true, moduleOrders: true }) => ({
  can: (p: Permission) => can(role, p),
  ...modules,
});

describe("allowedTools", () => {
  it("gives every tool to the owner, with confirmer last", () => {
    const tools = allowedTools(access("owner"));
    expect([...tools].sort()).toEqual(
      [
        "analyse_ventes", "brouillon_client", "brouillon_commande", "brouillon_entree_stock", "brouillon_fournisseur", "brouillon_paiement_client",
        "brouillon_prix", "brouillon_produit", "brouillon_sortie_stock", "brouillon_statut_commande", "brouillon_vente",
        "clients_debiteurs", "commandes_en_cours", "confirmer", "montrer_ecran", "resume_catalogue", "resume_ventes", "stock_produit",
        "lire_ecran", "defiler", "cliquer", "saisir", "envoyer_whatsapp",
      ].sort(),
    );
    expect(tools.at(-1)).toBe("confirmer");
  });
  it("never offers a stock entry to a seller", () => {
    const tools = allowedTools(access("seller"));
    expect(tools).not.toContain("brouillon_entree_stock");
    expect(tools).toEqual(expect.arrayContaining(["brouillon_vente", "brouillon_commande", "brouillon_paiement_client", "stock_produit"]));
  });
  it("gives the storekeeper stock entries and exits only", () => {
    expect(allowedTools(access("storekeeper"))).toEqual([
      "resume_ventes", "montrer_ecran", "stock_produit", "resume_catalogue", "brouillon_entree_stock", "brouillon_sortie_stock",
      "lire_ecran", "defiler", "cliquer", "saisir", "envoyer_whatsapp", "confirmer",
    ]);
  });
  it("offers no draft at all on a read-only plan", () => {
    expect(allowedTools({ ...access("owner"), readOnly: true }).filter((t) => t.startsWith("brouillon_"))).toEqual([]);
  });
  it("gives the live dialogue every screen gesture: read, scroll, tap, type, WhatsApp", () => {
    const tools = allowedTools(access("owner"));
    expect(tools).toEqual(expect.arrayContaining(["lire_ecran", "defiler", "cliquer", "saisir", "envoyer_whatsapp", "analyse_ventes"]));
    expect(allowedTools(access("storekeeper"))).not.toContain("analyse_ventes");
  });
  it("lets montrer_ecran carry filters and a section, and declares the new gestures", () => {
    const decl = toolDeclarations(["montrer_ecran", "defiler", "saisir", "analyse_ventes"], { costs: true });
    const props = decl[0].parameters?.properties ?? {};
    expect(Object.keys(props)).toEqual(expect.arrayContaining(["ecran", "section", "periode", "du", "au", "categorie", "etat", "paiement", "recherche", "nom"]));
    expect(props.periode.enum).toEqual(expect.arrayContaining(["dates", "mois_dernier", "30jours"]));
    expect(decl[1].parameters?.required).toBeUndefined();
    expect(decl[2].parameters?.required).toEqual(["champ", "valeur"]);
    expect(decl[3].parameters?.properties?.vue.enum).toEqual(expect.arrayContaining(["produits", "produit", "categories", "dormants"]));
  });
  it("always offers confirmer, last, even on a read-only plan", () => {
    expect(allowedTools(access("owner")).at(-1)).toBe("confirmer");
    expect(allowedTools({ ...access("owner"), readOnly: true }).at(-1)).toBe("confirmer");
  });
  it("respects disabled modules", () => {
    const tools = allowedTools(access("owner", { modulePos: false, moduleOrders: false }));
    expect(tools).not.toContain("brouillon_vente");
    expect(tools).not.toContain("brouillon_commande");
    expect(tools).toContain("commandes_en_cours");
  });
});

describe("isReadTool / isDraftTool", () => {
  it("classifies tool names", () => {
    expect(isReadTool("stock_produit")).toBe(true);
    expect(isReadTool("brouillon_vente")).toBe(false);
    expect(isDraftTool("brouillon_vente")).toBe(true);
    expect(isDraftTool("confirmer")).toBe(false);
  });
});

describe("toolDeclarations", () => {
  const stockEntryLine = (costs: boolean) => {
    const [decl] = toolDeclarations(["brouillon_entree_stock"], { costs });
    return decl.parameters?.properties?.lignes?.items?.properties ?? {};
  };
  it("hides the purchase price from roles that cannot see costs", () => {
    expect(stockEntryLine(false)).not.toHaveProperty("prix_achat");
    expect(stockEntryLine(true)).toHaveProperty("prix_achat");
  });
  it("declares no parameters for tools without arguments", () => {
    const [decl] = toolDeclarations(["clients_debiteurs"], { costs: true });
    expect(decl.parameters).toBeUndefined();
  });
  it("keeps the requested order", () => {
    expect(toolDeclarations(["confirmer", "stock_produit"], { costs: false }).map((d) => d.name)).toEqual(["confirmer", "stock_produit"]);
  });
});

describe("periodRange", () => {
  const now = new Date("2026-11-05T15:30:00Z");
  it("today starts at midnight in Dakar (UTC)", () => {
    expect(periodRange("aujourdhui", now)).toEqual({ from: new Date("2026-11-05T00:00:00Z") });
  });
  it("yesterday is a closed day", () => {
    expect(periodRange("hier", now)).toEqual({ from: new Date("2026-11-04T00:00:00Z"), to: new Date("2026-11-05T00:00:00Z") });
  });
  it("7 days includes today", () => {
    expect(periodRange("7jours", now)).toEqual({ from: new Date("2026-10-30T00:00:00Z") });
  });
  it("month starts on the 1st", () => {
    expect(periodRange("mois", now)).toEqual({ from: new Date("2026-11-01T00:00:00Z") });
  });
});
