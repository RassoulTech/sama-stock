# Assistant pilote : voix wolof et tâches faites à l'écran — conception

Date : 2026-11-11. Fait suite à `2026-11-05-assistant-vocal-design.md` (assistant vocal en ligne, brouillons + bouton Valider).

## But et périmètre

Le commerçant donne une instruction à voix haute (wolof ou français). L'assistant :

1. comprend la demande en un appel à Gemini (2 à 5 s, comme aujourd'hui) ;
2. **fait la tâche sur les vrais écrans de l'application, sous les yeux du commerçant** : il ouvre la page, un doigt
   visible se pose sur chaque champ ou bouton, les valeurs apparaissent une à une ;
3. **demande la permission avant d'enregistrer** (« Ndax ma bind ko ? » / « Je l'enregistre ? »), à voix haute et à
   l'écran ; sur « waaw » / « oui » (voix) ou le bouton Oui, il appuie sur le vrai bouton final ;
4. pour une question, ouvre l'écran qui contient la réponse, montre le chiffre du doigt et le dit ;
5. **parle wolof avec la voix Anta**, réellement disponible en ligne, et vite pour les phrases du parcours.

Choix validés par le commerçant le 2026-11-11 :
- approche « recettes jouées sur les vrais écrans » (pas d'IA qui regarde des captures d'écran) ;
- l'assistant **demande toujours** avant d'appuyer sur le bouton final d'une tâche qui enregistre ;
- livraison en deux phases ; ce document décrit la **phase 1** en détail et liste la phase 2.

Phase 1 :
- voix wolof en ligne (copie Hugging Face, réveil, phrases prêtes, lecture phrase par phrase) ;
- moteur « mode pilote » : bulle réduite, doigt animé, pilotes d'écran, confirmation, arrêt ;
- tâches : vente à la caisse, entrée de stock, sortie de stock, commande en ligne, changement d'état d'une commande,
  paiement d'un client qui doit, nouveau produit, changement de prix, nouveau client, nouveau fournisseur ;
- « montre-moi » : tableau de bord, rapports d'une période, stock bas et ruptures, historique des ventes, commandes,
  fiche d'un client ou d'un produit.

Phase 2 (même moteur, spécification à part) : inventaire, transfert, devis et factures, annulation d'une vente, équipe,
paramètres.

Hors périmètre : une IA qui décide des clics en regardant l'écran ; l'enregistrement sans accord du commerçant ;
l'assistant hors connexion.

## Parcours d'une demande

```
voix ─▶ POST /api/assistant ─▶ Gemini (outils) ─▶ réponse { texte, langue, mission }
                                                         │
          téléphone : bulle réduite + doigt  ◀───────────┘
          ├─ ouvre la page (router.push)
          ├─ attend le pilote de l'écran
          ├─ joue les étapes (doigt ▶ effet ▶ pause)
          ├─ s'arrête sur le bouton final : « Ndax ma bind ko ? »  [Oui] [Non] [micro]
          │     ├─ Oui (bouton, ou voix → confirmer)  ─▶ appuie sur le vrai bouton (action existante)
          │     ├─ Non                                ─▶ laisse l'écran rempli, le commerçant corrige
          │     └─ correction à la voix               ─▶ nouvelle mission sur le même écran
          └─ dit le résultat (« Bind naa ko » / l'erreur de l'action)
```

- **Le serveur n'écrit toujours rien.** Il comprend, vérifie et décrit la mission. L'écriture passe par le bouton
  final de l'écran, donc par l'action existante, ses contrôles de droits, de stock et de prix, ses messages.
- La réponse de `POST /api/assistant` devient `{ transcription, langue, texte, mission }` ; `mission` est `null`
  pour une simple réponse. Le champ `brouillon` disparaît (la carte Valider est remplacée par le mode pilote).

## Missions (serveur → téléphone)

Une mission est une donnée vérifiée par le serveur, jamais du code ni une suite de clics choisie par l'IA :

- `tache` : la tâche et sa charge exacte, identifiants résolus (produits, client, fournisseur), plus ce qu'il faut
  afficher. Types : `vente`, `entree_stock`, `sortie_stock`, `commande`, `statut_commande`, `paiement_client`,
  `produit`, `prix`, `client`, `fournisseur`.
