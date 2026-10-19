import { describe, expect, it } from "vitest";
import { describeDevice } from "./user-agent";

describe("describeDevice", () => {
  it("recognises Chrome on Android", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
    expect(describeDevice(ua)).toEqual({ browser: "Chrome", os: "Android", mobile: true });
  });

  it("recognises Safari on iPhone", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    expect(describeDevice(ua)).toMatchObject({ browser: "Safari", os: "iPhone / iPad", mobile: true });
  });

  it("recognises Edge on Windows before Chrome", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0";
    expect(describeDevice(ua)).toEqual({ browser: "Edge", os: "Windows", mobile: false });
  });

  it("handles a missing user agent", () => {
    expect(describeDevice(null)).toEqual({ browser: "Inconnu", os: "Inconnu", mobile: false });
  });
});
