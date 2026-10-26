# Équipe avec code PIN : conception

Date : 26 octobre 2026. Statut : validé par l'utilisateur (étape 1 sur 4).

Étapes suivantes : documents PDF (devis, facture, reçu), puis les autres documents (bon de livraison, avoir, bon
d'achat client, bon de commande fournisseur, relevé client), puis l'accès par code PIN sans internet.

## Résumé en clair

- Le propriétaire ajoute un employé dans **Équipe** avec son nom et son rôle. Un **code PIN à 4 chiffres** est créé et
  affiché une seule fois. Il n'y a ni e-mail ni compte à créer, ni invitation.
- Le propriétaire **active l'appareil de la boutique** (téléphone ou tablette) une seule fois. Seuls les appareils
  activés montrent la liste des employés et le clavier du code.
- Sur la page de la boutique (`/b/<adresse>`), l'employé **touche son nom puis tape son code**.
  - Après 5 codes faux, son accès est bloqué 15 minutes.
  - Sa session dure au plus 12 heures. Le bouton **« Changer d'employé »** la ferme tout de suite.
- Un gérant peut aussi recevoir, en plus, un e-mail et un mot de passe provisoire pour se connecter de partout. C'est
  facultatif.
- Les invitations par e-mail déjà envoyées restent valables, mais on n'en crée plus.

## Décisions

| Sujet | Décision |
|---|---|
| Identité d'un employé sans e-mail | Une ligne `user` Better Auth, avec une adresse technique `<id>@employes.sama-stock.invalid` jamais affichée. Ventes, journal et droits fonctionnent comme pour les autres comptes. |
| Où vit le code | `members.pin_hash` (scrypt de Better Auth). Le code est propre à un commerce. |
| Contre les essais de codes | Le clavier n'existe que sur un appareil activé : jeton secret en cookie `httpOnly`, empreinte SHA-256 en base. On choisit d'abord son nom (pas d'identification par le code seul). Blocage de 15 minutes après 5 échecs, par membre. |
| Ouverture de session | Petit module Better Auth (`/api/auth/pin/sign-in`) : vérifie l'appareil, le membre et le code, puis appelle `internalAdapter.createSession(userId, false, { expiresAt: maintenant + 12 h })` et `setSessionCookie`. |
| Boutiques sans licence | L'adresse `/b/<adresse>` est créée à l'activation du premier appareil. La page reste aux couleurs de Sama Stock quand la boutique n'a pas de licence. |
| Codes faibles | Refusés quand le propriétaire choisit le code (0000, 1111, 1234, 4321, etc.). Les codes générés ne sont jamais faibles. |
| Qui gère | Le droit `team.manage`, donc le propriétaire seul : ajouter, changer un code, retirer un employé, activer ou retirer un appareil. Le propriétaire peut aussi se donner un code. |

## Données (migration 0008, uniquement des ajouts)

- `members` : `pin_hash text`, `pin_failures integer not null default 0`, `pin_locked_until timestamptz`,
  `pin_set_at timestamptz`.
- Nouvelle table `shop_devices` :
  - `id`, `business_id` (suppression en cascade), `name`, `token_hash` (unique) ;
  - `created_by` (devient vide si l'utilisateur est supprimé) ;
  - `created_at`, `last_seen_at`, `revoked_at` ;
  - un index sur `business_id`.

## Composants

- `src/lib/domain/staff-pin.ts`, avec tests : `isValidPin`, `isWeakPin`, `generatePin`, `pinFailureState`, `isLocked`,
  `staffEmail`, `isStaffEmail`, les constantes de durée et de nombre d'essais.
- `src/server/services/devices.ts` :
  - le cookie `ss_device` vaut `<id>.<jeton>` ;
  - `createDevice`, `readDevice` (vérifie l'empreinte et le retrait), `listDevices`, `revokeDevice`.
- `src/lib/auth-pin.ts` : le module Better Auth `pinSignIn()`, ajouté à `plugins` dans `src/lib/auth.ts`.
- Dans `src/server/actions/team.ts` :
  - `addEmployee` (nom, rôle, téléphone facultatif, e-mail facultatif pour un gérant) ;
  - `resetMemberPin` ;
  - `activateThisDevice`, `revokeShopDevice`.

  `resetMemberPassword` reste réservé aux comptes avec une vraie adresse.
- Interface :
  - **Équipe** : bouton « Ajouter un employé » (au lieu d'« Inviter »), code affiché une fois, bouton « Code PIN » sur
    chaque ligne, carte « Appareils de la boutique » ;
  - **page `/b/<adresse>`** : choix du nom et clavier du code sur un appareil activé, e-mail et mot de passe sinon ;
  - **en-tête de l'application** : « Changer d'employé » sur un appareil activé.

## Tests

- Tests unitaires des règles du code (validité, codes faibles, blocage, adresse technique).
- Parcours sur navigateur, en local, avec un client de test, puis suppression de ce client avec accord :
  1. le propriétaire ajoute un vendeur et lit son code ;
  2. il active l'appareil ;
  3. le vendeur choisit son nom et tape son code ;
  4. le vendeur arrive sur l'application, avec les droits d'un vendeur ;
  5. « Changer d'employé » ramène au clavier ;
  6. 5 codes faux bloquent le compte, avec un message clair ;
  7. sur un appareil non activé, ni les noms ni le clavier ne s'affichent ;
  8. après le retrait de l'appareil, le clavier disparaît.
