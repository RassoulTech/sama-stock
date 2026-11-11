/** Demandes à l'assistant permises par commerce et par jour (le quota gratuit de l'IA est partagé). */
export const DEFAULT_DAILY_LIMIT = 60;

/** Boutiques de démonstration : ouvertes à tout le monde, donc limitées plus bas pour protéger les vrais commerces. */
export const DEMO_DAILY_LIMIT = 20;

/** Limite du jour : ASSISTANT_DAILY_LIMIT (entier positif) sinon 60 ; une démo n'a jamais plus de 20. */
export function assistantDailyLimit(setting: string | undefined, isDemo: boolean): number {
  const value = Number(setting);
  const limit = Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
  return isDemo ? Math.min(limit, DEMO_DAILY_LIMIT) : limit;
}
