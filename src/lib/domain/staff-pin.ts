/** Code PIN des employés : 4 chiffres, tapé sur l'appareil de la boutique pour ouvrir sa session. */
export const PIN_LENGTH = 4;
/** Codes faux avant blocage, et durée du blocage. */
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 15;
/** Durée maximale d'une session ouverte avec le code (une journée de travail). */
export const PIN_SESSION_HOURS = 12;

/** Adresse technique d'un employé sans e-mail : jamais affichée, jamais utilisée pour se connecter. */
export const STAFF_EMAIL_DOMAIN = "employes.sama-stock.invalid";

export function staffEmail(id: string): string {
  return `${id.toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

export function isStaffEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Codes trop faciles à deviner : tous les chiffres identiques, ou une suite (1234, 4321, 2345…). */
export function isWeakPin(pin: string): boolean {
  if (!isValidPin(pin)) return true;
  const digits = [...pin].map(Number);
  if (digits.every((d) => d === digits[0])) return true;
  const steps = digits.slice(1).map((d, i) => d - digits[i]!);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/** Code aléatoire (tirage cryptographique), jamais faible. */
export function generatePin(random: (max: number) => number = secureRandom): string {
  for (;;) {
    const pin = Array.from({ length: PIN_LENGTH }, () => String(random(10))).join("");
    if (!isWeakPin(pin)) return pin;
  }
}

function secureRandom(max: number): number {
  const buf = new Uint32Array(1);
  // Rejette les valeurs du haut pour un tirage uniforme
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % max;
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/** Après un code faux : nombre d'échecs et éventuel blocage (le compteur repart à zéro une fois bloqué). */
export function pinFailureState(failures: number, now: Date): { failures: number; lockedUntil: Date | null } {
  const next = failures + 1;
  if (next >= PIN_MAX_FAILURES) return { failures: 0, lockedUntil: new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000) };
  return { failures: next, lockedUntil: null };
}

/** Minutes restantes avant de pouvoir réessayer (arrondi au-dessus). */
export function minutesLeft(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
