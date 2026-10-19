import type { PickerProduct } from "@/components/shared/product-picker";
import type { ProductRow } from "./products";

export function toPicker(rows: ProductRow[]): PickerProduct[] {
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    reference: p.reference,
    unit: p.unit,
    available: p.available,
    salePrice: p.salePrice,
    costPrice: p.costPrice,
    imageUrl: p.imageUrl,
  }));
}
