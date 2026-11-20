import type { SQL } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Saisies de Finch par l'administrateur : verrou du commerce d'abord, lectures dans la transaction, gardes en base.
// Pas de base ici : une fausse transaction note chaque requête dans l'ordre.
vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => {
  /** Requête drizzle factice : chaque méthode se chaîne, `await` rend `resultat`. */
  function requete(resultat: unknown, surAppel?: (methode: string, args: unknown[]) => void): unknown {
    const p: unknown = new Proxy(() => {}, {
      get(_cible, prop) {
        if (prop === "then") return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resultat).then(ok, ko);
        return (...args: unknown[]) => {
          surAppel?.(String(prop), args);
          return p;
        };
      },
    });
    return p;
  }
  return {
    requete,
    journal: [] as string[],
    /** Réponses des `select` de la transaction, dans l'ordre. */
    lectures: [] as unknown[][],
    /** Réponses des `select` hors transaction, dans l'ordre. */
    horsTransaction: [] as unknown[][],
    /** Réponse des `delete … returning` et `update … returning`, par table. */
    rendus: {} as Record<string, unknown[]>,
    /** Arguments de `values` et `where`, par table. */
    appels: [] as { table: string; methode: string; args: unknown[] }[],
    tx: null as unknown,
    moisDuCommerce: vi.fn(),
    logAdmin: vi.fn(),
  };
});

