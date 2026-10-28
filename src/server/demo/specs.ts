import type { PlanId } from "@/lib/domain/plans";
import type { Role } from "@/lib/domain/permissions";

/** Produit d'une boutique de démonstration. */
export interface DemoProduct {
  name: string;
  cat: string;
  unit: string;
  cost: number;
  price: number;
  threshold: number;
  /** Stock de départ, par boutique (dans l'ordre des boutiques). */
  initial: number[];
  /** Popularité relative. */
  weight: number;
  /** Jamais réapprovisionné : montre une rupture ou un stock bas. */
  noRestock?: boolean;
}

export interface DemoSpec {
  plan: PlanId;
  /** Présentation courte de la boutique fictive (page Démo et guide). */
  pitch: string;
  owner: { name: string; email: string };
  team: { key: string; name: string; role: Exclude<Role, "owner"> }[];
  business: {
    name: string;
    activity: string;
    phone: string;
    address: string;
    city: string;
    modulePos: boolean;
    moduleOrders: boolean;
  };
  /** Ancienneté du commerce et nombre de jours d'activité simulés. */
  createdDaysAgo: number;
  historyDays: number;
  locations: { name: string; kind: string }[];
  products: DemoProduct[];
  customers: readonly (readonly [string, string, string])[];
  suppliers: { name: string; phone: string; note: string; cats: string[] }[];
  salesPerDay: [number, number];
  ordersPerDay: [number, number];
  orderChannels: string[];
  creditRate: number;
  losses: { day: number; product: string; qty: number; type: "adjust" | "inventory"; reason: string; note: string | null; depot?: boolean }[];
}

const domain = "sama-stock.invalid";

/**
 * Date des dernières modifications des données de démonstration : une démo préparée avant
 * est recréée à la visite suivante (à avancer quand ce fichier ou le générateur change).
 */
export const DEMO_DATA_SINCE = new Date("2026-10-28T21:12:00Z");

