"use server";

import { revalidatePath } from "next/cache";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { importInputSchema, importProductRows, type ImportBatchInput, type ImportBatchResult } from "../services/product-import";

export type { ImportBatchInput, ImportBatchResult } from "../services/product-import";

export async function importProductsBatch(input: ImportBatchInput) {
  return runAction<ImportBatchResult>(async () => {
    const ctx = await requireActionContext("products.manage");
    if (!ctx.plan.limits.excel) {
      throw new ActionError("L'import depuis Excel est inclus dans les formules Pro et Business.");
    }
    const result = await importProductRows(
      {
        businessId: ctx.business.id,
        locationId: ctx.location.id,
        userId: ctx.user.id,
        maxProducts: ctx.plan.limits.maxProducts,
        planLabel: ctx.plan.label,
      },
      parse(importInputSchema, input),
    );
    revalidatePath("/produits");
    revalidatePath("/categories");
    revalidatePath("/tableau-de-bord");
    return result;
  });
}