- `ecran` : une page à ouvrir et, au besoin, ses réglages et l'élément à montrer du doigt. Pages :
  `tableau_de_bord`, `rapports` (période), `stock` (filtre bas / rupture), `ventes` (période), `commandes`,
  `client` (id), `produit` (id).

Outils Gemini (en plus des quatre outils de lecture et de `repondre`) :

| Outil | Mission | Droit exigé |
|---|---|---|
| `brouillon_vente` | `vente` | `sales.create` + module caisse |
| `brouillon_entree_stock` | `entree_stock` | `stock.in` |
| `brouillon_sortie_stock` | `sortie_stock` | `stock.adjust` |
| `brouillon_commande` | `commande` | `orders.manage` + module commandes |
| `brouillon_statut_commande` | `statut_commande` | `orders.manage` |
| `brouillon_paiement_client` | `paiement_client` | `customers.manage` |
| `brouillon_produit` | `produit` | `products.manage` |
| `brouillon_prix` | `prix` | `products.manage` |
| `brouillon_client` | `client` | `customers.manage` |
| `brouillon_fournisseur` | `fournisseur` | `suppliers.manage` |
| `montrer_ecran` | `ecran` | celui de la page (`reports.view` + offre pour les rapports, `products.view`, `orders.manage`…) |
| `confirmer` | — | aucun (réponse oui / non pendant une attente) |

