/**
 * Espaces réservés aux utilisateurs connectés. Le proxy y renvoie vers la connexion
 * et robots.txt demande aux moteurs de ne pas les explorer.
 * (La vraie protection reste la vérification de session dans chaque page et action.)
 */
export const PROTECTED_PREFIXES = [
  "/tableau-de-bord",
  "/vendre",
  "/ventes",
  "/commandes",
  "/produits",
  "/categories",
  "/stock",
  "/clients",
  "/fournisseurs",
  "/rapports",
  "/equipe",
  "/abonnement",
  "/parametres",
  "/admin",
  "/demarrage",
  "/suspendu",
] as const;

/** Pages publiques mais sans intérêt pour les moteurs (actions, liens personnels). */
export const NOT_INDEXED_PREFIXES = ["/api/", "/invitation/"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
