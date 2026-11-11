import { describe, expect, it } from "vitest";
import { assistantDailyLimit, DEFAULT_DAILY_LIMIT, DEMO_DAILY_LIMIT } from "./limits";

describe("assistantDailyLimit", () => {
  it("uses 60 by default and 20 for a demo shop", () => {
    expect(assistantDailyLimit(undefined, false)).toBe(DEFAULT_DAILY_LIMIT);
    expect(DEFAULT_DAILY_LIMIT).toBe(60);
    expect(assistantDailyLimit(undefined, true)).toBe(DEMO_DAILY_LIMIT);
    expect(DEMO_DAILY_LIMIT).toBe(20);
  });
  it("follows ASSISTANT_DAILY_LIMIT when it is a positive integer", () => {
    expect(assistantDailyLimit("100", false)).toBe(100);
    expect(assistantDailyLimit("0", false)).toBe(60);
    expect(assistantDailyLimit("abc", false)).toBe(60);
    expect(assistantDailyLimit("12.5", false)).toBe(60);
  });
  it("never gives a demo more than the demo limit, nor more than the setting", () => {
    expect(assistantDailyLimit("100", true)).toBe(20);
    expect(assistantDailyLimit("5", true)).toBe(5);
  });
});
