// scripts/assistant-essai.ts
/**
 * Test de faisabilité de l'assistant vocal : Gemini comprend-il de vraies notes vocales en wolof et en français ?
 *
 * Usage :
 *   npx tsx scripts/assistant-essai.ts <dossier-des-notes> [modèle]
 *
 * Le dossier contient les notes (.ogg, .opus, .m4a, .mp3, .wav…) et attendu.json :
 *   { "01.ogg": { "outil": "brouillon_vente", "produit": "Riz parfumé 1kg", "quantite": 2, "langue": "wo" }, … }
 * Chaque note est convertie en WAV 16 kHz mono avec ffmpeg, comme le fera le téléphone.
 * Clé : GEMINI_API_KEY dans .env.local. Rien n'est écrit en base.
 */
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "dotenv";
import { buildDraft, draftForModel, type DraftCatalog } from "../src/lib/domain/assistant/drafts";
import { findByName } from "../src/lib/domain/assistant/match";
import { buildSystemPrompt } from "../src/lib/domain/assistant/prompt";
import { allowedTools, isDraftTool, isReadTool, toolDeclarations } from "../src/lib/domain/assistant/tools";
import { createGemini, DEFAULT_GEMINI_MODEL, type GeminiContent, type GeminiPart } from "../src/server/assistant/gemini";

config({ path: ".env.local" });
config();

const run = promisify(execFile);
const AUDIO = /\.(ogg|opus|m4a|mp3|wav|aac|flac|webm)$/i;

const catalog: DraftCatalog = {
  products: [
    { id: "p1", name: "Riz parfumé 1kg", unit: "kg", salePrice: 600, costPrice: 450, available: 40 },
    { id: "p2", name: "Riz brisé", unit: "kg", salePrice: 400, costPrice: 300, available: 25 },
    { id: "p3", name: "Huile Dinor 1L", unit: "litre", salePrice: 1300, costPrice: 1100, available: 12 },
    { id: "p4", name: "Sucre en morceaux", unit: "paquet", salePrice: 700, costPrice: 550, available: 30 },
    { id: "p5", name: "Lait Vitalait 400g", unit: "boite", salePrice: 2250, costPrice: 1900, available: 18 },
    { id: "p6", name: "Savon Madar", unit: "piece", salePrice: 250, costPrice: 180, available: 60 },
    { id: "p7", name: "Ciment 50kg", unit: "sac", salePrice: 4800, costPrice: 4300, available: 15 },
    { id: "p8", name: "Oignons", unit: "kg", salePrice: 500, costPrice: 350, available: 20 },
  ],
  customers: [
    { id: "c1", name: "Awa Ndiaye", phone: "+221771234567" },
    { id: "c2", name: "Moussa Diop", phone: "+221781112233" },
    { id: "c3", name: "Fatou Sarr", phone: null },
  ],
  suppliers: [
    { id: "s1", name: "Sedima", phone: null },
    { id: "s2", name: "Grands Moulins", phone: null },
  ],
};

interface Expected {
  outil: string;
  produit?: string;
  quantite?: number;
  montant?: number;
  langue?: "wo" | "fr";
}

function fakeRead(name: string, args: Record<string, unknown>): Record<string, unknown> {
  if (name === "stock_produit") {
    const m = findByName(String(args.produit ?? ""), catalog.products);
    return m.kind === "one" ? { produit: m.item.name, disponible: m.item.available, prix_vente: m.item.salePrice } : { trouve: false };
  }
  if (name === "resume_ventes") return { chiffre_affaires: 45000, nombre_ventes: 12 };
  if (name === "clients_debiteurs") return { total_du: 7500, clients: [{ nom: "Awa Ndiaye", doit: 7500 }] };
  return { commandes: [] };
}

async function toWavBase64(file: string): Promise<string> {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", file, "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"], {
    encoding: "buffer",
    maxBuffer: 50 * 1024 * 1024,
  });
  return (stdout as Buffer).toString("base64");
}

const calls = (content: GeminiContent) => content.parts.filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => Boolean(p.functionCall));

