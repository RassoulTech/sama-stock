# Devis, factures et reçus en PDF : conception

Date : 26 octobre 2026. Statut : validé par l'utilisateur (étape 2 sur 4).

Étape suivante : bon de livraison, avoir, bon d'achat client, bon de commande fournisseur, relevé client.

## Résumé en clair

- **Paramètres → Vos documents** : NINEA, RCCM, TVA (« Non assujetti à la TVA » par défaut, ou TVA 18 %), mention en
  bas des documents (conditions de paiement…), durée de validité des devis (15 jours par défaut). Le logo et l'adresse
  restent dans « Mon commerce ».
- **Devis** (DEV-2026-0001) : client, produits, prix modifiables, remise, livraison, date de validité, note.
  - Statuts : en cours, accepté, refusé, transformé en vente. « Expiré » s'affiche quand la date de validité est passée.
  - Il reste modifiable tant qu'il n'est pas transformé.
  - **« Transformer en vente »** : on indique le paiement reçu. La vente est créée aux prix du devis et le stock baisse.
- **Facture** (FAC-2026-0001) : créée depuis une vente ou une commande, en un bouton.
  - Elle porte le nom du client, avec son téléphone, son adresse et son NINEA s'il est une entreprise.
  - Une fois émise, elle ne change plus : les lignes, le vendeur et le client sont recopiés.
  - Le paiement est lu en direct sur la vente : « Payée » ou « Reste à payer ». Les remboursements de crédit y sont
    déjà répartis vente par vente.
  - On peut l'annuler (propriétaire, gérant), puis en refaire une. Elle est annulée d'office si la vente l'est.
- **Reçu PDF** pour chaque vente.
- **Sur chaque PDF** :
  - le logo, les informations légales et la somme en lettres (« Arrêtée la présente facture à la somme de … francs
    CFA ») ;
  - un **QR code** vers une page publique qui confirme que le document est authentique.
- **Envoi** : bouton « Envoyer le PDF ».
  - Sur téléphone, le fichier part directement dans WhatsApp.
  - Sur ordinateur, WhatsApp s'ouvre avec un message et le lien du document.
- Pour toutes les boutiques, essai et démonstration compris. Il faut internet : les documents ne se font pas hors
  ligne.

## Décisions

| Sujet | Décision |
|---|---|
| Fabrication du PDF | `@react-pdf/renderer` dans une route serveur (déjà prévu par Next.js comme paquet externe). Police Helvetica intégrée : le texte est nettoyé des caractères hors WinAnsi (espaces fines des montants, signe moins). |
| Stockage | Table `documents` (devis et factures) et `document_items`. Le reçu se fabrique directement depuis la vente, sans ligne en base. |
| Numérotation | `DEV-AAAA-NNNN` et `FAC-AAAA-NNNN`, suite continue par commerce, par type et par année. Le numéro est calculé sous verrou de la ligne du commerce. Un index unique `(business_id, number)` empêche les doublons. |
| Une facture par vente | Index unique partiel sur `sale_id` pour les factures émises. Après une annulation, on peut en refaire une. |
| Prix et TVA | Les prix de la boutique sont TTC. Avec la TVA 18 % : HT d'une ligne = arrondi(TTC / 1,18). Total HT = somme des lignes HT, moins la remise HT, plus la livraison HT. TVA = TTC − HT, pour que le total TTC reste exact. Le taux est recopié sur le document. |
| Lien public et QR | Jeton `<type>.<id>.<signature>`. La signature est un HMAC-SHA256 (clé dérivée de `BETTER_AUTH_SECRET`), coupé à 128 bits : impossible à deviner, rien à stocker. `/verifier/<jeton>` montre la page d'authenticité, `/verifier/<jeton>/pdf` donne le PDF. La page montre la boutique, le type, le numéro, la date, le montant et l'état, sans les lignes. |
| Droits | Voir, créer et envoyer : `sales.create` (propriétaire, gérant, vendeur). Annuler une facture : `sales.cancel`. Réglages : `settings.manage`. Une boutique en lecture seule peut voir et envoyer, pas créer. |
| Transformer un devis | Les lignes reprennent les prix du devis. Le stock est vérifié et verrouillé comme pour une vente normale (`priceAndReserve` accepte des prix imposés). La remise et la livraison sont reprises. |
| Menu | « Devis et factures » (`/factures`), avec deux onglets. Pages : `/factures/[id]`, `/factures/devis/nouveau`, `/factures/devis/[id]`. |

## Mentions sur la facture

- **Vendeur** : nom, adresse et ville, téléphone, NINEA, RCCM.
- **Client** : nom, téléphone, adresse, et NINEA s'il en a un.
- **Le document** : numéro et date, puis pour chaque ligne la désignation, la quantité, le prix unitaire et le total.
- **TVA** :
  - à 18 % : total HT, TVA 18 % et total TTC ;
  - sinon : la mention « Non assujetti à la TVA ».
- **Montants** : remise et livraison, la somme en lettres, puis le payé et le reste à payer.
- **Bas de page** : la mention libre de la boutique, le QR code et « Document généré avec Sama Stock ».

## Essais

- **Tests unitaires** : somme en lettres, calcul HT/TVA, numéros, jeton signé (bon, falsifié, autre type), statut
  « expiré » d'un devis.
- **Parcours dans le navigateur, sur l'ordinateur, avec la démo Pro** :
  - créer un devis, le modifier, puis le transformer en vente ;
  - créer la facture de la vente, ouvrir les PDF, scanner la page de vérification avec un faux jeton ;
  - annuler la vente et vérifier que la facture devient « Annulée ».
