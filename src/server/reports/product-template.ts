import "server-only";
import { UNITS } from "@/lib/format";
import { unitAliases } from "@/lib/import/products";
import { COLORS, font, newWorkbook, sectionTitle, startSheet, writeTable, type Column } from "../excel";

const SHEET = "Mes produits";
const ROWS = 300;

/** Titres reconnus tels quels par l'import (voir SYNONYMS dans lib/import/products). */
const COLUMNS: (Column & { help: string; example: string })[] = [
  { header: "Nom du produit", width: 34, help: "Obligatoire. Le nom affiché en caisse et sur les reçus.", example: "Robe wax longue" },
  { header: "Référence ou code-barres", width: 18, help: "Facultatif. Votre code à vous, ou le code-barres du produit.", example: "RW-001" },
  { header: "Catégorie", width: 20, help: "Facultatif. La famille du produit. Les catégories qui n'existent pas encore sont créées.", example: "Vêtements" },
  { header: "Unité", width: 13, help: "Choisissez dans la liste (pièce, kg, sac, carton…). Laissez vide pour « pièce ».", example: "pièce" },
  { header: "Prix d'achat (FCFA)", width: 15, format: "#,##0", help: "Ce que vous payez au fournisseur pour 1 unité.", example: "9000" },
  { header: "Prix de vente (FCFA)", width: 15, format: "#,##0", help: "Le prix payé par vos clients pour 1 unité.", example: "15000" },
  { header: "Quantité en stock", width: 13, help: "Combien vous en avez aujourd'hui dans la boutique.", example: "20" },
  { header: "Seuil d'alerte (stock bas)", width: 15, help: "Sama Stock vous prévient quand il n'en reste plus que ce nombre.", example: "5" },
];

const EXAMPLES: unknown[][] = [
  ["Robe wax longue (exemple)", "RW-001", "Vêtements", "pièce", 9000, 15000, 20, 5],
  ["Riz parfumé 25 kg (exemple)", "", "Alimentation", "sac", 14500, 16500, 12, 4],
  ["Tissu bazin au mètre (exemple)", "BZ-12", "Tissus", "m", 2500, 4000, 35.5, 10],
];

/** Modèle Excel pour importer des produits : une feuille à remplir, une feuille de mode d'emploi. */
export function buildProductTemplate(business: string) {
  const wb = newWorkbook("Modèle d'import de produits · Sama Stock");
  const meta = { business, period: "modèle pour importer vos produits" };

  // 1. La feuille à remplir
  const { ws, row } = startSheet(wb, {
    name: SHEET,
    title: "Mes produits",
    intro:
      "Une ligne par produit. Seul le nom est obligatoire. Les lignes qui finissent par « (exemple) » ne sont jamais importées : remplacez-les ou laissez-les. Passez la souris sur un titre pour voir à quoi sert la colonne.",
    meta,
    widths: COLUMNS.map((c) => c.width),
  });
  const blank = Array.from({ length: ROWS - EXAMPLES.length }, () => COLUMNS.map(() => null));
  writeTable(
    ws,
    row,
    COLUMNS.map((c) => ({ ...c, note: c.help })),
    [...EXAMPLES, ...blank],
    {
      freeze: true,
      styleRow: (r, data) => {
        if (typeof data[0] === "string" && data[0].endsWith("(exemple)")) {
          r.eachCell({ includeEmpty: true }, (cell) => (cell.font = font({ italic: true, color: { argb: COLORS.muted } })));
        }
      },
    },
  );
  const units = UNITS.map((u) => u.singular).join(",");
  for (let r = row + 1; r <= row + ROWS; r++) {
    ws.getCell(r, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${units}"`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Unité inconnue",
      error: "Choisissez une unité de la liste (sinon « pièce » sera utilisée).",
    };
    for (const c of [5, 6, 7, 8]) {
      ws.getCell(r, c).dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Nombre attendu",
        error: "Écrivez seulement un nombre, sans « FCFA » ni espace : par exemple 15000.",
      };
    }
  }

  // 2. Le mode d'emploi
  const guide = startSheet(wb, {
    name: "Mode d'emploi",
    title: "Comment remplir ce fichier",
    meta,
    widths: [26, 58, 22],
    tabColor: COLORS.saffron,
  });
  const g = guide.ws;
  let r = guide.row;
  const steps = [
    `Remplissez l'onglet « ${SHEET} » : une ligne par produit.`,
    "Enregistrez le fichier (Excel ou CSV).",
    "Dans Sama Stock, ouvrez Produits, puis « Importer (Excel) », et déposez le fichier.",
    "Vérifiez l'aperçu, puis cliquez sur « Importer ». Rien n'est enregistré avant.",
  ];
  sectionTitle(g, r++, "En 4 étapes", 3);
  steps.forEach((s, i) => {
    g.mergeCells(r, 1, r, 3);
    const cell = g.getCell(r, 1);
    cell.value = `${i + 1}.  ${s}`;
    cell.font = font({ size: 11 });
    cell.alignment = { vertical: "middle", wrapText: true };
    g.getRow(r).height = 22;
    r++;
  });
  r++;
  sectionTitle(g, r++, "Les colonnes", 3);
  r = writeTable(
    g,
    r,
    [
      { header: "Colonne", width: 26 },
      { header: "À quoi elle sert", width: 58 },
      { header: "Exemple", width: 22 },
    ],
    COLUMNS.map((c) => [c.header, c.help, c.example]),
    { styleRow: (row) => (row.getCell(1).font = font({ bold: true })) },
  );
  sectionTitle(g, r++, "Les unités acceptées", 3);
  r = writeTable(
    g,
    r,
    [
      { header: "Unité", width: 26 },
      { header: "Vous pouvez aussi écrire", width: 58 },
      { header: "Quantités à virgule", width: 22 },
    ],
    UNITS.map((u) => [u.singular, unitAliases(u.id).join(", "), u.decimals ? "Oui (ex. 1,5)" : "Non"]),
  );
  sectionTitle(g, r++, "Bon à savoir", 3);
  for (const tip of [
    "Les prix peuvent s'écrire 15000, 15 000, 15.000 ou 15 000 FCFA : ils sont tous bien lus.",
    "Vous avez déjà votre propre fichier ? Importez-le directement : Sama Stock reconnaît les colonnes, même avec d'autres titres.",
    "Les produits déjà présents (même nom ou même référence) peuvent être laissés tels quels ou mis à jour.",
    "Le stock est ajouté à la boutique dans laquelle vous êtes connecté.",
  ]) {
    g.mergeCells(r, 1, r, 3);
    const cell = g.getCell(r, 1);
    cell.value = `•   ${tip}`;
    cell.font = font({ size: 10.5 });
    cell.alignment = { vertical: "middle", wrapText: true };
    g.getRow(r).height = 20;
    r++;
  }
  return wb;
}
