import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rappels de 9 h : relancée le même jour, la tâche ne renvoie pas le même rappel.
vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => {
  const journal: string[] = [];
  const where: unknown[] = [];
  let lectures: unknown[][] = [];
  /** Requête drizzle factice : chaque méthode se chaîne, `await` rend `resultat`. */
  function requete(resultat: unknown): unknown {
    const p: unknown = new Proxy(() => {}, {
      get(_cible, prop) {
        if (prop === "then") return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resultat).then(ok, ko);
        return (...args: unknown[]) => {
          if (prop === "where") where.push(args[0]);
          return p;
        };
      },
    });
    return p;
  }
  const tx = {
    execute: async () => {
      journal.push("verrou");
      return { rows: [] };
    },
    select: () => {
      journal.push("select");
      return requete(lectures.shift() ?? []);
    },
  };
  return {
    journal,
    where,
    lire: (l: unknown[][]) => {
      lectures = l;
    },
    db: { transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
    finsAbonnement: vi.fn(),
    notifySysteme: vi.fn(),
  };
});

vi.mock("@/db", () => ({ db: m.db }));
vi.mock("@/server/backup/key", () => ({ isBackupKeyValid: () => true }));
vi.mock("@/server/queries/assistant", () => ({ finsAbonnement: m.finsAbonnement }));
vi.mock("@/server/services/notifications", () => ({ notifySysteme: m.notifySysteme }));

const { GET } = await import("./route");

const appel = () => GET(new Request("https://exemple.sn/api/assistant/rappels"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T09:30:00Z"));
  m.journal.length = 0;
  m.where.length = 0;
  m.lire([]);
  // Fin dans 2 jours et demi : rappel « se termine bientôt »
  m.finsAbonnement.mockReset().mockResolvedValue([{ businessId: "biz-1", finLe: new Date("2026-11-22T21:00:00Z") }]);
  m.notifySysteme.mockReset().mockImplementation(async () => {
    m.journal.push("notification");
  });
});
afterEach(() => vi.useRealTimers());

describe("GET /api/assistant/rappels", () => {
  it("premier passage du jour : verrou, vérification, puis le rappel part", async () => {
    const res = await appel();
    expect(await res.json()).toEqual({ envoyes: 1 });
    expect(m.journal).toEqual(["verrou", "select", "notification"]);
    expect(m.notifySysteme).toHaveBeenCalledWith(expect.anything(), "biz-1", expect.objectContaining({ kind: "assistant", title: "Ton abonnement Finch se termine bientôt" }));
    const { sql, params } = new PgDialect().sqlToQuery(m.where[0] as SQL);
    expect(sql).toContain("now() - interval '20 hours'");
    expect(params).toEqual(["biz-1", "assistant", "Ton abonnement Finch se termine bientôt"]);
  });

  it("tâche relancée le même jour : le même rappel déjà envoyé ne repart pas", async () => {
    m.lire([[{ id: "notif-1" }]]);
    const res = await appel();
    expect(await res.json()).toEqual({ envoyes: 0 });
    expect(m.notifySysteme).not.toHaveBeenCalled();
  });

  it("aucun rappel dû : ni verrou ni lecture", async () => {
    m.finsAbonnement.mockResolvedValue([{ businessId: "biz-1", finLe: new Date("2026-12-20T09:00:00Z") }]);
    const res = await appel();
    expect(await res.json()).toEqual({ envoyes: 0 });
    expect(m.journal).toEqual([]);
  });
});
