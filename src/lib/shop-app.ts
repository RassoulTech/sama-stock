/**
 * Application d'une boutique sur un appareil. Partagé par le proxy, le serveur et le navigateur.
 * - `ss_shop` : adresse (/b/…) de la boutique ouverte ici, pour revenir à sa page de connexion.
 * - `ss_device` : appareil de la boutique activé pour les codes PIN (secret, lu seulement par le serveur).
 */
export const SHOP_COOKIE = "ss_shop";
export const DEVICE_COOKIE_NAME = "ss_device";
export const SHOP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

/** `/connexion?autre=1` : se connecter à un autre commerce que celui de l'appareil. */
export const OTHER_ACCOUNT_PARAM = "autre";
