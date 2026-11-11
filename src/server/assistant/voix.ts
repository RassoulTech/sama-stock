// Pas de "server-only" : testé avec Vitest.
/** La copie de la voix Anta (Hugging Face) répond-elle ? Un espace endormi renvoie une page HTML ou rien. */
export async function voixPrete(base: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${base.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { status?: string } | null;
    return data?.status === "healthy";
  } catch {
    return false;
  }
}