- Chaque outil de brouillon passe par `buildDraft` (comme aujourd'hui) : produits et personnes retrouvés par leur nom
  (`match.ts`), montants en francs entiers, refus clair si un nom est ambigu ou introuvable.
- Toute écriture est aussi refusée quand l'offre est en lecture seule (`plan.readOnly`), comme sur les écrans.
- Une seule mission par demande. Une demande qui en contient plusieurs (« vends 2 riz et ajoute le client Awa »)
  reçoit la première et la phrase « Je fais d'abord la vente ; redis-moi le reste ensuite ».
- Le chemin rapide d'un seul appel reste : brouillon valide + `repondre` dans le même tour.

## Confirmation et correction à la voix

Quand le téléphone attend une confirmation, il l'indique dans la demande suivante : `{ attente: { mission } }`.
Le serveur ajoute alors l'outil `confirmer { reponse: "oui" | "non" }` et le rappel de la mission dans les consignes :

- « waaw », « oui », « bind ko », « def ko » ▶ `confirmer oui` ;
- « déedéet », « non », « bayyil » ▶ `confirmer non` ;
- une correction (« dafa am ñett kilo », « c'est Awa le client ») ▶ un nouveau brouillon du même type ; le téléphone
  rejoue la mission corrigée sur l'écran déjà ouvert (le formulaire est vidé puis rempli à nouveau), puis redemande.

Le bouton Oui et le bouton Non restent toujours disponibles : la voix est un raccourci, jamais la seule voie.

## Moteur du mode pilote (téléphone)

Dossier `src/components/assistant/pilote/` :

- **Recettes** (`recettes.ts`, sans React) : `etapesPour(mission) → Etape[]`. Une étape est soit `ouvrir(url)`,
  soit `attendrePilote(ecran)`, soit `agir(cible, operation, valeur)`, soit `confirmer(resume)`, soit `montrer(cible)`.
  Fonctions pures, testées seule à seule.
- **Joueur** (`moteur.ts`, sans React) : exécute les étapes avec une interface injectée (`ouvrir`, `pilote`,
  `pointer`, `attendre`, `demander`). Il porte toute la logique (ordre, délais, arrêt, confirmation) et se teste avec
  des faux.
- **Pilotes d'écran** : chaque formulaire visé enregistre, pendant qu'il est affiché, un pilote typé avec
  `usePiloteEcran("vente", { ajouterProduit, choisirClient, choisirPaiement, enregistrer, … })`. Une opération modifie
  **l'état réel du formulaire** avec les mêmes fonctions que les doigts du commerçant (pas d'événements simulés sur le
  DOM, qui cassent avec les listes déroulantes Radix). `enregistrer()` appelle le même gestionnaire que le bouton
  final et rend `{ ok, message }`.
- **Cibles** : chaque champ ou bouton touché par une recette porte `data-assistant="<écran>.<élément>"`
  (ex. `vente.produit.<id>`, `vente.paiement.wave`, `vente.enregistrer`). Le doigt se pose sur la cible, l'opération
  s'exécute, puis une pause courte (≈ 450 ms) laisse voir le résultat.
- **Doigt** (`doigt.tsx`) : un rond fixe au-dessus de la page qui glisse (transition CSS) jusqu'au centre de la cible,
  avec un anneau de surbrillance et une onde au « toucher ». La page défile pour amener la cible à l'écran.
- **Bulle** (`bulle.tsx`) : pendant une mission, le panneau se réduit en une barre flottante en bas de l'écran :
  ce que fait l'assistant (« Je remplis la vente… »), bouton **Arrêter**, puis à la confirmation le résumé (total),
  **Oui** / **Non** et le micro. On peut rouvrir le fil complet.
- **Reprise en main** : toucher la page en dehors de la bulle pendant que l'assistant joue arrête la mission
  (« Tu as repris la main »). Ce qui est déjà rempli reste à l'écran.
- **Attente des écrans** : après `ouvrir`, le moteur attend le pilote de l'écran (au plus 8 s), puis la cible
  (au plus 3 s). Sinon il s'arrête et dit pourquoi, sans rien enregistrer.
- **Résultat** : après `enregistrer()`, il dit la phrase prête « Bind naa ko » / « C'est enregistré », ou lit le
  message d'erreur de l'action et laisse l'écran tel quel.

## Voix wolof

Cause de la panne : `ANTA_TTS_URL` n'existe pas sur Vercel ; le serveur public de la voix dort et met plusieurs
minutes à se réveiller.

- **Copie dans le compte Hugging Face du commerçant** (gratuite, sans carte graphique) de l'espace
  `ndaosaer/wolof-tts` (Flask : `GET /health`, `POST /predict { text } → audio/wav`). Son adresse va dans
  `ANTA_TTS_URL` (Vercel et `.env.local`).
- **Toujours éveillée** : l'espace s'endort après 48 h sans usage ; une tâche planifiée Vercel quotidienne appelle
  `GET /health`. À l'ouverture de l'assistant, le téléphone demande aussi un réveil (sans attendre la réponse).
- **Phrases prêtes** : les phrases du parcours (ci-dessous) sont produites une fois avec la voix Anta et rangées dans
  `public/assistant/voix/`. Elles se jouent immédiatement. En français, la voix du téléphone suffit.
- **Phrase par phrase** : une réponse libre est découpée en phrases ; la première est lue dès qu'elle est prête
  pendant que la suivante se prépare.
- **Messages honnêtes** : si la voix dort, « La voix wolof se réveille, elle revient dans quelques minutes » ; le texte
  reste affiché.
- Attendu sur l'offre gratuite : phrases prêtes immédiates ; réponse libre 5 à 15 s après le texte. Une voix en 1 à
  2 s demandera un serveur payant avec carte graphique (plus tard, au choix du commerçant).
- Licence : la voix Anta n'est pas utilisable dans une version payante ; à réentraîner avant la commercialisation
  (déjà noté dans le LISEZ-MOI).

Phrases prêtes (wolof à faire valider par le commerçant, français entre parenthèses) :

| Clé | Wolof | Français |
|---|---|---|
| `je-m-en-occupe` | Waaw, maa ngi ko def. | D'accord, je m'en occupe. |
| `je-peux-enregistrer` | Ndax ma bind ko ? | Je l'enregistre ? |
| `enregistre` | Bind naa ko. | C'est enregistré. |
| `laisse` | Baax na, bayyi naa ko ci écran bi. | D'accord, je le laisse à l'écran. |
| `reprise` | Yaa ngi ko jël. | Tu as repris la main. |
| `souci` | Am na jafe-jafe, xoolal écran bi. | Il y a un souci, regarde l'écran. |
| `voici` | Mii ngi nii. | Voilà. |

## Écrans pilotés (phase 1)

Constats sur le code actuel (lecture du 2026-11-11) : tous les formulaires gardent leur état avec `useState` ; aucun
`data-*` de test n'existe ; les listes déroulantes sont des Select / Popover Radix ; les fiches client et fournisseur
ont des champs non contrôlés lus avec `FormData`. Chaque écran reçoit donc un pilote branché sur ses propres
fonctions, et ses cibles `data-assistant`.

| Mission | Page ouverte | Pilote (opérations) | Bouton final |
|---|---|---|---|
| `vente` | `/vendre` | `PosScreen` : `ajouterProduit(id, qté)` (via `setQty`), `prixNegocie(id, prix)`, `remise(montant)`, `ouvrirEncaisser()` ; puis `CheckoutForm` (pilote `vente.encaisser`, monté avec la fenêtre) : `paiement(méthode)`, `montantRecu(montant)`, `client(id)` | « Valider la vente » → `createSale` (en ligne) ou file d'attente hors ligne |
| `entree_stock` | `/stock/entree` | `PurchaseForm` : `ajouterLigne(id, qté, coût?)`, `fournisseur(id)`, `note(texte)` | « Valider l'entrée » → `createPurchase` |
| `sortie_stock` | `/stock/sortie?produit=<id>` | `ExitForm` : `genre(perte \| sortie)`, `motif(clé)`, `quantite(n)`, `note(texte)` | « Enregistrer la perte / la sortie » → `createStockExit` |
| `commande` | `/commandes/nouvelle` | `OrderForm` : `client(id)`, `canal(clé)`, `ajouterLigne(id, qté)`, `livraison(adresse, frais)`, `acompte(montant, méthode)`, `note(texte)` | « Enregistrer la commande » → `createOrder` |
| `statut_commande` | `/commandes/<id>` | `OrderStatusButtons` : `changerStatut(état)` (la confirmation de l'assistant remplace la fenêtre « Êtes-vous sûr » ; transitions de `nextStatuses`) | bouton de l'état visé → `updateOrderStatus` |
| `paiement_client` | `/clients/<id>` | `PaymentDialog` (ouverture pilotée) : `montant(n)`, `methode(clé)`, `note(texte)` | « Valider » → `recordCustomerPayment` |
| `produit` | `/produits/nouveau` | `ProductForm` : `champ(clé, valeur)` via `set`, `categorie(id \| nouvelle)`, `unite(clé)`, `stockInitial(n)` | « Ajouter le produit » → `createProduct` |
| `prix` | `/produits/<id>/modifier` | `ProductForm` : `champ("salePrice" \| "costPrice", valeur)` | « Enregistrer les modifications » → `updateProduct` |
| `client` | `/clients` | `CustomerDialog` (ouverture pilotée) : `nom`, `telephone`, `adresse` écrits dans les champs | « Enregistrer » → `createCustomer` |
| `fournisseur` | `/fournisseurs` | `SupplierDialog` (reçoit une ouverture pilotée) : `nom`, `telephone`, `note` | « Enregistrer » → `createSupplier` |

« Montre-moi » (mission `ecran`) : pages et réglages déjà lus dans l'adresse.

| Écran | Adresse | Cible montrée |
|---|---|---|
| Tableau de bord | `/tableau-de-bord` | carte du chiffre du jour (version téléphone `MobileHome` et version large) |
| Rapports | `/rapports?periode=7j \| 30j \| mois \| mois-dernier \| 90j` | carte du chiffre d'affaires ; seulement si l'offre a les rapports avancés, sinon tableau de bord |
| Stock bas / ruptures | `/produits?etat=bas` ou `?etat=rupture` | la liste |
| Ventes | `/ventes?periode=today \| yesterday \| 7j \| mois` (+ `etat=credit` pour les ventes à crédit) | le total de la période |
| Commandes | `/commandes` | la liste |
| Client / produit | `/clients/<id>`, `/produits/<id>` | le solde du client / le stock du produit |

Adaptations nécessaires du code existant (sans changer ce que voit le commerçant qui travaille à la main) :

- **Résultat de l'enregistrement** : les gestionnaires des boutons finals rendent `{ ok, message }` au pilote (la
  caisse : `PosScreen.checkout` ; une vente mise en file hors ligne au moment d'enregistrer suit le chemin actuel et
  affiche le reçu hors ligne).
- **Fenêtres ouvertes par le pilote** : `PaymentDialog`, `CustomerDialog`, `SupplierDialog` et la fenêtre
  d'encaissement acceptent une ouverture contrôlée.
- **Plusieurs éléments pour une cible** (ex. « Encaisser » dans le panneau large et dans la barre « Voir le panier »
  du téléphone) : le doigt va sur celui qui est visible.
- **Conversation gardée** : l'état de l'assistant (fil, mission, phase) monte dans un `AssistantProvider` du layout
  `(app)`, à côté de `AssistantButton`. Fermer le panneau ou changer de page ne perd plus rien.
- **Fenêtres modales** : le panneau actuel est une `Sheet` modale (la page derrière est bloquée). Pendant une mission
  il se ferme et laisse place à la bulle. Les composants `ui/dialog` et `ui/sheet` ignorent les touches sur la bulle
  (`onPointerDownOutside` / `onInteractOutside`), pour que Oui / Non / Arrêter restent utilisables pendant que la
  fenêtre d'encaissement ou de paiement est ouverte ; `ui/alert-dialog` n'est jamais ouvert par l'assistant et ne se
  ferme pas sur un toucher extérieur. Bulle au-dessus des fenêtres (z-index 60), en haut de l'écran sur téléphone (en
  bas, elle cacherait la barre du panier), doigt au-dessus de tout et sans capter les touches (z-index 70,
  `pointer-events: none`).
