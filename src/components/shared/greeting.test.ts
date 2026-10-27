import { describe, expect, it } from "vitest";
import { greetingFor } from "./greeting";

describe("Bonjour ou Bonsoir", () => {
  it("dit Bonjour de 5 h à 17 h 59, Bonsoir le reste du temps", () => {
    expect(greetingFor(5)).toBe("Bonjour");
    expect(greetingFor(11)).toBe("Bonjour");
    expect(greetingFor(17)).toBe("Bonjour");
    expect(greetingFor(18)).toBe("Bonsoir");
    expect(greetingFor(23)).toBe("Bonsoir");
    expect(greetingFor(0)).toBe("Bonsoir");
    expect(greetingFor(4)).toBe("Bonsoir");
  });
});
