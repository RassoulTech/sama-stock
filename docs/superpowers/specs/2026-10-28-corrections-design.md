# Corriger, annuler, supprimer — conception

Date : 2026-10-28. Demande : « on ne peut pas supprimer une vente, ni modifier le stock d'un produit » ; vérifier
créer / voir / modifier / supprimer partout. Choix validés : ventes « annuler + corriger + supprimer », stock modifiable
dans « Modifier le produit », droits « propriétaire et gérants » avec notification au propriétaire. Les autres
annulations ont été laissées à mon choix : entrée de stock, sortie / perte, paiement client (pas le transfert : un
transfert dans l'autre sens fait déjà la même chose).

## Inventaire de départ

| Élément | Créer | Voir | Modifier | Supprimer / annuler |
| --- | --- | --- | --- | --- |
| Clients, fournisseurs, catégories, devis, équipe | oui | oui | oui | oui |
| Produits | oui | oui | oui, sauf le stock | archiver, ou supprimer sans historique |
| Stock d'un produit | entrée, sortie, inventaire | oui | **non** | **non** (entrée, sortie mal saisies) |
| Ventes | oui | oui | **non** | annuler, caché en bas de la page de la vente |
| Paiement d'un client | oui | oui | non | **non** |
| Commandes | oui | oui | statut | annuler |
| Factures | oui | oui | non (normal) | annuler |
| Boutiques | oui | oui | renommer | non (hors périmètre) |

## Ventes

- **Annuler** (propriétaire, gérant ; `sales.cancel`, comme aujourd'hui) : depuis la page de la vente (bouton remonté)
  et depuis la liste (menu « ⋯ » de chaque ligne). La fenêtre de confirmation dit ce qu'il faut rendre au client
  (« À rendre au client : X FCFA » = montant déjà payé). Le stock revient, la facture émise est annulée (déjà le cas).
  On garde qui a annulé (`sales.cancelled_by`) : « Annulée par Fatou le … ».
- **Corriger** (`sales.cancel` + `sales.create`, internet obligatoire) : `/vendre?corriger=<id>` rouvre la caisse avec
  le même panier (produits, prix négociés, remise, client, mode de paiement, montant reçu = déjà payé). À la
  validation, une seule transaction annule l'ancienne vente puis enregistre la nouvelle ; la nouvelle garde
  `sales.replaces_id`. Pages : « Remplace V-0042 » / « Remplacée par V-0050 ». Le stock disponible affiché dans la
  caisse compte les quantités de l'ancienne vente (elles reviennent à la validation).
- **Supprimer** (propriétaire seul, nouvelle permission `sales.delete`) : seulement une vente déjà annulée. Efface la
  vente, ses lignes, ses mouvements de stock (vente + retour, qui s'annulent) et ses notifications. Une facture annulée
  reste (numérotation légale), sans lien vers la vente.
- **Liste** : filtre « Annulées » ajouté au filtre d'état ; les ventes annulées restent barrées.
- **Notification** : quand un gérant annule ou corrige une vente, le propriétaire et les autres gérants reçoivent
  « Vente annulée · V-0042 » (type `sale_cancel`, rubrique « Ventes », son d'alerte). L'auteur ne la reçoit pas.

## Stock

- **Champ « Stock en rayon · <boutique> »** dans « Modifier le produit » (`products.manage`, produit non archivé).
  Le formulaire envoie l'ancienne quantité vue et la nouvelle. Si le stock a bougé entre-temps (une vente), refus :
  « Le stock a changé pendant votre modification (il est maintenant de 9). Vérifiez puis enregistrez. » Sinon un
  mouvement `correction` (« Correction du stock ») de la différence. Une correction n'est jamais comptée comme une
  perte. Alerte de stock (notifications) comme les autres mouvements.
- **Annuler une entrée de stock** (nouvelle permission `stock.cancel` : propriétaire, gérant) : depuis l'historique du
  stock, ligne « Entrée / achat ». Annule tout l'achat (`purchases.cancelled_at`, `cancelled_by`) : mouvements
  `purchase_cancel` de chaque ligne ; refus si la boutique n'a plus la quantité (« déjà vendu en partie : corrigez
  plutôt le stock »). Prix d'achat moyen recalculé : (Q × C − q × u) / (Q − q), gardé tel quel si Q − q ≤ 0 ou résultat
  négatif. Les totaux fournisseur ne comptent plus l'achat annulé.
- **Annuler une sortie ou une perte** (`stock.cancel`) : lignes « Sortie » et pertes (`out`, `adjust`). Le produit
  revient (`movement_cancel`, « Annulation »), la ligne d'origine est marquée (`stock_movements.cancelled_at`) et sort
  des rapports de pertes.
- L'historique montre les lignes annulées barrées.

## Paiements des clients

- **Annuler un paiement** (nouvelle permission `payments.cancel` : propriétaire, gérant) depuis la fiche du client. Le paiement est marqué (`customer_payments.cancelled_at`, `cancelled_by`) et barré ; la dette
  revient.
- Pour savoir à quelles ventes rendre la dette, chaque nouveau paiement garde sa répartition
  (`customer_payments.allocations` : `[{ saleId, amount }]`). Un ancien paiement (sans répartition) est retiré des
  ventes du client payées avant lui, d'abord les ventes à crédit, des plus récentes aux plus anciennes : le total de
  la dette redevient exact.

## Données (migration 0011, uniquement des ajouts)

- `sales.cancelled_by`, `sales.replaces_id` (→ sales, on delete set null).
- `purchases.cancelled_at`, `purchases.cancelled_by`.
- `stock_movements.cancelled_at`.
- `customer_payments.cancelled_at`, `customer_payments.cancelled_by`, `customer_payments.allocations` (jsonb).

## Tests

- Unitaires : coût moyen après annulation, plan de remboursement d'un paiement (avec et sans répartition), écart de
  stock, permissions.
- Bout en bout en local sur la démonstration (comme les notifications) : annuler, corriger, supprimer une vente ;
  corriger le stock ; annuler une entrée, une sortie, un paiement ; tout est remis en état à la fin.
