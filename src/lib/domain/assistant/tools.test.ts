// src/lib/domain/assistant/tools.test.ts
import { describe, expect, it } from "vitest";
import { can, type Permission, type Role } from "@/lib/domain/permissions";
import { allowedTools, isDraftTool, isReadTool, periodRange, toolDeclarations } from "./tools";

const access = (role: Role, modules = { modulePos: true, moduleOrders: true }) => ({
  can: (p: Permission) => can(role, p),
  ...modules,
});

describe("allowedTools", () => {
  it("gives every tool to the owner, with repondre last", () => {
    const tools = allowedTools(access("owner"));
    expect([...tools].sort()).toEqual(
      [
        "brouillon_client", "brouillon_commande", "brouillon_entree_stock", "brouillon_fournisseur", "brouillon_paiement_client",
        "brouillon_prix", "brouillon_produit", "brouillon_sortie_stock", "brouillon_statut_commande", "brouillon_vente",
        "clients_debiteurs", "commandes_en_cours", "montrer_ecran", "repondre", "resume_ventes", "stock_produit",
      ].sort(),
    );
    expect(tools.at(-1)).toBe("repondre");
  });
  it("never offers a stock entry to a seller", () => {
    const tools = allowedTools(access("seller"));
    expect(tools).not.toContain("brouillon_entree_stock");
    expect(tools).toEqual(expect.arrayContaining(["brouillon_vente", "brouillon_commande", "brouillon_paiement_client", "stock_produit"]));
  });
  it("gives the storekeeper stock entries and exits only", () => {
    expect(allowedTools(access("storekeeper"))).toEqual(["resume_ventes", "montrer_ecran", "stock_produit", "brouillon_entree_stock", "brouillon_sortie_stock", "repondre"]);
  });
  it("offers no draft at all on a read-only plan", () => {
    expect(allowedTools({ ...access("owner"), readOnly: true }).filter((t) => t.startsWith("brouillon_"))).toEqual([]);
  });
  it("adds confirmer only while a task waits for the user's answer", () => {
    expect(allowedTools(access("owner"))).not.toContain("confirmer");
    expect(allowedTools(access("owner"), { attente: true }).slice(-2)).toEqual(["confirmer", "repondre"]);
  });
  it("gives the live dialogue confirmer and no repondre", () => {
    const tools = allowedTools(access("owner"), { direct: true });
    expect(tools).toContain("confirmer");
    expect(tools).not.toContain("repondre");
    expect(tools.at(-1)).toBe("confirmer");
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
    expect(isDraftTool("repondre")).toBe(false);
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
    expect(toolDeclarations(["repondre", "stock_produit"], { costs: false }).map((d) => d.name)).toEqual(["repondre", "stock_produit"]);
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
