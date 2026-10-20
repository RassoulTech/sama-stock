import { getContext, type BusinessContext } from "@/server/context";
import { workbookResponse } from "@/server/excel";
import { buildProductTemplate } from "@/server/reports/product-template";

/** Modèle Excel pour importer des produits (formules Pro et Business ; tout fichier est accepté à l'import). */
export async function GET() {
  const ctx = await getContext();
  if (!ctx?.business) return new Response("Connectez-vous pour télécharger le modèle.", { status: 401 });
  if (!(ctx as BusinessContext).plan.limits.excel) {
    return new Response("L'import Excel est inclus dans les formules Pro et Business.", { status: 403 });
  }
  return workbookResponse(buildProductTemplate(ctx.business.name), "modele-produits-sama-stock.xlsx");
}
