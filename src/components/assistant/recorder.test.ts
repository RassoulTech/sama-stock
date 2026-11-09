// src/components/assistant/recorder.test.ts
import { describe, expect, it } from "vitest";
import { encodeWav, toBase64 } from "./recorder";

const text = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header", () => {
    const view = new DataView(encodeWav(new Float32Array(10), 16000));
    expect(view.byteLength).toBe(44 + 20);
    expect(text(view, 0, 4)).toBe("RIFF");
    expect(text(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(20);
  });
  it("clips samples to the 16-bit range", () => {
    const view = new DataView(encodeWav(new Float32Array([1.5, -1, 0]), 16000));
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(0);
  });
});

describe("toBase64", () => {
  it("encodes large buffers in chunks without loss", () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    expect(Buffer.from(toBase64(bytes.buffer), "base64").equals(Buffer.from(bytes))).toBe(true);
  });
});
