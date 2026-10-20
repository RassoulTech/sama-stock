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
  applySavedMapping,
  headerSignature,
  parseQuantityWithUnit,
  pickBestSheet,
  productKey,
  tidyLabel,
  unitFromName,
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

describe("titres de colonnes : fautes de frappe, synonymes, colonnes à écarter", () => {
  it("tolère une faute de frappe sur les mots longs", () => {
    expect(headerScore("Quantiter en stok", "stock")).toBeGreaterThanOrEqual(60);
    expect(headerScore("Catégori", "category")).toBeGreaterThanOrEqual(60);
    expect(headerScore("Désignations", "name")).toBeGreaterThanOrEqual(60);
    expect(headerScore("Prix de vante", "salePrice")).toBeGreaterThanOrEqual(60);
  });

  it("comprend les abréviations et le wolof", () => {
    expect(headerScore("PA HT", "costPrice")).toBeGreaterThanOrEqual(60);
    expect(headerScore("Njëgu jënd", "costPrice")).toBeGreaterThanOrEqual(60);
    expect(headerScore("Njëgu jaay", "salePrice")).toBeGreaterThanOrEqual(60);
    expect(headerScore("Qté dispo", "stock")).toBeGreaterThanOrEqual(60);
  });

  it("ne prend pas un seuil ni des ventes passées pour le stock", () => {
    expect(headerScore("Stock mini", "stock")).toBeLessThan(60);
    expect(ignoredKind("Quantité vendue")).toBe("ventes");
    expect(ignoredKind("Ventes")).toBe("ventes");
    expect(ignoredKind("Prix de vente")).toBeNull();
    expect(autoMap(["Produit", "Stock", "Stock mini"], [["Riz", 4, 2]]).map((g) => g.field)).toEqual(["name", "stock", "alertThreshold"]);
  });

  it("reconnaît les colonnes du modèle Sama Stock", () => {
    const head = [
      "Nom du produit",
      "Référence ou code-barres",
      "Catégorie",
      "Unité",
      "Prix d'achat (FCFA)",
      "Prix de vente (FCFA)",
      "Quantité en stock",
      "Seuil d'alerte (stock bas)",
    ];
    expect(autoMap(head, []).map((g) => g.field)).toEqual(["name", "reference", "category", "unit", "costPrice", "salePrice", "stock", "alertThreshold"]);
  });

  it("relit l'onglet « Stock actuel » d'un export Sama Stock", () => {
    const head = [
      "Produit",
      "Référence",
      "Catégorie",
      "Unité",
      "En stock",
      "Réservé pour commandes",
      "Disponible",
      "Seuil d'alerte",
      "État",
      "Prix d'achat",
      "Prix de vente",
      "Valeur du stock",
    ];
    expect(autoMap(head, []).map((g) => g.field)).toEqual([
      "name",
      "reference",
      "category",
      "unit",
      "stock",
      null,
      null,
      "alertThreshold",
      null,
      "costPrice",
      "salePrice",
      null,
    ]);
  });
});

describe("valeurs : francs, quantités avec unité, unité dans le nom", () => {
  it("lit « 1500F » et « 1 500 frs »", () => {
    expect(parseMoney("1500F")).toBe(1500);
    expect(parseMoney("1 500 frs")).toBe(1500);
    expect(parseMoney("15.000 F")).toBe(15000);
  });

  it("sépare la quantité et l'unité", () => {
    expect(parseQuantityWithUnit("2 cartons")).toMatchObject({ quantity: 2, unit: "carton" });
    expect(parseQuantityWithUnit("12 pcs")).toMatchObject({ quantity: 12, unit: "piece" });
    expect(parseQuantityWithUnit("1,5 kg")).toMatchObject({ quantity: 1.5, unit: "kg" });
    expect(parseQuantityWithUnit(7)).toMatchObject({ quantity: 7, unit: null });
    expect(parseQuantityWithUnit("-3")).toMatchObject({ quantity: null, negative: true });
  });

  it("trouve l'unité dans le nom quand elle y est clairement écrite", () => {
    expect(unitFromName("Tissu wax au mètre")).toBe("m");
    expect(unitFromName("Viande de bœuf au kilo")).toBe("kg");
    expect(unitFromName("Riz sac de 25 kg")).toBe("sac");
    expect(unitFromName("Paire de sandales")).toBe("paire");
    expect(unitFromName("Huile 5 L")).toBeNull();
    expect(unitFromName("Sac à main cuir")).toBeNull();
    expect(unitFromName("Thé au lait")).toBeNull();
  });

  it("range les libellés écrits en majuscules", () => {
    expect(tidyLabel("PRODUITS LAITIERS")).toBe("Produits laitiers");
    expect(tidyLabel("Riz :")).toBe("Riz");
    expect(tidyLabel("iPhone")).toBe("iPhone");
  });

  it("compare les noms sans tenir compte des accents ni des espaces avant l'unité", () => {
    expect(productKey("Riz parfumé 25 kg")).toBe(productKey("riz parfume 25kg"));
  });
});

