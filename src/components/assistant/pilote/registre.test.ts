import { afterEach, describe, expect, it } from "vitest";
import { attendrePilote, enregistrerPilote, lirePilote, viderRegistre } from "./registre";
import type { PiloteFiche } from "./types";

const fiche = (): PiloteFiche => ({ ouvrir: () => {}, champ: () => {}, enregistrer: async () => ({ ok: true, message: "ok" }) });

afterEach(viderRegistre);

describe("registre des pilotes", () => {
  it("returns the registered pilot, then nothing once its screen is gone", () => {
    const p = fiche();
    const retirer = enregistrerPilote("client", p);
    expect(lirePilote("client")).toBe(p);
    retirer();
    expect(lirePilote("client")).toBeNull();
  });
  it("keeps the newest screen when an old one unmounts late", () => {
    const ancien = fiche();
    const nouveau = fiche();
    const retirerAncien = enregistrerPilote("client", ancien);
    enregistrerPilote("client", nouveau);
    retirerAncien();
    expect(lirePilote("client")).toBe(nouveau);
  });
  it("waits for a screen that appears later", async () => {
    const p = fiche();
    setTimeout(() => enregistrerPilote("fournisseur", p), 10);
    await expect(attendrePilote("fournisseur", 500)).resolves.toBe(p);
  });
  it("gives up after the delay", async () => {
    await expect(attendrePilote("vente", 20)).resolves.toBeNull();
  });
});
