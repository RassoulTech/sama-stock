# Notifications avec son — conception

Date : 2026-10-27. Choix validés par l'utilisateur : notifications même application fermée, pour les ventes, les
commandes et le stock (bas / rupture), reçues par le propriétaire et les gérants, avec un son par type.

## Événements

| Type | Déclencheur | Reçu par l'auteur ? |
| --- | --- | --- |
| `sale` | `recordShopSale` (caisse, devis transformé) et `recordOfflineSale` (vente hors ligne envoyée) | non |
| `order` | `createOrder` | non |
| `stock_low` / `stock_out` | passage du seuil d'alerte du disponible (physique − réservé) dans une boutique : vente, commande, sortie, inventaire, transfert | oui (sinon un commerçant seul ne serait jamais prévenu) |

Une alerte de stock n'est créée qu'au passage du seuil (`stockCrossing`), pas à chaque vente suivante.
`watchStock(tx, ctx, ids)` photographie le disponible avant la sortie et renvoie la fonction qui compare après.

## Données (migration 0010)

- `notifications` : commerce, type, titre, texte, lien, auteur, date. Effacées après 90 jours.
- `push_subscriptions` : un abonnement par téléphone (navigateur), rattaché à l'utilisateur.
- `members.notify_prefs` (ventes, commandes, stock, son ; tout activé par défaut) et `members.notifications_seen_at`.

## Envoi

- `notify()` écrit la notification dans la transaction de l'action, puis `after()` appelle `deliverPush()` après la
  réponse : une transaction annulée n'envoie rien.
- `deliverPush` (src/server/push.ts, bibliothèque `web-push`) envoie aux téléphones des propriétaires et gérants dont le
  réglage est actif ; les abonnements expirés (404/410) sont supprimés. Rien ne part pour la démonstration publique.
- Clés : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (.env et Vercel). Sans clés, seule la cloche marche.

## Téléphone et application

- Service worker (`public/sw.js`) : `push` → message aux fenêtres ouvertes ; si l'une est visible, elle joue son son et
  aucune notification système n'est affichée (pas de double son) ; sinon notification système (son du téléphone,
  vibration selon le type). `notificationclick` ouvre la vente, la commande ou le produit.
- Cloche (`NotificationBell`, barre du haut) : lit `/api/notifications` toutes les 30 s et dès qu'un message du service
  worker arrive ; annonce (message + son Web Audio de `src/lib/sounds.ts`) seulement ce qui arrive pendant que la page
  est visible. Ouvrir la liste la marque comme lue.
- Réglages (`NotificationSettings`, page Mon compte) : activer / désactiver sur ce téléphone, essai, interrupteurs,
  écoute des sons. iPhone : seulement dans l'application installée sur l'écran d'accueil (iOS 16.4+).

## Test

`scratchpad/notify-e2e.cjs` (démo Pro, serveur local) : vente + alerte de stock en base, cloche, son, message du service
worker (CDP `ServiceWorker.deliverPushMessage`), réglages, téléphone. Le vrai envoi vers un téléphone se vérifie avec le
bouton « Envoyer un essai » une fois les clés ajoutées dans Vercel.
