/** Adresses des super administrateurs (variable ADMIN_EMAILS, séparées par des virgules), en minuscules. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
