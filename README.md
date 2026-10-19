# Sama Stock

Gestion de stock, caisse, commandes en ligne et crédits clients pour les commerçants du Sénégal (SaaS multi-commerces).

- **Utilisateurs (lancement et tests) :** voir [LISEZ-MOI.md](LISEZ-MOI.md)
- **Cahier des charges :** [docs/cahier-des-charges.md](docs/cahier-des-charges.md)
- **Plan de développement :** [docs/superpowers/plans/2026-10-19-sama-stock-mvp.md](docs/superpowers/plans/2026-10-19-sama-stock-mvp.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · Neon Postgres + Drizzle ORM · Better Auth (email/mot de passe + Google) · Vitest · déploiement Vercel.

## Développement

```bash
cp .env.example .env      # puis renseigner DATABASE_URL, BETTER_AUTH_SECRET…
npm install
npm run db:migrate        # applique les migrations SQL (dossier drizzle/)
npm run dev               # http://localhost:3000
npm test                  # tests unitaires des règles métier
npm run typecheck
```

## Organisation du code

| Dossier | Rôle |
|---|---|
| `src/lib/domain/` | Règles métier pures et testées (droits, formules, coût moyen, statuts de commande) |
| `src/server/context.ts` | Session → commerce → rôle → état de la formule ; garde-fous des pages et des actions |
| `src/server/actions/` | Server Actions (toutes passent par `runAction` + `requireActionContext`) |
| `src/server/queries/` | Lectures en base par module |
| `src/server/services/stock.ts` | Seul point d'écriture du stock (`applyStockMovement`, verrouillage des lignes) |
| `src/app/(app)/` | Écrans de l'application connectée |
| `src/app/admin/` | Espace super-administrateur (emails listés dans `ADMIN_EMAILS`) |

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chaîne de connexion Neon (pooler) |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | URL publique de l'application |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Connexion Google (facultatif) |
| `ADMIN_EMAILS` | Emails des super-administrateurs, séparés par des virgules |