async function main() {
  const [dir, modelArg] = process.argv.slice(2);
  if (!dir) throw new Error("Usage : npx tsx scripts/assistant-essai.ts <dossier-des-notes> [modèle]");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante dans .env.local");
  const model = modelArg ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const gemini = createGemini({ apiKey, model });
  const expected = JSON.parse(await readFile(path.join(dir, "attendu.json"), "utf8")) as Record<string, Expected>;
  const tools = toolDeclarations(allowedTools({ can: () => true, modulePos: true, moduleOrders: true }), { costs: true });
  const system = buildSystemPrompt({ businessName: "Boutique d'essai", roleLabel: "Propriétaire", today: new Date(), products: catalog.products });

  const files = (await readdir(dir)).filter((f) => AUDIO.test(f)).sort();
  let passed = 0;
  let wolof = 0;
  let wolofPassed = 0;
  let totalMs = 0;
  let timed = 0;
  console.log(`Modèle : ${model} — ${files.length} notes\n`);

  for (const file of files) {
    const exp = expected[file];
    const contents: GeminiContent[] = [];
    let decision: { name: string; args: Record<string, unknown> } | null = null;
    let final: Record<string, unknown> | null = null;
    let firstMs = 0;
    try {
      contents.push({ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: await toWavBase64(path.join(dir, file)) } }, { text: "Note vocale du commerçant ci-dessus. Réponds à sa demande avec les outils, puis termine par « repondre »." }] });
      for (let i = 0; i < 4 && !final; i++) {
        const started = Date.now();
        const content = await gemini({ system, contents, tools });
        if (i === 0) {
          firstMs = Date.now() - started;
          totalMs += firstMs;
          timed++;
        }
        const found = calls(content);
        const others = found.filter((c) => c.functionCall.name !== "repondre");
        if (!decision) decision = { name: (others[0] ?? found[0])?.functionCall.name ?? "(aucun)", args: (others[0] ?? found[0])?.functionCall.args ?? {} };
        if (!others.length) {
          final = found.find((c) => c.functionCall.name === "repondre")?.functionCall.args ?? {};
          break;
        }
        const responses: GeminiPart[] = others.map(({ functionCall: fc }) => {
          const args = fc.args ?? {};
          if (isReadTool(fc.name)) return { functionResponse: { name: fc.name, response: fakeRead(fc.name, args) } };
          if (isDraftTool(fc.name)) {
            const r = buildDraft(fc.name, args, catalog, { costs: true });
            return { functionResponse: { name: fc.name, response: r.ok ? { ok: true, brouillon: draftForModel(r.draft) } : { ok: false, raison: r.reason, candidats: r.candidates } } };
          }
          return { functionResponse: { name: fc.name, response: { erreur: "Outil inconnu." } } };
        });
        contents.push(content, { role: "user", parts: responses });
      }
    } catch (error) {
      console.log(`❌ ${file} — erreur : ${(error as Error).message}\n`);
      if (exp?.langue === "wo") wolof++;
      continue;
    }

    const problems: string[] = [];
    if (!exp) problems.push("absent de attendu.json");
    else {
      if (decision?.name !== exp.outil) problems.push(`outil ${decision?.name} au lieu de ${exp.outil}`);
      const args = decision?.args ?? {};
      const line = Array.isArray(args.lignes) ? (args.lignes[0] as Record<string, unknown>) : undefined;
      if (exp.produit) {
        const said = String(line?.produit ?? args.produit ?? "");
        const m = findByName(said, catalog.products);
        if (m.kind !== "one" || m.item.name !== exp.produit) problems.push(`produit « ${said} » au lieu de ${exp.produit}`);
      }
      if (exp.quantite !== undefined && Number(line?.quantite) !== exp.quantite) problems.push(`quantité ${String(line?.quantite)} au lieu de ${exp.quantite}`);
      if (exp.montant !== undefined && Number(args.montant) !== exp.montant) problems.push(`montant ${String(args.montant)} au lieu de ${exp.montant}`);
      if (exp.langue && final?.langue !== exp.langue) problems.push(`langue ${String(final?.langue)} au lieu de ${exp.langue}`);
    }
    const ok = problems.length === 0;
    if (ok) passed++;
    if (exp?.langue === "wo") {
      wolof++;
      if (ok) wolofPassed++;
    }
    console.log(`${ok ? "✅" : "❌"} ${file} (${(firstMs / 1000).toFixed(1)} s) — ${decision?.name} ${JSON.stringify(decision?.args)}`);
    console.log(`   « ${String(final?.transcription ?? "")} » [${String(final?.langue ?? "?")}] → ${String(final?.texte ?? "")}`);
    if (!ok) console.log(`   ${problems.join(" ; ")}`);
    console.log("");
  }

  const avg = timed ? totalMs / timed / 1000 : 0;
  console.log(`Réussite : ${passed}/${files.length} — wolof : ${wolofPassed}/${wolof} — 1er appel moyen : ${avg.toFixed(1)} s`);
  console.log(passed >= 8 && wolofPassed >= 5 && avg < 8 ? "→ Critères atteints." : "→ Critères NON atteints.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