vi.mock("@/db", async () => {
  const { getTableName: nom } = await import("drizzle-orm");
  const { PgDialect: Dialecte } = await import("drizzle-orm/pg-core");
  const dialecte = new Dialecte();
  const ecriture = (genre: string) => (table: PgTable) => {
    const t = nom(table);
    m.journal.push(`${genre} ${t}`);
    return m.requete(m.rendus[t] ?? [], (methode, args) => m.appels.push({ table: t, methode, args }));
  };
  const tx = {
    execute: async (q: SQL) => {
      const { params } = dialecte.sqlToQuery(q);
      m.journal.push(`${dialecte.sqlToQuery(q).sql.includes("pg_advisory_xact_lock") ? "verrou" : "sql"} ${params.join(",")}`);
      return { rows: [] };
    },
    select: () => {
      m.journal.push("select");
      return m.requete(m.lectures.shift() ?? []);
    },
    insert: ecriture("insert"),
    update: ecriture("update"),
    delete: ecriture("delete"),
  };
  m.tx = tx;
  return {
    db: {
      select: () => m.requete(m.horsTransaction.shift() ?? []),
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        m.journal.push("BEGIN");
        try {
          const r = await fn(tx);
          m.journal.push("COMMIT");
          return r;
        } catch (e) {
          m.journal.push("ROLLBACK");
          throw e;
        }
      },
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/context", () => ({ requireSuperAdminAction: async () => ({ isSuperAdmin: true, user: { id: "admin-1", email: "admin@exemple.sn" } }) }));
vi.mock("@/server/services/admin-audit", () => ({ logAdmin: m.logAdmin }));
vi.mock("@/server/queries/assistant", () => ({ moisDuCommerce: m.moisDuCommerce }));

const { adminActiverAssistant, adminAnnulerPaiementAssistant, adminRenouvelerAssistant } = await import("./assistant-abonnement");

const d = (s: string) => new Date(s);
const commerce = { isDemo: false, plan: "trial", trialEndsAt: null, suspendedAt: null, licensePack: "pro", maintenanceEndsAt: null };
const saisie = { months: 1, amount: 10_000, method: "wave" as const };
const moisPaye = { id: "m-1", kind: "abonnement", startsAt: d("2026-11-05T08:00:00Z"), endsAt: d("2026-12-05T08:00:00Z"), credits: 250, extraCredits: 0, used: 0 };
const valeurs = (table: string, methode: string) => m.appels.filter((a) => a.table === table && a.methode === methode).map((a) => a.args[0]);
const enSql = (q: unknown) => new PgDialect().sqlToQuery(q as SQL).sql;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(d("2026-11-20T10:00:00Z"));
  m.journal.length = 0;
  m.lectures = [];
  m.horsTransaction = [];
  m.rendus = {};
  m.appels.length = 0;
  m.moisDuCommerce.mockReset();
  m.moisDuCommerce.mockImplementation(async (_id: string, exec: unknown) => {
    m.journal.push(exec === m.tx ? "mois (transaction)" : "mois (hors transaction)");
    return [];
  });
  m.logAdmin.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("activation et renouvellement", () => {
  it("double clic sur « Activer » : la seconde saisie lit l'activation après le verrou et ne crée rien", async () => {
    m.horsTransaction = [[commerce]];
    m.lectures = [[{ id: "pay-1" }]]; // la première saisie vient de valider son activation
    const res = await adminActiverAssistant("biz-1", saisie);
    expect(res).toEqual({ ok: false, error: "Finch est déjà activé : utilisez « Renouveler »." });
    expect(m.journal).toEqual(["BEGIN", "verrou finch:biz-1", "select", "ROLLBACK"]);
  });

  it("renouvellement : les mois se lisent dans la transaction, après le verrou, et le nouveau suit le dernier", async () => {
    m.horsTransaction = [[commerce]];
    m.lectures = [[{ id: "pay-1" }]];
    m.rendus = { assistant_payments: [{ id: "pay-2" }] };
    m.moisDuCommerce.mockImplementation(async (_id: string, exec: unknown) => {
      m.journal.push(exec === m.tx ? "mois (transaction)" : "mois (hors transaction)");
      return [{ ...moisPaye, paymentId: "pay-1" }];
    });
    const res = await adminRenouvelerAssistant("biz-1", saisie);
    expect(res).toEqual({ ok: true, data: null });
    expect(m.journal).toEqual([
      "BEGIN",
      "verrou finch:biz-1",
      "select",
      "mois (transaction)",
      "insert assistant_payments",
      "insert assistant_months",
      "COMMIT",
    ]);
    expect(valeurs("assistant_months", "values")).toEqual([
      [expect.objectContaining({ startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z"), paymentId: "pay-2" })],
    ]);
  });

  it("renouvellement sans activation : refusé dans la transaction", async () => {
    m.horsTransaction = [[commerce]];
    m.lectures = [[]];
    const res = await adminRenouvelerAssistant("biz-1", saisie);
    expect(res).toEqual({ ok: false, error: "Activez d'abord Finch (activation et premiers mois)." });
    expect(m.journal).toEqual(["BEGIN", "verrou finch:biz-1", "select", "ROLLBACK"]);
  });
});

describe("annulation d'un paiement", () => {
  const paiement = { id: "pay-2", businessId: "biz-1", kind: "mois", months: 1, credits: 0, amount: 10_000, paidAt: d("2026-11-20T09:00:00Z") };
  beforeEach(() => {
    m.horsTransaction = [[{ businessId: "biz-1" }]];
    m.lectures = [[paiement], [{ id: "pay-2" }]];
    m.moisDuCommerce.mockImplementation(async (_id: string, exec: unknown) => {
      m.journal.push(exec === m.tx ? "mois (transaction)" : "mois (hors transaction)");
      return [{ ...moisPaye, id: "m-2", startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z"), paymentId: "pay-2" }];
    });
  });

  it("mois intacts : verrou, lectures, puis mois (garde used = 0) et paiement supprimés", async () => {
    m.rendus = { assistant_months: [{ id: "m-2" }] };
    const res = await adminAnnulerPaiementAssistant("pay-2");
    expect(res).toEqual({ ok: true, data: null });
    expect(m.journal).toEqual([
      "BEGIN",
      "verrou finch:biz-1",
      "select",
      "select",
      "mois (transaction)",
      "delete assistant_months",
      "delete assistant_payments",
      "COMMIT",
    ]);
    expect(enSql(valeurs("assistant_months", "where")[0])).toContain('"assistant_months"."used" = $');
    expect(m.logAdmin).toHaveBeenCalledTimes(1);
  });

  it("une conversation ouverte entre-temps (mois plus intact en base) : rien n'est annulé", async () => {
    m.rendus = { assistant_months: [] }; // la garde used = 0 écarte le mois
    const res = await adminAnnulerPaiementAssistant("pay-2");
    expect(res).toEqual({ ok: false, error: "Des conversations ont déjà été utilisées avec ce paiement : il ne peut plus être annulé." });
    expect(m.journal.at(-1)).toBe("ROLLBACK");
    expect(m.journal).not.toContain("delete assistant_payments");
    expect(m.logAdmin).not.toHaveBeenCalled();
  });

  it("double clic sur « Annuler » : la seconde voit le paiement disparu après le verrou", async () => {
    m.lectures = [[]];
    const res = await adminAnnulerPaiementAssistant("pay-2");
    expect(res).toEqual({ ok: false, error: "Ce paiement vient d'être annulé." });
    expect(m.journal).toEqual(["BEGIN", "verrou finch:biz-1", "select", "ROLLBACK"]);
  });
});