describe("buildRows : titres de groupe, prix calculés, exemples", () => {
  const sheet: Cell[][] = [
    ["BOISSONS"],
    ["Coca 33 cl", "24", "500"],
    ["Fanta 33 cl", "12 pcs", "500"],
    [],
    ["Riz et céréales :"],
    ["Riz brisé", "3 sacs", "15000F"],
    [],
    ["Savons"],
    ["Savon de Marseille", 10, 350],
  ];
  const map: ("name" | "stock" | "salePrice" | null)[] = ["name", "stock", "salePrice"];

  it("utilise les titres de groupe comme catégories", () => {
    const rows = buildRows(sheet, map, 2);
    expect(rows.map((r) => [r.name, r.category])).toEqual([
      ["Coca 33 cl", "Boissons"],
      ["Fanta 33 cl", "Boissons"],
      ["Riz brisé", "Riz et céréales"],
      ["Savon de Marseille", "Savons"],
    ]);
    expect(rows.every((r) => r.error === null && r.derived.category)).toBe(true);
    expect(rows[2]).toMatchObject({ unit: "sac", stock: 3, salePrice: 15000, derived: { unit: "quantite" } });
  });

  it("peut ignorer les titres de groupe", () => {
    const rows = buildRows(sheet, map, 2, { sections: false });
    expect(rows.find((r) => r.name === "Coca 33 cl")?.category).toBe("");
  });

  it("ne prend pas un produit sans chiffres pour un titre dans une simple liste de noms", () => {
    const rows = buildRows([["Riz"], ["Sucre"], ["Huile"]], ["name"], 2);
    expect(rows.map((r) => r.name)).toEqual(["Riz", "Sucre", "Huile"]);
  });

  it("calcule les prix de vente manquants, arrondis aux 25 FCFA supérieurs", () => {
    const rows = buildRows(
      [
        ["Riz", 10000, ""],
        ["Huile", 13119, ""],
        ["Sucre", 800, 1000],
      ],
      ["name", "costPrice", "salePrice"],
      2,
      { marginPercent: 30 },
    );
    expect(rows.map((r) => r.salePrice)).toEqual([13000, 17075, 1000]);
    expect(rows[0]!.derived.salePrice).toBe(true);
    expect(rows[2]!.derived.salePrice).toBeUndefined();
    expect(rows[0]!.warnings).toEqual([]);
  });

  it("n'importe jamais les lignes d'exemple du modèle", () => {
    const rows = buildRows(
      [
        ["Robe wax longue (exemple)", 5],
        ["Ma robe", 3],
      ],
      ["name", "stock"],
      6,
    );
    expect(rows.map((r) => r.name)).toEqual(["Ma robe"]);
  });

  it("ne crée pas de catégorie « Sans catégorie »", () => {
    const rows = buildRows([["Riz", "Sans catégorie"], ["Mil", "N/A"]], ["name", "category"], 2);
    expect(rows.map((r) => r.category)).toEqual(["", ""]);
  });

  it("repère les doublons même écrits différemment", () => {
    const rows = buildRows(
      [
        ["Riz 25 kg", 1],
        ["riz 25kg", 2],
      ],
      ["name", "stock"],
      2,
    );
    expect(rows[1]!.error).toMatch(/En double/);
  });
});

describe("choix de la feuille et mémoire des colonnes", () => {
  it("préfère la feuille de produits au mode d'emploi", () => {
    const guide: Cell[][] = [
      ["Comment remplir ce fichier"],
      ["Colonne", "À quoi elle sert", "Exemple"],
      ["Nom du produit", "Obligatoire", "Robe wax"],
      ["Prix d'achat (FCFA)", "Ce que vous payez", "9000"],
      ["Prix de vente (FCFA)", "Ce que paie le client", "15000"],
      ["Quantité en stock", "Combien vous en avez", "20"],
    ];
    const products: Cell[][] = [["Mes produits"], [], ["Nom du produit", "Prix de vente (FCFA)", "Quantité en stock"], ["Robe", 15000, 2]];
    expect(
      pickBestSheet([
        { name: "Mode d'emploi", rows: guide },
        { name: "Mes produits", rows: products },
      ]),
    ).toBe(1);
  });

  it("dans un export Sama Stock, choisit l'onglet du stock plutôt que le détail des ventes", () => {
    const lines: Cell[][] = [
      ["Date et heure", "N° de vente", "Produit", "Catégorie", "Quantité", "Unité", "Prix unitaire", "Total"],
      ...Array.from({ length: 60 }, (_, i): Cell[] => ["01/10/2026", `V-${i}`, `Produit ${i % 5}`, "Cat", 1, "pièce", 1000, 1000]),
    ];
    const stock: Cell[][] = [
      ["Stock actuel"],
      [],
      ["Produit", "Référence", "Catégorie", "Unité", "En stock", "Disponible", "Seuil d'alerte", "Prix d'achat", "Prix de vente"],
      ...Array.from({ length: 5 }, (_, i): Cell[] => [`Produit ${i}`, "", "Cat", "pièce", 4, 4, 1, 500, 1000]),
    ];
    expect(
      pickBestSheet([
        { name: "Toutes les ventes", rows: lines },
        { name: "Stock actuel", rows: stock },
      ]),
    ).toBe(1);
  });

  it("reprend les colonnes choisies au dernier import pour un fichier de même forme", () => {
    const headers = ["Article", "Truc", "PV"];
    const guesses = autoMap(headers, [["Riz", "x", 500]]);
    expect(headerSignature(headers)).toBe("article|truc|pv");
    const applied = applySavedMapping(guesses, ["name", "category", "salePrice"]);
    expect(applied.map((g) => g.field)).toEqual(["name", "category", "salePrice"]);
    expect(applied[1]!.source).toBe("memoire");
    expect(applySavedMapping(guesses, ["name"])).toBe(guesses);
  });
});
