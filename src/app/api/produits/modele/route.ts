import { getContext } from "@/server/context";
import { workbookResponse } from "@/server/excel";
import { buildProductTemplate } from "@/server/reports/product-template";

/** Modèle Excel pour importer des produits (facultatif : tout fichier est accepté). */
export async function GET() {
  const ctx = await getContext();
  if (!ctx?.business) return new Response("Connectez-vous pour télécharger le modèle.", { status: 401 });
  return workbookResponse(buildProductTemplate(ctx.business.name), "modele-produits-sama-stock.xlsx");
}
