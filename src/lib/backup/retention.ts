import { parseRunId, runPrefix, type Manifest, type RunState } from "./format";

const DAY = 86_400_000;

interface RunRef {
  runId: string;
  state: RunState;
  githubAt: string | null;
}

/** Passes à effacer : nuits de plus de 30 jours (sauf la 1re réussie du mois, gardée 1 an), autres passes de plus de 30 jours. */
export function runsToDelete(runs: RunRef[], now: Date): string[] {
  const parsed = runs.flatMap((r) => {
    const p = parseRunId(r.runId);
    return p ? [{ ...r, ...p }] : [];
  });
  const firstOfMonth = new Set<string>();
  const seenMonths = new Set<string>();
  for (const r of [...parsed].filter((r) => r.kind === "nuit" && r.state !== "echec").sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const month = r.date.toISOString().slice(0, 7);
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      firstOfMonth.add(r.runId);
    }
  }
  return parsed
    .filter((r) => {
      const age = now.getTime() - r.date.getTime();
      if (age < 30 * DAY) return false;
      if (r.kind === "nuit" && firstOfMonth.has(r.runId) && age < 366 * DAY) return false;
      return true;
    })
    .map((r) => r.runId);
}

/** Fichiers des passes effacées, sauf ceux qu'une passe gardée réutilise (`sameAs`). */
export function filesToDelete(files: string[], deletedRunIds: string[], keptManifests: Manifest[]): string[] {
  const used = new Set(keptManifests.flatMap((m) => m.files.map((f) => f.path)));
  const prefixes = deletedRunIds.map(runPrefix);
  return files.filter((f) => prefixes.some((p) => f.startsWith(p)) && !used.has(f));
}

/** Aucune copie GitHub depuis 48 h alors qu'une nuit de plus de 48 h existe : la copie de secours ne marche plus. */
export function githubCopyMissing(runs: RunRef[], now: Date): boolean {
  const limit = now.getTime() - 2 * DAY;
  const nights = runs.flatMap((r) => {
    const p = parseRunId(r.runId);
    return p && p.kind === "nuit" && r.state !== "echec" ? [{ ...r, date: p.date }] : [];
  });
  if (!nights.some((r) => r.date.getTime() < limit)) return false;
  return !runs.some((r) => r.githubAt && new Date(r.githubAt).getTime() >= limit);
}
