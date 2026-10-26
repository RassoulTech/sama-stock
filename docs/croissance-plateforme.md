# Sama Stock : tenir 10 à 20 ans de croissance

Bilan du 26 octobre 2026. La première partie est pour le fondateur ; l'annexe technique est pour un développeur.

## En bref

**La base est la bonne.** Sama Stock est construit comme les grands logiciels en ligne :
- une seule application pour tous les commerces, chacun séparé par son identifiant ;
- des serveurs qui s'agrandissent tout seuls quand le nombre de visiteurs augmente ;
- une base de données Postgres, le standard le plus solide du marché.

Passer de 100 à 100 000 boutiques ne demandera pas de tout réécrire. Il faudra :
1. **passer aux offres payantes** au bon moment ;
2. **ajouter des renforts** à chaque palier, décrits plus bas.

**Ce qui a été renforcé le 26 octobre 2026 :**
- six nouveaux « sommaires » (index) dans la base. Sans eux, la caisse et le tableau de bord ralentissaient d'année en année, car il fallait relire tout l'historique à chaque ouverture ;
- l'adresse personnelle de chaque boutique, prête pour les futurs sous-domaines (`boutique.samastock.sn`).

**Les deux urgences, avant de vendre beaucoup de licences :**

| Urgence | Pourquoi | Quoi faire |
|---|---|---|
| **Sauvegardes** | L'offre gratuite de Neon ne garde que **6 heures** d'historique. Une erreur découverte le lendemain ne pourrait pas être annulée. Vos clients paient une maintenance qui promet des sauvegardes. | Passer Neon à l'offre payante d'entrée (historique de plusieurs jours), et ajouter la sauvegarde automatique hebdomadaire prévue. |
| **Offre Vercel** | Si le compte est sur l'offre gratuite « Hobby », elle n'est pas prévue pour un usage commercial. | Passer à l'offre Pro dès les premières ventes de licences. |

## Combien de place prennent les données

D'après les ventes réelles de la base, une vente occupe environ **3 Ko**, en comptant ses produits et ses mouvements de stock.

Pour une boutique qui fait **50 ventes par jour** :

| Nombre de boutiques | Données ajoutées par an | Ventes par seconde (moyenne) |
|---|---|---|
| 100 | environ 5 Go | moins de 1 |
| 1 000 | environ 55 Go | moins de 1 |
| 10 000 | environ 550 Go | environ 6 |
| 100 000 | environ 5,5 To | environ 60 |

Ces volumes sont tout à fait gérables pour Postgres, à condition de suivre les paliers ci-dessous. **Le vrai plafond d'aujourd'hui, c'est l'offre gratuite de Neon : 1 Go, soit quelques mois d'activité avec quelques dizaines de boutiques actives.**

## Les paliers

### Maintenant, jusqu'à 100 boutiques
- Fait : les sommaires (index) de la base.
- Neon payant : sauvegardes sur plusieurs jours, plus de puissance, plus de place.
- Vercel Pro.
- Sauvegarde automatique hebdomadaire, prévue dans les prochaines étapes.
- Alertes d'erreurs : être prévenu quand le site plante, avant que les clients appellent.

### De 100 à 1 000 boutiques
- **Ranger les photos et les logos hors de la base**, dans un espace de fichiers (par exemple Vercel Blob). Aujourd'hui, ils sont dans la base et le logo est relu à chaque page.
- **Garder le total des crédits de chaque client** au lieu de le recalculer depuis la première vente.
- **Protection contre les essais de mots de passe à répétition** partagée entre les serveurs, avec une petite mémoire commune (par exemple Upstash Redis, qui a une offre gratuite).
- **Nettoyage automatique** des sessions expirées.
- **Exports Excel préparés en arrière-plan** pour les très grosses boutiques.

### De 1 000 à 10 000 boutiques
- **Une copie de la base en lecture** (« réplique ») pour les rapports et l'administration : les caisses restent rapides même quand quelqu'un calcule un gros rapport.
- **Des totaux par jour déjà calculés** pour les rapports sur plusieurs années.
- **Archiver l'historique de stock de plus de 2 ans** dans une table à part.
- **Administration paginée** : la liste des commerces se charge par pages.
- **Tableaux de bord de surveillance** : temps de réponse et requêtes lentes.