/** Essai : quincaillerie qui découvre l'application depuis 5 jours. */
const trial: DemoSpec = {
  plan: "trial",
  pitch: "Une quincaillerie de Thiès qui découvre Sama Stock depuis 5 jours : caisse, alertes de stock et crédits des artisans.",
  owner: { name: "Mamadou Ndiaye", email: `demo-essai@${domain}` },
  team: [],
  business: {
    name: "Quincaillerie Ndiaye & Fils",
    activity: "quincaillerie",
    phone: "+221339510000",
    address: "Marché central",
    city: "Thiès",
    modulePos: true,
    moduleOrders: true,
  },
  createdDaysAgo: 5,
  historyDays: 5,
  locations: [{ name: "Boutique principale", kind: "boutique" }],
  products: [
    { name: "Ciment 50 kg", cat: "Gros œuvre", unit: "sac", cost: 4200, price: 4600, threshold: 20, initial: [70], weight: 10 },
    { name: "Fer à béton 10 mm (barre)", cat: "Gros œuvre", unit: "piece", cost: 3600, price: 4200, threshold: 15, initial: [80], weight: 7 },
    { name: "Fer à béton 8 mm (barre)", cat: "Gros œuvre", unit: "piece", cost: 2400, price: 2900, threshold: 15, initial: [70], weight: 6 },
    { name: "Tôle ondulée 2 m", cat: "Gros œuvre", unit: "piece", cost: 4500, price: 5500, threshold: 10, initial: [30], weight: 3 },
    { name: "Clous de 8", cat: "Quincaillerie", unit: "kg", cost: 900, price: 1300, threshold: 5, initial: [25], weight: 5 },
    { name: "Fil de fer recuit", cat: "Quincaillerie", unit: "kg", cost: 1100, price: 1500, threshold: 5, initial: [8], weight: 4, noRestock: true },
    { name: "Cadenas laiton 40 mm", cat: "Quincaillerie", unit: "piece", cost: 1800, price: 3000, threshold: 5, initial: [20], weight: 3 },
    { name: "Peinture à eau blanche 20 L", cat: "Peinture", unit: "piece", cost: 17000, price: 21000, threshold: 4, initial: [10], weight: 3 },
    { name: "Peinture à huile 4 L", cat: "Peinture", unit: "piece", cost: 9000, price: 12000, threshold: 4, initial: [3], weight: 2, noRestock: true },
    { name: "Rouleau à peinture", cat: "Peinture", unit: "piece", cost: 1200, price: 2000, threshold: 6, initial: [18], weight: 3 },
    { name: "Câble électrique 2,5 mm²", cat: "Électricité", unit: "m", cost: 350, price: 500, threshold: 50, initial: [300], weight: 6 },
    { name: "Ampoule LED 12 W", cat: "Électricité", unit: "piece", cost: 900, price: 1500, threshold: 10, initial: [40], weight: 4 },
    { name: "Interrupteur simple", cat: "Électricité", unit: "piece", cost: 600, price: 1000, threshold: 10, initial: [35], weight: 3 },
    { name: "Tuyau PVC 32 (barre 4 m)", cat: "Plomberie", unit: "piece", cost: 2800, price: 3500, threshold: 8, initial: [25], weight: 4 },
    { name: "Robinet laiton 1/2", cat: "Plomberie", unit: "piece", cost: 3000, price: 4500, threshold: 5, initial: [12], weight: 3 },
    { name: "Colle PVC 250 ml", cat: "Plomberie", unit: "piece", cost: 1500, price: 2500, threshold: 5, initial: [3], weight: 3, noRestock: true },
    { name: "Brouette renforcée", cat: "Outillage", unit: "piece", cost: 22000, price: 28000, threshold: 2, initial: [5], weight: 1 },
    { name: "Pelle ronde", cat: "Outillage", unit: "piece", cost: 2500, price: 3500, threshold: 4, initial: [12], weight: 2 },
  ],
  customers: [
    ["Modou Seck (maçon)", "771010101", "Thiès Nord"],
    ["Entreprise BTP Diallo", "338221122", "Thiès, route de Dakar"],
    ["Cheikh Gaye (électricien)", "776060606", "Thiès, Cité Lamy"],
    ["Abdou Faye", "709080706", "Mbour"],
    ["Pape Ndour (plombier)", "785051525", "Thiès Est"],
    ["Alioune Diouf", "772020202", "Tivaouane"],
  ],
  suppliers: [{ name: "Grossiste BTP Thiès", phone: "+221776112233", note: "Ciment et fer livrés le lundi.", cats: ["Gros œuvre"] }],
  salesPerDay: [3, 7],
  ordersPerDay: [0, 1],
  orderChannels: ["telephone", "whatsapp"],
  creditRate: 0.2,
  losses: [{ day: 2, product: "Ampoule LED 12 W", qty: 2, type: "adjust", reason: "breakage", note: "Carton tombé à la livraison" }],
};

