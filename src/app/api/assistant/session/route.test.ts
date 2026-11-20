import { beforeEach, describe, expect, it, vi } from "vitest";

// Règle protégée : on ne paie jamais une conversation qui n'a pas eu lieu (le crédit revient, une seule fois).
vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  contexteAssistant: vi.fn(),
  ouvrirConversation: vi.fn(),
  rendreCredit: vi.fn(),
  prevenirSiPeuDeCredits: vi.fn(),
  consumeAssistantQuota: vi.fn(),
  listProducts: vi.fn(),
  creerJetonDirect: vi.fn(),
}));

vi.mock("@/server/assistant/contexte", () => ({
  contexteAssistant: m.contexteAssistant,
  NO_STORE: { "Cache-Control": "no-store" },
  refuser: (error: string, status: number) => Response.json({ error }, { status }),
  accesEcrans: () => ({ reports: false, products: true, orders: false, customers: false }),
  outilsDirects: () => [],
}));
vi.mock("@/server/assistant/abonnement", () => ({
  ouvrirConversation: m.ouvrirConversation,
  rendreCredit: m.rendreCredit,
  prevenirSiPeuDeCredits: m.prevenirSiPeuDeCredits,
}));
vi.mock("@/server/assistant/usage", () => ({ consumeAssistantQuota: m.consumeAssistantQuota }));
vi.mock("@/server/queries/products", () => ({ listProducts: m.listProducts }));
vi.mock("@/server/assistant/direct", () => {
  class GeminiError extends Error {
    constructor(
      readonly kind: string,
      message: string,
      readonly status?: number,
    ) {
      super(message);
    }
  }
  return { GeminiError, creerJetonDirect: m.creerJetonDirect };
});

const { POST } = await import("./route");
const { GeminiError } = await import("@/server/assistant/direct");

const ctx = { business: { name: "Awa Mode", isDemo: false }, role: "owner", can: () => true };
const ouverte = { ok: true, moisId: "mois-1", restants: 42, genre: "abonnement" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.GEMINI_API_KEY = "cle-de-test";
  m.contexteAssistant.mockResolvedValue({ ok: true, ctx });
  m.ouvrirConversation.mockResolvedValue(ouverte);
  m.rendreCredit.mockResolvedValue(undefined);
  m.prevenirSiPeuDeCredits.mockResolvedValue(undefined);
  m.consumeAssistantQuota.mockResolvedValue({ allowed: true, count: 1, limit: 60 });
  m.listProducts.mockResolvedValue([]);
  m.creerJetonDirect.mockResolvedValue({ token: "jeton", model: "modele" });
});

describe("POST /api/assistant/session", () => {
  it("succès : 200 avec le compteur, aucun crédit rendu", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ token: "jeton", credits: { restants: 42, essai: false } });
    expect(m.rendreCredit).not.toHaveBeenCalled();
  });

  it("limite du jour atteinte : 429 et le crédit revient une fois", async () => {
    m.consumeAssistantQuota.mockResolvedValue({ allowed: false, count: 61, limit: 60 });
    const res = await POST();
    expect(res.status).toBe(429);
    expect(m.rendreCredit).toHaveBeenCalledTimes(1);
    expect(m.rendreCredit).toHaveBeenCalledWith("mois-1");
    expect(m.creerJetonDirect).not.toHaveBeenCalled();
  });

  it("catalogue illisible : l'erreur remonte et le crédit revient une fois", async () => {
    m.listProducts.mockRejectedValue(new Error("base en panne"));
    await expect(POST()).rejects.toThrow("base en panne");
    expect(m.rendreCredit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["quota", 429],
    ["indisponible", 503],
  ])("Google refuse (%s) : 503 et le crédit revient une fois", async (kind, status) => {
    m.creerJetonDirect.mockRejectedValue(new GeminiError(kind as never, "refus", status));
    const res = await POST();
    expect(res.status).toBe(503);
    expect(m.rendreCredit).toHaveBeenCalledTimes(1);
    expect(m.prevenirSiPeuDeCredits).not.toHaveBeenCalled();
  });

  it("erreur ordinaire pendant la création du jeton : elle remonte et le crédit revient une fois", async () => {
    m.creerJetonDirect.mockRejectedValue(new Error("bug"));
    await expect(POST()).rejects.toThrow("bug");
    expect(m.rendreCredit).toHaveBeenCalledTimes(1);
  });

  it("l'alerte de crédits en panne n'empêche pas la conversation et ne rend rien", async () => {
    m.prevenirSiPeuDeCredits.mockRejectedValue(new Error("notification en panne"));
    const res = await POST();
    expect(res.status).toBe(200);
    expect(m.rendreCredit).not.toHaveBeenCalled();
  });

  it("pas de crédit : 402, la limite du jour n'est pas consommée, rien à rendre", async () => {
    m.ouvrirConversation.mockResolvedValue({ ok: false, etat: { statut: "epuise", offre: "pro", mois: null, restants: 0, total: 250, finLe: null } });
    const res = await POST();
    expect(res.status).toBe(402);
    expect(m.consumeAssistantQuota).not.toHaveBeenCalled();
    expect(m.rendreCredit).not.toHaveBeenCalled();
  });

  it("démonstration : pas de crédit, donc rien à rendre en cas d'échec, et pas de compteur en cas de succès", async () => {
    m.ouvrirConversation.mockResolvedValue({ ok: true, moisId: null, restants: null, genre: null });
    expect(((await (await POST()).json()) as { credits: unknown }).credits).toBeNull();
    m.creerJetonDirect.mockRejectedValue(new GeminiError("indisponible" as never, "refus", 503));
    const res = await POST();
    expect(res.status).toBe(503);
    expect(m.rendreCredit.mock.calls.every(([id]) => id === null)).toBe(true);
  });
});
