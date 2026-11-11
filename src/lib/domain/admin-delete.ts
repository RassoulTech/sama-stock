/** Règles des suppressions définitives de l'administration (commerce, utilisateur, licence). */

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");

/** Le texte retapé pour confirmer correspond-il à ce qui est attendu ? (sans tenir compte des majuscules ni des espaces en trop) */
export function confirmationMatches(typed: string, expected: string): boolean {
  const want = normalize(expected);
  return want.length > 0 && normalize(typed) === want;
}

export interface UserDeletionCheck {
  isSelf: boolean;
  isSuperAdmin: boolean;
  /** Commerces encore existants dont la personne est propriétaire. */
  ownedBusinesses: string[];
}

/** Raison d'interdire la suppression d'un compte, ou null si elle est permise. Une boutique ne reste jamais sans propriétaire. */
export function userDeletionBlocker({ isSelf, isSuperAdmin, ownedBusinesses }: UserDeletionCheck): string | null {
  if (isSelf) return "Vous ne pouvez pas supprimer votre propre compte.";
  if (isSuperAdmin) return "Un compte administrateur ne peut pas être supprimé d'ici.";
  if (ownedBusinesses.length > 0) {
    const names = ownedBusinesses.map((n) => `« ${n} »`).join(", ");
    return `Cette personne est propriétaire de ${names}. Supprimez d'abord ${ownedBusinesses.length > 1 ? "ces commerces" : "ce commerce"}.`;
  }
  return null;
}