/** Pro : boutique de cosmétiques qui vend surtout en ligne, avec une petite équipe. */
const pro: DemoSpec = {
  plan: "pro",
  pitch: "Une boutique de cosmétiques qui vend surtout sur Instagram, WhatsApp et TikTok, avec une vendeuse et un magasinier.",
  owner: { name: "Ndèye Sarr", email: `demo-pro@${domain}` },
  team: [
    { key: "bineta", name: "Bineta Fall", role: "seller" },
    { key: "omar", name: "Omar Sène", role: "storekeeper" },
  ],
  business: {
    name: "Ndèye Beauté",
    activity: "ecommerce",
    phone: "+221775552211",
    address: "Sacré-Cœur 3, villa 120",
    city: "Dakar",
    modulePos: true,
    moduleOrders: true,
  },
  createdDaysAgo: 48,
  historyDays: 45,
  locations: [{ name: "Showroom Sacré-Cœur", kind: "boutique" }],
  products: [
    { name: "Sérum vitamine C 30 ml", cat: "Soins du visage", unit: "bouteille", cost: 4500, price: 8500, threshold: 5, initial: [25], weight: 7 },
    { name: "Crème hydratante visage", cat: "Soins du visage", unit: "piece", cost: 3500, price: 6500, threshold: 5, initial: [22], weight: 6 },
    { name: "Savon au curcuma", cat: "Soins du visage", unit: "piece", cost: 700, price: 1500, threshold: 15, initial: [80], weight: 9 },
    { name: "Masque argile verte", cat: "Soins du visage", unit: "piece", cost: 1800, price: 3500, threshold: 6, initial: [20], weight: 4 },
    { name: "Beurre de karité pur 250 g", cat: "Soins du corps", unit: "piece", cost: 1500, price: 3000, threshold: 10, initial: [60], weight: 9 },
    { name: "Huile de coco vierge 500 ml", cat: "Soins du corps", unit: "bouteille", cost: 2000, price: 3500, threshold: 8, initial: [30], weight: 6 },
    { name: "Lait de corps au karité", cat: "Soins du corps", unit: "bouteille", cost: 2500, price: 4500, threshold: 6, initial: [24], weight: 5 },
    { name: "Gommage au café", cat: "Soins du corps", unit: "piece", cost: 1500, price: 3000, threshold: 6, initial: [18], weight: 4 },
    { name: "Huile de ricin 100 ml", cat: "Cheveux", unit: "bouteille", cost: 1200, price: 2500, threshold: 8, initial: [35], weight: 6 },
    { name: "Shampooing à la chébé", cat: "Cheveux", unit: "bouteille", cost: 2500, price: 4500, threshold: 6, initial: [20], weight: 5 },
    { name: "Poudre de chébé 100 g", cat: "Cheveux", unit: "sachet", cost: 2000, price: 4000, threshold: 6, initial: [9], weight: 6, noRestock: true },
    { name: "Mèches brésiliennes", cat: "Cheveux", unit: "paquet", cost: 7000, price: 12000, threshold: 4, initial: [12], weight: 5 },
    { name: "Perruque lisse 40 cm", cat: "Cheveux", unit: "piece", cost: 22000, price: 35000, threshold: 2, initial: [5], weight: 2 },
    { name: "Parfum oriental 50 ml", cat: "Parfums", unit: "bouteille", cost: 6000, price: 12000, threshold: 3, initial: [14], weight: 4 },
    { name: "Thiouraye premium", cat: "Parfums", unit: "sachet", cost: 1000, price: 2500, threshold: 10, initial: [50], weight: 8 },
    { name: "Musc blanc 10 ml", cat: "Parfums", unit: "bouteille", cost: 1500, price: 3000, threshold: 8, initial: [30], weight: 5 },
    { name: "Rouge à lèvres mat", cat: "Maquillage", unit: "piece", cost: 1500, price: 3500, threshold: 8, initial: [30], weight: 5 },
    { name: "Fond de teint", cat: "Maquillage", unit: "piece", cost: 4000, price: 7500, threshold: 4, initial: [15], weight: 3 },
    { name: "Mascara volume", cat: "Maquillage", unit: "piece", cost: 2000, price: 4000, threshold: 5, initial: [20], weight: 3 },
    { name: "Kit pinceaux maquillage", cat: "Maquillage", unit: "piece", cost: 3500, price: 7000, threshold: 3, initial: [3], weight: 2, noRestock: true },
  ],
  customers: [
    ["Mariama Sy", "781112233", "Liberté 6"],
    ["Khady Faye", "705556677", "Grand Yoff"],
    ["Astou Gueye", "783334455", "Point E"],
    ["Coumba Diallo", "767778899", "Pikine Icotaf"],
    ["Seynabou Kane", "709990011", "Guédiawaye"],
    ["Binta Camara", "766665544", "HLM 5"],
    ["Aïssatou Ndiaye", "784443322", "Mermoz"],
    ["Penda Sall", "701239876", "Rufisque"],
    ["Fatima Ba", "773216549", "Ouest Foire"],
    ["Yacine Mbodj", "782587413", "Almadies"],
  ],
  suppliers: [
    { name: "Karité du Sine", phone: "+221775003344", note: "Cosmétiques naturels, livraison le jeudi.", cats: ["Soins du corps", "Soins du visage"] },
    { name: "Import Dubaï Beauty", phone: "+221781005566", note: "Mèches, parfums, maquillage.", cats: ["Cheveux", "Parfums", "Maquillage"] },
  ],
  salesPerDay: [1, 2],
  ordersPerDay: [2, 5],
  orderChannels: ["instagram", "instagram", "whatsapp", "whatsapp", "whatsapp", "tiktok", "tiktok", "facebook", "site"],
  creditRate: 0.1,
  losses: [
    { day: 30, product: "Parfum oriental 50 ml", qty: 1, type: "adjust", reason: "breakage", note: "Flacon cassé au déballage" },
    { day: 12, product: "Masque argile verte", qty: 2, type: "adjust", reason: "expired", note: null },
    { day: 5, product: "Rouge à lèvres mat", qty: 1, type: "inventory", reason: "inventory", note: null },
  ],
};

