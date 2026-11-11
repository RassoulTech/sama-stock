// Produit les phrases prêtes avec la voix Anta : npx tsx scripts/phrases-voix.ts
// Lit ANTA_TTS_URL dans l'environnement ou dans .env.local, écrit public/assistant/voix/<clé>.wav.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PHRASES, type ClePhrase } from "../src/lib/domain/assistant/phrases";

function adresseVoix(): string {
  const local = existsSync(".env.local") ? readFileSync(".env.local", "utf8").match(/^ANTA_TTS_URL=(.+)$/m)?.[1]?.trim() : undefined;
  const base = process.env.ANTA_TTS_URL ?? local;
  if (!base) throw new Error("ANTA_TTS_URL manquant (environnement ou .env.local).");
  return base.replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}

async function main() {
  const base = adresseVoix();
  mkdirSync("public/assistant/voix", { recursive: true });
  for (const cle of Object.keys(PHRASES) as ClePhrase[]) {
    const res = await fetch(`${base}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: PHRASES[cle].wo }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio/")) throw new Error(`${cle} : HTTP ${res.status}`);
    writeFileSync(`public/assistant/voix/${cle}.wav`, Buffer.from(await res.arrayBuffer()));
    console.log(`ok ${cle}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
