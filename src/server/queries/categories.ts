import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { BusinessContext } from "../context";

/** Catégories avec leur nombre de produits actifs et la valeur de leur stock (au prix d'achat). */
export async function categoryOverview(ctx: BusinessContext) {
  const rows = await db.execute<{ id: string | null; name: string | null; product_count: number; stock_value: number }>(sql`
    select c.id, c.name,
           (select count(*)::int from products p
             where p.category_id = c.id and p.archived_at is null) as product_count,
           (select coalesce(sum(greatest(sl.quantity, 0) * p.cost_price), 0)::bigint
              from products p join stock_levels sl on sl.product_id = p.id
             where p.category_id = c.id and p.archived_at is null) as stock_value
    from categories c
    where c.business_id = ${ctx.business.id}
    union all
    select null, null,
           (select count(*)::int from products p
             where p.business_id = ${ctx.business.id} and p.category_id is null and p.archived_at is null),
           (select coalesce(sum(greatest(sl.quantity, 0) * p.cost_price), 0)::bigint
              from products p join stock_levels sl on sl.product_id = p.id
             where p.business_id = ${ctx.business.id} and p.category_id is null and p.archived_at is null)
  `);
  const all = rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: Number(r.product_count),
    stockValue: Number(r.stock_value),
  }));
  const named = all.filter((r): r is typeof r & { id: string; name: string } => r.id !== null && r.name !== null);
  named.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const uncategorized = all.find((r) => r.id === null) ?? { productCount: 0, stockValue: 0 };
  return { categories: named, uncategorized: { productCount: uncategorized.productCount, stockValue: uncategorized.stockValue } };
}