- **Hors ligne** : le bouton de l'assistant est déjà désactivé hors connexion ; une vente lancée en ligne qui tombe
  hors ligne au moment d'enregistrer suit le chemin actuel (file d'attente).

## Erreurs

| Cas | Ce que voit et entend le commerçant |
|---|---|
| Nom de produit ou de client ambigu / introuvable | une question courte, aucun écran n'est ouvert |
| Écran qui ne répond pas (pilote absent) | « Il y a un souci, regarde l'écran », mission arrêtée, rien d'enregistré |
| Le commerçant touche l'écran | mission arrêtée, « Tu as repris la main » |
| L'action refuse (stock, droits, prix) | message de l'action lu à voix haute, écran laissé rempli |
| Voix wolof indisponible | texte affiché + « la voix se réveille » ; le parcours continue sans voix |
| Gemini saturé | message actuel « réessaie dans une minute » (client à modèles de secours déjà en ligne) |

## Sécurité

- Rien n'est enregistré sans « oui » (voix ou bouton) ; le bouton final est celui de l'écran, donc l'action existante
  revérifie tout.
- Les outils proposés à Gemini dépendent du rôle et des modules (comme aujourd'hui) ; un pilote d'écran n'existe que
  sur une page que l'utilisateur peut ouvrir.
- Les noms et paroles restent des données pour Gemini (consigne actuelle).
- Pas de nouvelle donnée en base, pas de migration.

## Tests

Le projet teste avec vitest en environnement Node (`src/**/*.test.ts`, pas de jsdom ni de Playwright) : toute la
logique vit donc dans des modules sans React.

- Recettes : pour chaque type de mission, les étapes attendues.
- Joueur : avec des pilotes et une interface factices, ordre des étapes, attente des écrans (délais dépassés), arrêt
  par toucher, confirmation oui / non / correction, résultat ok / refus de l'action.
- Brouillons et outils : nouveaux outils, droits par rôle et par module, cas ambigu / introuvable, transitions
  d'état de commande, motifs de sortie, période → adresse de page.
- Contrat cibles : un test lit les fichiers des écrans et vérifie que chaque cible `data-assistant` (et chaque
  préfixe de cible dynamique comme `vente.produit.`) utilisée par une recette y figure. Un écran remanié qui perd une
  cible fait échouer les tests au lieu de casser l'assistant en silence.
- Typecheck et lint comme d'habitude ; essai réel par le commerçant dans l'application en ligne.
