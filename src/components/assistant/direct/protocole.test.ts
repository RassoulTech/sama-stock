import { describe, expect, it } from "vitest";
import {
  base64VersFloat32,
  lireMessage,
  messageAudio,
  messageDemarrage,
  messageReponseOutil,
  messageTexte,
  pcmVersBase64,
  urlDirect,
  versPcm16,
} from "./protocole";

describe("lireMessage", () => {
  it("reads the end of setup", () => {
    expect(lireMessage('{"setupComplete":{}}')).toEqual([{ type: "pret" }]);
  });
  it("reads voice chunks, the end of a turn and transcriptions", () => {
    const brut = JSON.stringify({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAA=" } }, { text: "pensée" }] },
        outputTranscription: { text: "Bonjour" },
        inputTranscription: { text: "Salam" },
        turnComplete: true,
      },
    });
    expect(lireMessage(brut)).toEqual([
      { type: "audio", donnees: "AAA=" },
      { type: "transcription", qui: "assistant", texte: "Bonjour" },
      { type: "transcription", qui: "commercant", texte: "Salam" },
      { type: "fin-de-tour" },
    ]);
  });
  it("reads an interruption", () => {
    expect(lireMessage('{"serverContent":{"interrupted":true}}')).toEqual([{ type: "interrompu" }]);
  });
  it("reads tool calls and their cancellation", () => {
    expect(lireMessage('{"toolCall":{"functionCalls":[{"id":"fc1","name":"resume_ventes","args":{"periode":"aujourdhui"}},{"id":"fc2","name":"montrer_ecran"}]}}')).toEqual([
      {
        type: "outils",
        appels: [
          { id: "fc1", name: "resume_ventes", args: { periode: "aujourdhui" } },
          { id: "fc2", name: "montrer_ecran", args: {} },
        ],
      },
    ]);
    expect(lireMessage('{"toolCallCancellation":{"ids":["fc1"]}}')).toEqual([{ type: "outils-annules", ids: ["fc1"] }]);
  });
  it("reads the end of session and errors, and ignores what it does not know", () => {
    expect(lireMessage('{"goAway":{"timeLeft":"10s"}}')).toEqual([{ type: "depart" }]);
    expect(lireMessage('{"error":{"message":"quota"}}')).toEqual([{ type: "erreur", message: "quota" }]);
    expect(lireMessage('{"usageMetadata":{}}')).toEqual([]);
    expect(lireMessage("pas du json")).toEqual([{ type: "erreur", message: "Message illisible." }]);
  });
});

describe("messages envoyés", () => {
  it("opens the constrained session with an empty setup (the key fixes everything)", () => {
    expect(JSON.parse(messageDemarrage())).toEqual({ setup: {} });
    expect(urlDirect("auth_tokens/a b")).toBe(
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=auth_tokens%2Fa%20b",
    );
  });
  it("sends microphone audio, tool answers and text notes", () => {
    expect(JSON.parse(messageAudio("QUJD"))).toEqual({ realtimeInput: { audio: { data: "QUJD", mimeType: "audio/pcm;rate=16000" } } });
    expect(JSON.parse(messageReponseOutil("fc1", "resume_ventes", { chiffre: 1 }))).toEqual({
      toolResponse: { functionResponses: [{ id: "fc1", name: "resume_ventes", response: { chiffre: 1 } }] },
    });
    expect(JSON.parse(messageTexte("(note)"))).toEqual({ clientContent: { turns: [{ role: "user", parts: [{ text: "(note)" }] }], turnComplete: true } });
  });
});

describe("conversions du son", () => {
  it("brings 48 kHz down to 16 kHz in 16-bit, clamping the peaks", () => {
    const source = Float32Array.from({ length: 48 }, (_, i) => (i < 24 ? 0.5 : 2));
    const pcm = versPcm16(source, 48_000);
    expect(pcm.length).toBe(16);
    expect(pcm[0]).toBe(Math.round(0.5 * 0x7fff));
    expect(pcm[15]).toBe(0x7fff);
  });
  it("keeps 16 kHz as is", () => {
    expect(versPcm16(Float32Array.from([0, -1]), 16_000)).toEqual(Int16Array.from([0, -0x8000]));
  });
  it("round-trips PCM through base64", () => {
    const pcm = Int16Array.from([0, 16384, -16384, 32767]);
    const retour = base64VersFloat32(pcmVersBase64(pcm));
    expect(Array.from(retour).map((x) => Math.round(x * 100) / 100)).toEqual([0, 0.5, -0.5, 1]);
  });
});
