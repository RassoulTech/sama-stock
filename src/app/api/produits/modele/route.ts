import { getContext, type BusinessContext } from "@/server/context";
import { workbookResponse } from "@/server/excel";
import { buildProductTemplate } from "@/server/reports/product-template";

/** Modèle Excel pour importer des produits (licences ; tout fichier est accepté à l'import). */
export async function GET() {
  const ctx = await getContext();
  // L'administrateur le télécharge aussi pendant l'installation chez un client
  if (ctx?.isSuperAdmin) return workbookResponse(buildProductTemplate(ctx.business?.name ?? "Sama Stock"), "modele-produits-sama-stock.xlsx");
  if (!ctx?.business) return new Response("Connectez-vous pour télécharger le modèle.", { status: 401 });
  if (!(ctx as BusinessContext).plan.limits.excel) {
    return new Response("L'import Excel est inclus dans toutes les licences.", { status: 403 });
  }
  return workbookResponse(buildProductTemplate(ctx.business.name), "modele-produits-sama-stock.xlsx");
}
