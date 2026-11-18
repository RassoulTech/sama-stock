// src/lib/domain/assistant/carte.ts
import type { EcranAccess, NomEcran } from "./ecrans";

/**
 * Carte de la boutique : chaque page que l'assistant peut ouvrir, ce qu'on y voit (sections, sous le titre exact
 * affiché à l'écran), les filtres qu'il peut poser et les boutons utiles. Elle entre dans ses consignes pour qu'il
 * sache où aller, jusqu'où descendre et quoi lire, comme un employé qui connaît l'application par cœur.
 */
export interface PageCarte {
  ecran: NomEcran;
  titre: string;
  role: string;
  /** Sections dans l'ordre de la page, sous leur titre à l'écran ; « (haut) » = les chiffres tout en haut. */
  sections?: string[];
  filtres?: string;
  actions?: string;
  acces?: keyof EcranAccess;
}

export const CARTE: readonly PageCarte[] = [
  {
    ecran: "tableau_de_bord",
    titre: "Tableau de bord",
    role: "l'accueil : la journée en un coup d'œil",
    sections: [
      "(haut) Aujourd'hui, 7 derniers jours, Bénéfice du mois, Crédits clients, Alertes de stock, Commandes en cours",
      "Ventes des 7 derniers jours (graphique jour par jour)",
      "Alertes de stock (produits en rupture ou presque)",
      "Commandes en cours",
      "Dernières ventes",
      "Actions rapides",
    ],
  },
  {
    ecran: "rapports",
    titre: "Rapports",
    role: "l'analyse des ventes sur une période : ce qui se vend, ce qui rapporte, ce qui dort",
    sections: [
      "(haut) Chiffre d'affaires, Bénéfice brut, Marge moyenne, Pertes",
      "Évolution des ventes et du bénéfice (jour par jour)",
      "Ventes par catégorie (chiffre, part du total, nombre de ventes, bénéfice et marge de chaque catégorie)",
      "Meilleures ventes (les produits les plus vendus, classés par chiffre d'affaires, avec la quantité vendue)",
      "Produits les plus rentables (classés par bénéfice)",
      "Ventes par canal (boutique, WhatsApp, Instagram…)",
      "Ventes par mode de paiement (espèces, Wave, Orange Money, crédit)",
      "Produits qui dorment (en stock mais pas vendus depuis 30 jours)",
      "Pertes enregistrées (casse, vol, péremption, écarts d'inventaire)",
    ],
    filtres: "periode : 7jours, 30jours (par défaut), mois, mois_dernier, 90jours, ou dates (du / au) ; aujourd'hui et hier passent par dates",
    actions: "Exporter en Excel ; toucher une catégorie ouvre ses ventes",
    acces: "reports",
  },
  {
    ecran: "ventes",
    titre: "Ventes",
    role: "la liste des ventes, avec le total de la période en haut",
    filtres:
      "periode : aujourdhui (par défaut), hier, 7jours, 30jours, mois, mois_dernier, 90jours, dates ; etat : payees, credit (reste à payer), annulees, averifier ; paiement : cash, wave, orange_money, credit ; categorie (nom) ; recherche (numéro de vente ou nom du client)",
    actions: "toucher une vente ouvre son reçu",
  },
  { ecran: "ventes_credit", titre: "Ventes à crédit", role: "les ventes qui ont encore un reste à payer (mêmes filtres que ventes)" },
  { ecran: "derniere_vente", titre: "Reçu de la dernière vente", role: "le reçu, à imprimer ou envoyer sur WhatsApp" },
  { ecran: "vendre", titre: "Caisse", role: "pour vendre en boutique (panier, encaissement)" },
  {
    ecran: "produits",
    titre: "Produits",
    role: "le catalogue : stock, prix, statut de chaque produit",
    filtres: "etat : bas (stock bas), rupture ; categorie (nom) ; recherche (nom du produit)",
    actions: "Nouveau produit, Importer ; toucher un produit ouvre sa fiche",
    acces: "products",
  },
  { ecran: "stock_bas", titre: "Stock bas", role: "les produits presque épuisés", acces: "products" },
  { ecran: "ruptures", titre: "Ruptures", role: "les produits épuisés", acces: "products" },
  {
    ecran: "produit",
    titre: "Fiche produit (avec nom)",
    role: "un produit : stock disponible, prix de vente, valeur",
    sections: ["(haut) stock et prix", "Derniers mouvements (ventes, entrées, sorties du produit)"],
    actions: "Modifier, Entrée de stock, Sortie",
    acces: "products",
  },
  { ecran: "categories", titre: "Catégories", role: "les catégories de produits", acces: "products" },
  {
    ecran: "stock",
    titre: "Stock",
    role: "le stock du dépôt : valeur, alertes, et les actions Entrée, Sortie, Inventaire, Transfert, Historique",
    sections: ["Actions de stock", "Résumé du stock"],
    acces: "products",
  },
  { ecran: "entree_stock", titre: "Entrée de stock", role: "enregistrer la marchandise reçue (passe par brouillon_entree_stock)" },
  { ecran: "sortie_stock", titre: "Sortie de stock", role: "une perte ou une sortie hors caisse (passe par brouillon_sortie_stock)" },
  {
    ecran: "inventaire",
    titre: "Inventaire",
    role: "compter le stock réel : chaque produit a un champ « Quantité comptée pour <produit> », la recherche « Rechercher un produit », les onglets Tous, À compter, Écarts, un bouton « <produit> : quantité juste » et en bas « Valider l'inventaire »",
  },
  { ecran: "inventaires_passes", titre: "Inventaires passés", role: "les inventaires déjà validés et leurs écarts" },
  { ecran: "transfert", titre: "Transfert de stock", role: "déplacer du stock vers un autre dépôt" },
  {
    ecran: "historique_stock",
    titre: "Historique du stock",
    role: "tous les mouvements de stock, produit par produit",
    filtres:
      "periode : aujourdhui, 7jours, 30jours (par défaut), mois, mois_dernier, 90jours, tout, dates ; etat : in (entrées), out (ventes et sorties), loss (pertes et inventaire), transfer, fix (corrections) ; categorie ; recherche (nom du produit)",
  },
  {
    ecran: "commandes",
    titre: "Commandes",
    role: "les commandes en ligne et leur état",
    filtres: "etat : open (en cours, par défaut), new, preparing, shipping, delivered, closed (annulées / retournées), all ; periode ; recherche (numéro ou client)",
    actions: "toucher une commande ouvre son détail",
    acces: "orders",
  },
  { ecran: "nouvelle_commande", titre: "Nouvelle commande", role: "créer une commande (passe par brouillon_commande)", acces: "orders" },
  { ecran: "clients", titre: "Clients", role: "la liste des clients et ce qu'ils doivent", acces: "customers" },
  {
    ecran: "client",
    titre: "Fiche client (avec nom)",
    role: "un client : ce qu'il doit, ses achats et remboursements",
    sections: ["(haut) solde dû", "Historique (achats et remboursements)"],
    acces: "customers",
  },
  { ecran: "fournisseurs", titre: "Fournisseurs", role: "la liste des fournisseurs" },
  { ecran: "fournisseur", titre: "Fiche fournisseur (avec nom)", role: "un fournisseur et ses livraisons" },
  { ecran: "factures", titre: "Factures", role: "les factures (onglets Factures et Devis)" },
  { ecran: "devis", titre: "Devis", role: "les devis" },
  { ecran: "equipe", titre: "Équipe", role: "les membres de l'équipe et leurs rôles" },
  { ecran: "parametres", titre: "Paramètres", role: "le commerce, les documents, les modules, les couleurs" },
  { ecran: "mon_compte", titre: "Mon compte", role: "le compte de l'utilisateur" },
  { ecran: "licence", titre: "Licence", role: "l'offre et l'abonnement" },
];

/** La carte en texte pour les consignes, limitée aux pages auxquelles ce rôle a accès. */
export function carteTexte(acces: EcranAccess): string {
  return CARTE.filter((p) => !p.acces || acces[p.acces])
    .map((p) => {
      const lignes = [`- ${p.ecran} (${p.titre}) : ${p.role}.`];
      if (p.sections?.length) lignes.push(`  Sections, de haut en bas : ${p.sections.join(" ; ")}.`);
      if (p.filtres) lignes.push(`  Filtres : ${p.filtres}.`);
      if (p.actions) lignes.push(`  Boutons : ${p.actions}.`);
      return lignes.join("\n");
    })
    .join("\n");
}