/** Business : boutique de mode avec un dépôt, une équipe et beaucoup de commandes en ligne. */
const business: DemoSpec = {
  plan: "business",
  pitch: "Une boutique de mode avec un dépôt, une équipe de 3 personnes et des commandes en ligne tous les jours.",
  owner: { name: "Awa Diop", email: `demo-business@${domain}` },
  team: [
    { key: "fatou", name: "Fatou Sow", role: "manager" },
    { key: "moussa", name: "Moussa Fall", role: "seller" },
    { key: "ibrahima", name: "Ibrahima Ndiaye", role: "storekeeper" },
  ],
  business: {
    name: "Awa Mode & Beauté",
    activity: "boutique",
    phone: "+221771234500",
    address: "Avenue Blaise Diagne, Médina",
    city: "Dakar",
    modulePos: true,
    moduleOrders: true,
  },
  createdDaysAgo: 64,
  historyDays: 60,
  locations: [
    { name: "Boutique Médina", kind: "boutique" },
    { name: "Dépôt Liberté 6", kind: "depot" },
  ],
  products: [
    { name: "Robe wax longue", cat: "Vêtements", unit: "piece", cost: 9000, price: 15000, threshold: 5, initial: [18, 30], weight: 9 },
    { name: "Boubou brodé homme", cat: "Vêtements", unit: "piece", cost: 18000, price: 28000, threshold: 3, initial: [8, 10], weight: 4 },
    { name: "Ensemble pagne tissé", cat: "Vêtements", unit: "piece", cost: 12000, price: 19500, threshold: 4, initial: [6, 8], weight: 5 },
    { name: "Chemise bazin riche", cat: "Vêtements", unit: "piece", cost: 7500, price: 12500, threshold: 5, initial: [14, 12], weight: 6 },
    { name: "T-shirt coton imprimé", cat: "Vêtements", unit: "piece", cost: 2500, price: 5000, threshold: 10, initial: [70, 60], weight: 10 },
    { name: "Sandales cuir artisanales", cat: "Chaussures", unit: "paire", cost: 6000, price: 10000, threshold: 4, initial: [12, 10], weight: 6 },
    { name: "Babouches brodées", cat: "Chaussures", unit: "paire", cost: 4500, price: 8000, threshold: 4, initial: [6, 0], weight: 5, noRestock: true },
    { name: "Baskets toile", cat: "Chaussures", unit: "paire", cost: 9500, price: 15000, threshold: 3, initial: [14, 6], weight: 4 },
    { name: "Sac à main simili cuir", cat: "Accessoires", unit: "piece", cost: 8000, price: 14000, threshold: 3, initial: [9, 5], weight: 5 },
    { name: "Foulard soie", cat: "Accessoires", unit: "piece", cost: 2500, price: 5000, threshold: 6, initial: [40, 20], weight: 7 },
    { name: "Parure bijoux dorés", cat: "Accessoires", unit: "piece", cost: 3500, price: 7500, threshold: 4, initial: [15, 0], weight: 5 },
    { name: "Lunettes de soleil", cat: "Accessoires", unit: "piece", cost: 2000, price: 4500, threshold: 5, initial: [20, 10], weight: 4 },
    { name: "Beurre de karité 250 g", cat: "Cosmétiques", unit: "piece", cost: 1500, price: 3000, threshold: 10, initial: [70, 50], weight: 9 },
    { name: "Savon noir naturel", cat: "Cosmétiques", unit: "piece", cost: 800, price: 1500, threshold: 12, initial: [90, 60], weight: 10 },
    { name: "Huile de coco 500 ml", cat: "Cosmétiques", unit: "bouteille", cost: 2000, price: 3500, threshold: 8, initial: [9, 24], weight: 7 },
    { name: "Parfum oriental 50 ml", cat: "Cosmétiques", unit: "bouteille", cost: 6000, price: 12000, threshold: 3, initial: [14, 6], weight: 4 },
    { name: "Lait de corps hydratant", cat: "Cosmétiques", unit: "bouteille", cost: 2500, price: 4500, threshold: 6, initial: [16, 12], weight: 5 },
    { name: "Encens thiouraye", cat: "Cosmétiques", unit: "sachet", cost: 1000, price: 2500, threshold: 10, initial: [50, 40], weight: 8 },
    { name: "Mèches brésiliennes", cat: "Mèches et perruques", unit: "paquet", cost: 7000, price: 12000, threshold: 4, initial: [3, 0], weight: 6, noRestock: true },
    { name: "Perruque lisse 40 cm", cat: "Mèches et perruques", unit: "piece", cost: 22000, price: 35000, threshold: 2, initial: [4, 3], weight: 2 },
  ],
  customers: [
    ["Fatou Diop", "771234567", "Parcelles Assainies U17"],
    ["Aminata Ba", "776543210", "Médina, rue 22"],
    ["Mariama Sy", "781112233", "Liberté 6"],
    ["Khady Faye", "705556677", "Grand Yoff"],
    ["Ndèye Sarr", "774445566", "Sicap Baobab"],
    ["Coumba Diallo", "767778899", "Pikine Icotaf"],
    ["Rokhaya Mbaye", "772223344", "Ouakam"],
    ["Astou Gueye", "783334455", "Point E"],
    ["Seynabou Kane", "709990011", "Guédiawaye"],
    ["Adama Thiam", "778889900", "Yoff Virage"],
    ["Binta Camara", "766665544", "HLM 5"],
    ["Ousmane Diagne", "775554433", "Keur Massar"],
    ["Aïssatou Ndiaye", "784443322", "Mermoz"],
    ["Penda Sall", "701239876", "Rufisque"],
  ],
  suppliers: [
    { name: "Grossiste Sandaga", phone: "+221776001122", note: "Tissus et prêt-à-porter. Paiement à 15 jours.", cats: ["Vêtements", "Chaussures"] },
    { name: "Karité du Sine", phone: "+221775003344", note: "Cosmétiques naturels, livraison le jeudi.", cats: ["Cosmétiques"] },
    { name: "Import Dubaï Fashion", phone: "+221781005566", note: "Mèches, parfums, accessoires.", cats: ["Accessoires", "Mèches et perruques"] },
  ],
  salesPerDay: [3, 8],
  ordersPerDay: [0, 3],
  orderChannels: ["whatsapp", "whatsapp", "whatsapp", "instagram", "instagram", "tiktok", "facebook", "telephone"],
  creditRate: 0.12,
  losses: [
    { day: 40, product: "Robe wax longue", qty: 1, type: "adjust", reason: "breakage", note: "Tache d'huile en vitrine" },
    { day: 15, product: "Parfum oriental 50 ml", qty: 1, type: "adjust", reason: "breakage", note: "Flacon tombé du présentoir" },
    { day: 8, product: "Foulard soie", qty: 2, type: "adjust", reason: "theft", note: "Constaté à la fermeture" },
    { day: 6, product: "Savon noir naturel", qty: 3, type: "inventory", reason: "inventory", note: null },
    { day: 4, product: "Lait de corps hydratant", qty: 2, type: "adjust", reason: "expired", note: null, depot: true },
  ],
};

export const DEMO_SPECS = { trial, pro, business } as const satisfies Record<PlanId, DemoSpec>;
