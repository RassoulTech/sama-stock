import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** Traduit les erreurs renvoyées par Better Auth. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email ou mot de passe incorrect.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Un compte existe déjà avec cet email. Connectez-vous plutôt.";
    case "PASSWORD_TOO_SHORT":
      return "Le mot de passe doit contenir au moins 8 caractères.";
    case "PASSWORD_TOO_LONG":
      return "Le mot de passe est trop long.";
    case "INVALID_EMAIL":
      return "Adresse email invalide.";
    case "INVALID_PASSWORD":
      return "Le mot de passe actuel est incorrect.";
    case "INVALID_TOKEN":
      return "Ce lien n'est plus valable : demandez-en un nouveau.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "Vous vous connectez avec Google : aucun mot de passe à changer.";
    default:
      if (error?.status === 429) return "Trop de tentatives. Patientez une minute puis réessayez.";
      return "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
  }
}
