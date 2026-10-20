import { describe, expect, it } from "vitest";
import {
  autoMap,
  buildRows,
  containerFromSize,
  detectEuro,
  detectHeaderRow,
  EUR_TO_FCFA,
  headerScore,
  ignoredKind,
  parseMoney,
  parseNumber,
  parseQuantity,
  parseUnit,
  shouldConvertEuro,
  type Cell,
} from "./products";

describe("parseNumber / parseMoney / parseQuantity", () => {
  it("lit les montants écrits de toutes les façons", () => {
    expect(parseMoney("15 000")).toBe(15000);
    expect(parseMoney("15 000 FCFA")).toBe(15000);
    expect(parseMoney("15.000")).toBe(15000);
    expect(parseMoney("15,000")).toBe(15000);
    expect(parseMoney("1.500.000")).toBe(1500000);
    expect(parseMoney("2 500 F CFA")).toBe(2500);
    expect(parseMoney("15k")).toBe(15000);
    expect(parseMoney(12500)).toBe(12500);
    expect(parseMoney("1 234,50")).toBe(1235);
    expect(parseMoney("1.234,50")).toBe(1235);
  });
  it("refuse ce qui n'est pas un nombre ou un montant négatif", () => {
    expect(parseMoney("gratuit")).toBeNull();
    expect(parseMoney("-200")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
  it("garde les décimales des quantités", () => {
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity("2.25")).toBe(2.25);
    expect(parseQuantity("12")).toBe(12);
  });
});

describe("parseUnit", () => {
  it("reconnaît les abréviations courantes", () => {
    expect(parseUnit("Pièce")).toBe("piece");
    expect(parseUnit("pcs")).toBe("piece");
    expect(parseUnit("KILO")).toBe("kg");
    expect(parseUnit("btl")).toBe("bouteille");
    expect(parseUnit("Sacs")).toBe("sac");
    expect(parseUnit("ctn")).toBe("carton");
    expect(parseUnit("bidon")).toBeNull();
  });
});

describe("headerScore", () => {
  it("distingue prix d'achat et prix de vente", () => {
    expect(headerScore("Prix d'achat", "costPrice")).toBe(100);
    expect(headerScore("Prix d'achat", "salePrice")).toBeLessThan(60);
    expect(headerScore("Prix de vente (FCFA)", "salePrice")).toBeGreaterThanOrEqual(60);
    expect(headerScore("PRIX", "salePrice")).toBe(100);
    expect(headerScore("P.A.", "costPrice")).toBe(100);
    expect(headerScore("Qté", "stock")).toBe(100);
    expect(headerScore("Désignation", "name")).toBe(100);
  });
});

describe("detectHeaderRow", () => {
  it("trouve l'en-tête sous un titre de document", () => {
    const rows: Cell[][] = [
      ["INVENTAIRE BOUTIQUE AWA — OCTOBRE", null, null],
      [null, null, null],
      ["Désignation", "Qté", "Prix"],
      ["Robe wax", 12, 15000],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });
  it("renvoie -1 quand le fichier n'a pas d'en-tête", () => {
    expect(detectHeaderRow([["Robe wax", 12, 15000], ["Savon", 40, 1500]])).toBe(-1);
  });
});

describe("autoMap", () => {
  it("fait correspondre des titres variés", () => {
    const map = autoMap(["Désignation", "Famille", "PA", "PV", "Qté", "Stock mini", "Code"], []);
    expect(map.map((g) => g.field)).toEqual(["name", "category", "costPrice", "salePrice", "stock", "alertThreshold", "reference"]);
  });
  it("devine les colonnes d'un fichier sans en-tête d'après leur contenu", () => {
    const rows: Cell[][] = [
      ["Robe wax longue", "Vêtements", "pièce", 9000, 15000],
      ["Savon noir naturel", "Cosmétiques", "pièce", 800, 1500],
      ["Beurre de karité 250 g", "Cosmétiques", "pce", 1500, 3000],
      ["Foulard soie", "Accessoires", "pièce", 2500, 5000],
      ["Huile de coco 500 ml", "Cosmétiques", "btl", 2000, 3500],
    ];
    const map = autoMap([], rows).map((g) => g.field);
    expect(map[0]).toBe("name");
    expect(map[1]).toBe("category");
    expect(map[2]).toBe("unit");
    expect(map[3]).toBe("costPrice");
    expect(map[4]).toBe("salePrice");
  });
  it("complète un titre inconnu par le contenu", () => {
    const rows: Cell[][] = [
      ["Ciment 50 kg", 4600],
      ["Fer à béton 10", 4200],
      ["Clous de 8", 1300],
    ];
    const map = autoMap(["Article", "Combien"], rows);
    expect(map[0]!.field).toBe("name");
    expect(map[1]).toMatchObject({ field: "salePrice", source: "contenu" });
  });
});

describe("buildRows", () => {
  const mapping = ["name", "unit", "costPrice", "salePrice", "stock"] as const;
  it("nettoie les valeurs et signale les problèmes", () => {
    const rows = buildRows(
      [
        ["  Robe   wax ", "pce", "9 000", "15 000 FCFA", "12"],
        ["Riz 25 kg", "sac", "", "abc", "3,7"],
        ["", "pièce", 100, 200, 1],
        ["robe wax", "pièce", 100, 200, 1],
        ["Huile", "bidon", 2000, 1500, "1,5"],
      ],
      [...mapping],
      2,
    );
    expect(rows[0]).toMatchObject({ line: 2, name: "Robe wax", unit: "piece", costPrice: 9000, salePrice: 15000, stock: 12, error: null });
    expect(rows[1]!.salePrice).toBe(0);
    expect(rows[1]!.stock).toBe(4);
    expect(rows[1]!.warnings.join(" ")).toMatch(/illisible/);
    expect(rows[2]!.error).toBe("Nom du produit manquant");
    expect(rows[3]!.error).toMatch(/En double/);
    expect(rows[4]!.unit).toBe("piece");
    expect(rows[4]!.warnings.join(" ")).toMatch(/inconnue/);
    expect(rows[4]!.warnings.join(" ")).toMatch(/supérieur/);
  });
  it("ignore les lignes vides", () => {
    expect(buildRows([[null, null], ["Savon", 1500]], ["name", "salePrice"], 2)).toHaveLength(1);
  });
});

describe("colonnes écartées d'office", () => {
  it("reconnaît tailles, montants calculés et comptages successifs", () => {
    expect(ignoredKind("Taille de l'élément (Description : sac, boîte, poids, once, etc.)")).toBe("taille");
    expect(ignoredKind("Contenance")).toBe("taille");
    expect(ignoredKind("Valeur totale")).toBe("montant");
    expect(ignoredKind("Montant")).toBe("montant");
    expect(ignoredKind("Quantité totale")).toBeNull();
    expect(ignoredKind("Semaine 4")).toBe("historique");
    expect(ignoredKind("S2")).toBe("historique");
    expect(ignoredKind("Octobre 2026")).toBe("historique");
    expect(ignoredKind("Prix de vente")).toBeNull();
  });
  it("tire le contenant d'une taille, sans prendre la mesure pour une unité", () => {
    expect(containerFromSize("Sac de 11 kg")).toBe("sac");
    expect(containerFromSize("Carton de 12")).toBe("carton");
    expect(containerFromSize("3,5 litres")).toBeNull();
    expect(containerFromSize("4,5 kg")).toBeNull();
    expect(parseUnit("Sac de 50 kg")).toBe("sac");
  });
});

describe("feuille d'inventaire de restaurant (modèle en euros)", () => {
  const head = [
    "Nom de l'élément",
    "Catégorie",
    "Taille de l'élément\n(Description : sac, boîte, poids, once, etc.)",
    "Coût unitaire",
    "Semaine 1",
    "Semaine 2",
    "Semaine 3",
    "Semaine 4",
    "Valeur totale",
  ];
  const sheet: Cell[][] = [
    ["Modèle d'exemple de feuille d'inventaire pour les restaurants"],
    head,
    ["Huile d'olive", "Matériel de cuisson", "3,5 litres", "20,00 €", 2, 3, 2, 4, "220,00 €"],
    ["Poitrine de poulet", "Viande", "4,5 kg", "30,00 €", 5, 4, 6, 5, "600,00 €"],
    ["Riz basmati", "Céréales", "Sac de 11 kg", "18,00 €", 3, 2, 4, 3, "216,00 €"],
    [null, null, null, "€", null, null, null, null, "€"],
    [null, null, null, "€", null, null, null, null, "€"],
    [null, null, null, null, "Smartsheet Inc. ©2025"],
  ];

  it("retrouve l'en-tête et associe les bonnes colonnes", () => {
    const header = detectHeaderRow(sheet);
    expect(header).toBe(1);
    const map = autoMap(sheet[header]!, sheet.slice(header + 1));
    expect(map.map((g) => g.field)).toEqual(["name", "category", null, "costPrice", null, null, null, "stock", null]);
    expect(map[2]!.ignored).toBe("taille");
    expect(map[8]!.ignored).toBe("montant");
    expect(map[4]!.ignored).toBe("historique");
    expect(map[7]).toMatchObject({ field: "stock", note: "dernier comptage" });
  });

  it("détecte les euros et propose la conversion pour de petits montants", () => {
    const map = autoMap(sheet[1]!, sheet.slice(2)).map((g) => g.field);
    expect(detectEuro(sheet.slice(2), map)).toBe(true);
    expect(shouldConvertEuro(sheet.slice(2), map)).toBe(true);
    expect(shouldConvertEuro([["Riz", "15 000 €"]], [null, "costPrice"])).toBe(false);
  });

  it("construit 3 produits propres, sans les lignes vides ni le pied de page", () => {
    const map = autoMap(sheet[1]!, sheet.slice(2)).map((g) => g.field);
    const rows = buildRows(sheet.slice(2), map, 3, { sizeColumn: 2, priceFactor: EUR_TO_FCFA });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.error === null)).toBe(true);
    expect(rows[0]).toMatchObject({ name: "Huile d'olive", category: "Matériel de cuisson", unit: "piece", stock: 4, costPrice: 13119 });
    expect(rows[2]).toMatchObject({ name: "Riz basmati", unit: "sac", stock: 3, costPrice: 11807 });
    expect(rows[0]!.name).not.toMatch(/litre/);
  });

  it("ignore aussi les lignes vides dont les cases valent 0 (vrai fichier Excel)", () => {
    const map = autoMap(sheet[1]!, sheet.slice(2)).map((g) => g.field);
    const rows = buildRows([...sheet.slice(2, 5), [null, null, null, 0, null, null, null, null, 0]], map, 3);
    expect(rows).toHaveLength(3);
    const orphan = buildRows([[null, "Viande", null, 15000]], map, 3);
    expect(orphan[0]!.error).not.toBeNull();
  });
});

describe("parseMoney en euros sans conversion", () => {
  it("lit « 20,00 € » comme 20", () => {
    expect(parseMoney("20,00 €")).toBe(20);
    expect(parseNumber("1 250,50 EUR")).toBe(1250.5);
  });
});
