/** N'accepte que des chemins internes (évite les redirections vers un autre site). */
export function safeRedirect(value: string | string[] | undefined, fallback: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return fallback;
  return v;
}
