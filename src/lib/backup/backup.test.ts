import { describe, expect, it } from "vitest";
import { restoreImpact } from "./compare";
import { contentHash, countRows, isBackupPath, migrationNumber, parseRunId, runIdFor, shopFilePath, sortRows, type Manifest } from "./format";
import { filesToDelete, githubCopyMissing, runsToDelete } from "./retention";

describe("noms des passes", () => {
  it("écrit et relit le nom d'une passe", () => {
    const id = runIdFor("nuit", new Date("2026-10-29T02:04:05.123Z"));
    expect(id).toBe("2026-10-29T02-04-05Z-nuit");
    expect(parseRunId(id)).toEqual({ date: new Date("2026-10-29T02:04:05Z"), kind: "nuit" });
    expect(parseRunId("2026-10-29T02-04-05Z-avant-restauration")?.kind).toBe("avant-restauration");
    expect(parseRunId("n'importe quoi")).toBeNull();
  });
  it("n'accepte que des chemins du coffre", () => {
    expect(isBackupPath(shopFilePath("2026-10-29T02-04-05Z-nuit", "4db17195-b4e0-44cb-ac80-451a025d0c3f"))).toBe(true);
    expect(isBackupPath("sauvegardes/importes/fichier-AbC123.json.gz")).toBe(true);
    expect(isBackupPath("sauvegardes/../.env")).toBe(false);
    expect(isBackupPath("autre/fichier.json.gz")).toBe(false);
    expect(isBackupPath("sauvegardes/a b.json")).toBe(false);
  });
  it("lit le numéro d'une migration", () => {
    expect(migrationNumber("0012_pannes")).toBe(12);
    expect(migrationNumber("inconnu")).toBe(-1);
  });
});

describe("contenu", () => {
  it("trie les lignes pour que la même boutique donne la même empreinte", () => {
    const a = { sales: [{ id: "b", n: 2 }, { id: "a", n: 1 }], stockLevels: [{ productId: "p2", qty: 1 }, { productId: "p1", qty: 3 }] };
    const b = { sales: [{ id: "a", n: 1 }, { id: "b", n: 2 }], stockLevels: [{ productId: "p1", qty: 3 }, { productId: "p2", qty: 1 }] };
    const sort = (t: Record<string, Record<string, unknown>[]>) => Object.fromEntries(Object.entries(t).map(([k, rows]) => [k, sortRows(rows)]));
    expect(contentHash(sort(a))).toBe(contentHash(sort(b)));
    expect(contentHash(sort(a))).not.toBe(contentHash({ ...sort(a), sales: [] }));
    expect(countRows(a)).toEqual({ sales: 2, stockLevels: 2 });
  });
});

const run = (runId: string, state: "ok" | "partiel" | "echec" = "ok", githubAt: string | null = null) => ({ runId, state, githubAt });

describe("conservation", () => {
  const now = new Date("2026-10-29T03:00:00Z");
  it("garde 30 nuits, efface les plus vieilles (sauf la 1re du mois)", () => {
    const del = runsToDelete([run("2026-10-28T02-00-00Z-nuit"), run("2026-09-10T02-00-00Z-nuit"), run("2026-09-20T02-00-00Z-nuit"), run("2026-09-30T02-00-00Z-nuit")], now);
    expect(del).toEqual(["2026-09-20T02-00-00Z-nuit"]);
  });
  it("garde la première nuit réussie de chaque mois pendant un an", () => {
    const runs = [run("2026-08-01T02-00-00Z-nuit", "echec"), run("2026-08-02T02-00-00Z-nuit"), run("2026-08-03T02-00-00Z-nuit"), run("2025-09-01T02-00-00Z-nuit")];
    expect(runsToDelete(runs, now).sort()).toEqual(["2025-09-01T02-00-00Z-nuit", "2026-08-01T02-00-00Z-nuit", "2026-08-03T02-00-00Z-nuit"]);
  });
  it("garde 30 jours les passes manuelles et avant restauration, et ne touche pas aux noms inconnus", () => {
    const runs = [run("2026-10-01T10-00-00Z-manuelle"), run("2026-09-01T10-00-00Z-avant-restauration"), { runId: "bizarre", state: "ok" as const, githubAt: null }];
    expect(runsToDelete(runs, now)).toEqual(["2026-09-01T10-00-00Z-avant-restauration"]);
  });
  it("n'efface jamais un fichier encore utilisé par une passe gardée", () => {
    const kept: Manifest[] = [
      {
        format: 1, runId: "2026-10-28T02-00-00Z-nuit", kind: "nuit", startedAt: "", finishedAt: "", state: "ok", migration: "0012_pannes", errors: [],
        files: [{ type: "boutique", businessId: "x", name: "X", path: "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-x.json.gz", bytes: 1, sha256: "h", counts: {}, sameAs: "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-x.json.gz" }],
      },
    ];
    const files = ["sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-x.json.gz", "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-y.json.gz", "sauvegardes/2026-09-20T02-00-00Z-nuit/sommaire.json", "sauvegardes/2026-10-28T02-00-00Z-nuit/sommaire.json"];
    expect(filesToDelete(files, ["2026-09-20T02-00-00Z-nuit"], kept)).toEqual([
      "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-y.json.gz",
      "sauvegardes/2026-09-20T02-00-00Z-nuit/sommaire.json",
    ]);
  });
});

describe("copie GitHub", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  it("signale l'absence de copie depuis 48 h seulement s'il existe une nuit de plus de 48 h", () => {
    expect(githubCopyMissing([run("2026-10-29T02-00-00Z-nuit")], now)).toBe(false);
    expect(githubCopyMissing([run("2026-10-26T02-00-00Z-nuit"), run("2026-10-29T02-00-00Z-nuit")], now)).toBe(true);
    expect(githubCopyMissing([run("2026-10-26T02-00-00Z-nuit"), run("2026-10-28T02-00-00Z-nuit", "ok", "2026-10-28T03:40:00Z")], now)).toBe(false);
  });
});

describe("avant une restauration", () => {
  it("dit ce qui sera perdu ou retrouvé", () => {
    const lines = restoreImpact({ sales: 1228, products: 50, customers: 10, documents: 4 }, { sales: 1240, products: 50, customers: 12, documents: 6 });
    expect(lines.find((l) => l.key === "sales")).toEqual({ key: "sales", label: "Ventes", now: 1240, after: 1228, diff: -12 });
    expect(lines.find((l) => l.key === "products")?.diff).toBe(0);
    expect(lines.map((l) => l.key)).toEqual(["sales", "documents", "customers", "products", "purchases", "stockMovements", "customerPayments", "members"]);
  });
});
