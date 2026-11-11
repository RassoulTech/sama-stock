import { describe, expect, it, vi } from "vitest";
import { voixPrete } from "./voix";

describe("voixPrete", () => {
  it("is ready when /health answers healthy", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "healthy" }), { status: 200 }));
    await expect(voixPrete("https://x.hf.space/", 1000, fetchImpl)).resolves.toBe(true);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe("https://x.hf.space/health");
  });
  it("is not ready while the space sleeps or fails", async () => {
    await expect(voixPrete("https://x.hf.space", 1000, vi.fn(async () => new Response("<html>", { status: 503 })))).resolves.toBe(false);
    await expect(voixPrete("https://x.hf.space", 1000, vi.fn(async () => { throw new TypeError("fetch failed"); }))).resolves.toBe(false);
  });
});
