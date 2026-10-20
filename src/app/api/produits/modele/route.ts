import { UNITS } from "@/lib/format";
import { IMPORT_FIELDS } from "@/lib/import/products";
import { getContext } from "@/server/context";
import { addTable, FCFA, newWorkbook, workbookResponse } from "@/server/excel";

/** Modèle Excel pour importer des produits (facultatif : tout fichier est accepté). */
export async function GET() {
  const ctx = await getContext();
  if (!ctx?.business) return new Response("Connectez-vous pour télécharger le modèle.", { status: 401 });

  const wb = newWorkbook();
  addTable(
    wb,
    "Produits",
    [
      { header: IMPORT_FIELDS.name, width: 30 },
      { header: IMPORT_FIELDS.reference, width: 14 },
      { header: IMPORT_FIELDS.category, width: 18 },
      { header: IMPORT_FIELDS.unit, width: 10 },
      { header: IMPORT_FIELDS.costPrice, width: 14, format: FCFA },
      { header: IMPORT_FIELDS.salePrice, width: 14, format: FCFA },
      { header: IMPORT_FIELDS.stock, width: 18 },
      { header: IMPORT_FIELDS.alertThreshold, width: 14 },
    ],
    [
      ["Robe wax longue", "RW-001", "Vêtements", "pièce", 9000, 15000, 20, 5],
      ["Riz parfumé 25 kg", "", "Alimentation", "sac", 14500, 16500, 12, 4],
      ["Huile 5 L", "HU-05", "Alimentation", "bouteille", 5200, 6000, 30, 10],
    ],
  );
  addTable(
    wb,
    "Unités acceptées",
    [
      { header: "Unité", width: 22 },
      { header: "À écrire dans le fichier", width: 26 },
    ],
    UNITS.map((u) => [u.name, u.singular]),
  );
  return workbookResponse(wb, "modele-produits-sama-stock.xlsx");
}
