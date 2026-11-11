import { describe, expect, it, vi } from "vitest";
import { dansLaBulle, garderBulle } from "./garde-bulle";

const element = (dedans: boolean) => ({ closest: (s: string) => (dedans && s === "[data-assistant-bulle]" ? {} : null) });

describe("garde de la bulle", () => {
  it("recognises a touch on the assistant bubble, directly or through Radix", () => {
    expect(dansLaBulle({ target: element(true) as never })).toBe(true);
    expect(dansLaBulle({ target: null, detail: { originalEvent: { target: element(true) as never } } })).toBe(true);
    expect(dansLaBulle({ target: element(false) as never })).toBe(false);
    expect(dansLaBulle({ target: null })).toBe(false);
  });
  it("keeps the window open for the bubble and calls the screen's handler otherwise", () => {
    const suite = vi.fn();
    const garde = garderBulle(suite);
    const dedans = { target: element(true), preventDefault: vi.fn() };
    garde(dedans as never);
    expect(dedans.preventDefault).toHaveBeenCalled();
    expect(suite).not.toHaveBeenCalled();
    const dehors = { target: element(false), preventDefault: vi.fn() };
    garde(dehors as never);
    expect(dehors.preventDefault).not.toHaveBeenCalled();
    expect(suite).toHaveBeenCalledWith(dehors);
  });
});
