import { eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ADMIN_MANAGED_BUSINESS_KEYS } = await import("./tables");
const { businesses } = await import("@/db/schema");

describe("fiche du commerce dans les sauvegardes", () => {
  it("ne garde que des colonnes du commerce (assistant_enabled n'en est plus une)", () => {
    const colonnes = Object.keys(getTableColumns(businesses));
    for (const k of ADMIN_MANAGED_BUSINESS_KEYS) expect(colonnes).toContain(k);
    expect(colonnes).not.toContain("assistantEnabled");
  });

  it("une ancienne sauvegarde qui contient encore assistantEnabled se restaure : la clé est ignorée", () => {
    const ancienne = { name: "Awa Mode", assistantEnabled: true };
    const { sql } = drizzle.mock().update(businesses).set(ancienne as never).where(eq(businesses.id, "biz-1")).toSQL();
    expect(sql).toContain('"name" = $1');
    expect(sql).not.toContain("assistant_enabled");
  });
});