### De 10 000 à 100 000 boutiques et plus
- **Découper les grandes tables par mois** (ventes, lignes de vente, mouvements de stock) : chaque mois devient une petite table rapide.
- **Une base séparée pour les statistiques** : les calculs lourds ne touchent plus la base des caisses.
- **Des files de tâches** pour les travaux longs : exports, imports, rappels automatiques.
- **Une équipe d'astreinte** et des engagements de disponibilité écrits.

### Des millions d'utilisateurs, sur 10 à 20 ans
- **Répartir les commerces sur plusieurs bases** (par pays ou par groupe de boutiques). C'est possible sans tout réécrire, parce que chaque donnée porte déjà l'identifiant de son commerce et que les identifiants sont uniques partout.
- **Héberger les données en Afrique** quand les hébergeurs y proposeront le service, pour la rapidité et pour les règles sur les données personnelles.
- **Une application mobile native**, si le besoin de travailler sans internet devient plus large que la caisse.

## Ce qui ne changera pas
- Le langage et le cadre de l'application (Next.js, React).
- La base Postgres et son organisation par commerce.
- Le mode hors ligne : il soulage même les serveurs, puisque les ventes faites pendant une coupure arrivent ensuite, réparties dans le temps.

---

## Annexe technique

### État au 26/10/2026
- Neon : projet `sama-stock`, `aws-eu-central-1`, Postgres 17, offre `free_v3`, calcul fixe 0,25 CU, limite 1 Go par branche, historique 6 h.
- Connexion par le répartiteur (`-pooler`), `pg.Pool` avec `max: 5` par instance. Vercel est en `fra1`, la même région que la base.
- Multi-commerces sur un schéma unique, `business_id` partout, identifiants UUID.
- Sessions Better Auth avec `cookieCache` de 5 minutes, ce qui évite une lecture de session à chaque requête.

### Index ajoutés (migration `0007_boutiques_et_index`)

| Index | Requête concernée |
|---|---|
| `stock_levels (business_id)` | `stockValue` (tableau de bord) : la table était parcourue en entier, tous commerces confondus |
| `sales (business_id, location_id) WHERE kind='order' AND status IN ('new','preparing')` | `reservedQuantities`, appelée par `listProducts` (caisse, stock, copie hors ligne) : tout l'historique des ventes du commerce était relu |
| `sales (business_id, customer_id) WHERE customer_id IS NOT NULL` | `listCustomers`, `totalCustomerDebt` (crédits) |
| `purchase_items (purchase_id)`, `purchase_items (product_id)` | jointures des achats, aucun index auparavant |
| `customer_payments (business_id, created_at)` | rapports et encaissements par période |

### Points à reprendre plus tard, par ordre de priorité
1. `businesses.logo` et `products.image_data` sont stockés en data URL dans la base. `getContext` charge `businesses.*`, donc le logo, à chaque requête. Il faut les déplacer vers un stockage de fichiers avec CDN, garder une URL versionnée en base, et ne plus sélectionner le logo dans le contexte.
2. Les crédits clients sont agrégés sur toutes les ventes terminées. Il faut tenir un solde par client, mis à jour dans la même transaction que la vente ou le remboursement.
3. `listProducts` n'a pas de limite : le tableau de bord charge tous les produits pour calculer les alertes. Il faut calculer les alertes en SQL (`WHERE available <= alert_threshold LIMIT n`) et paginer la page Produits au-delà de quelques milliers de références.
4. La limite de débit de Better Auth est en mémoire, donc propre à chaque instance serverless. Il faut un `secondaryStorage` Redis (Upstash) et des règles renforcées sur `/sign-in/email`.
5. Il faut un cron Vercel qui supprime les lignes `session` et `verification` expirées.
6. `listAllBusinesses` (administration) calcule ses agrégats sur tous les commerces : la paginer et la mettre en cache au-delà de quelques milliers de commerces.
7. Au-delà d'environ 1 To : partitionnement mensuel de `sales`, `sale_items` et `stock_movements`, et réplique de lecture pour `analytics` et l'administration.
