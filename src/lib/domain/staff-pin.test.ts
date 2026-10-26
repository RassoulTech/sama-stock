import { describe, expect, it } from "vitest";
import {
  generatePin,
  isLocked,
  isStaffEmail,
  isValidPin,
  isWeakPin,
  minutesLeft,
  PIN_LOCK_MINUTES,
  PIN_MAX_FAILURES,
  pinFailureState,
  staffEmail,
} from "./staff-pin";

const NOW = new Date("2026-10-26T10:00:00Z");

describe("code PIN", () => {
  it("accepte exactement 4 chiffres", () => {
    expect(isValidPin("4821")).toBe(true);
    expect(isValidPin("482")).toBe(false);
    expect(isValidPin("48210")).toBe(false);
    expect(isValidPin("48a1")).toBe(false);
  });
  it("refuse les codes trop faciles", () => {
    for (const pin of ["0000", "7777", "1234", "2345", "4321", "9876"]) expect(isWeakPin(pin)).toBe(true);
    for (const pin of ["4821", "1357", "2580", "1123"]) expect(isWeakPin(pin)).toBe(false);
  });
  it("génère toujours un code valide et jamais faible", () => {
    for (let i = 0; i < 200; i++) {
      const pin = generatePin();
      expect(isValidPin(pin)).toBe(true);
      expect(isWeakPin(pin)).toBe(false);
    }
  });
  it("retire un tirage faible et en refait un", () => {
    const draws = [1, 1, 1, 1, 4, 8, 2, 1];
    expect(generatePin(() => draws.shift()!)).toBe("4821");
  });
});

describe("blocage après des codes faux", () => {
  it("compte les échecs puis bloque 15 minutes", () => {
    let state = { failures: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < PIN_MAX_FAILURES; i++) {
      state = pinFailureState(state.failures, NOW);
      expect(state).toEqual({ failures: i, lockedUntil: null });
    }
    state = pinFailureState(state.failures, NOW);
    expect(state.failures).toBe(0);
    expect(state.lockedUntil?.getTime()).toBe(NOW.getTime() + PIN_LOCK_MINUTES * 60_000);
  });
  it("sait si le compte est encore bloqué et combien de minutes il reste", () => {
    const until = new Date(NOW.getTime() + 10 * 60_000 + 1);
    expect(isLocked(until, NOW)).toBe(true);
    expect(isLocked(new Date(NOW.getTime() - 1), NOW)).toBe(false);
    expect(isLocked(null, NOW)).toBe(false);
    expect(minutesLeft(until, NOW)).toBe(11);
  });
});

describe("adresse technique des employés", () => {
  it("est reconnaissable et jamais une vraie adresse", () => {
    const email = staffEmail("AbC123");
    expect(email).toBe("abc123@employes.sama-stock.invalid");
    expect(isStaffEmail(email)).toBe(true);
    expect(isStaffEmail("awa@gmail.com")).toBe(false);
  });
});
