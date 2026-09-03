# LifeCycle Pro

Application Next.js 15 personnelle qui centralise performance cycliste, coaching IA, nutrition,
gestion du foyer et bien-être. Voir `CLAUDE.md` à la racine pour l'architecture complète — ce
fichier ne couvre que le démarrage.

## Dépendances externes

L'app ne fonctionne pas seule : elle lit ses données de performance depuis un service tiers et
appelle un modèle de langage pour ses fonctionnalités de coaching. Aucune des deux n'est optionnelle
pour la majorité des écrans (Cyclisme, Coach, Journal en dépendent tous directement) — sans elles,
l'app reste utilisable pour Garage/Nutrition/Maison mais affiche des états "non connecté" ailleurs.

- **[Intervals.icu](https://intervals.icu)** — service gratuit et indépendant qui centralise
  l'historique d'entraînement (Garmin/Strava/Wahoo/etc. s'y connectent directement, LifeCycle ne
  parle jamais à ces appareils lui-même) et calcule CTL/ATL/TSB. LifeCycle lit ces données via
  l'API Intervals.icu, avec une clé API par utilisateur (`users/{uid}/settings/intervals`,
  jamais un secret partagé). **Le guide pas-à-pas pour un nouvel utilisateur est dans l'app**,
  `/onboarding` — pas la peine de le redupliquer ici.
- **Claude (Anthropic API)** — coaching IA (Stella, propositions de séance, plans, analyses de
  sortie). Nécessite `ANTHROPIC_API_KEY` (voir CLAUDE.md, section "Flows IA").
- **Firebase** (Auth + Firestore) — backend de l'app elle-même (comptes, toutes les données
  utilisateur). Config dans `src/firebase/config.ts`.

## Démarrage (développement)

```bash
npm install
npm run dev          # http://localhost:9002 (Turbopack)
```

Variable d'environnement requise pour les flows IA en local : `ANTHROPIC_API_KEY` (voir
`src/ai/anthropic.ts`). Sans elle, l'app démarre et fonctionne (Firestore, Intervals.icu) mais
tout appel à un flow IA échoue.

```bash
npm run build         # Build production
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test            # Vitest (tests unitaires)
```

## Pour aller plus loin

- `CLAUDE.md` — architecture, chaque décision produit et son contexte (retours utilisateur cités),
  patrons de code à suivre. Le document de référence pour reprendre ce projet.
- `/onboarding` (in-app) — le parcours de connexion Intervals.icu pour un utilisateur final, pas
  pour un dev.
- `firestore.rules` — modèle de sécurité (path-based ownership, tout sous `/users/{uid}/...`).
