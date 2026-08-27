# LifeCycle Pro — Guide Architecture pour Claude

## Vue d'ensemble

**LifeCycle Pro** est une application Next.js 15 full-stack qui centralise les données de performance cycliste, nutrition, gestion du foyer et bien-être dans une interface dark-mode unifiée.

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS + shadcn/ui (Radix UI) |
| Icônes | lucide-react |
| Backend | Firebase (Auth + Firestore) |
| IA | Claude (`@anthropic-ai/sdk`, modèle `claude-haiku-4-5`) |
| Charts | Recharts |
| Dates | date-fns avec locale `fr` |
| Validation | Zod + react-hook-form |

## Structure des Fichiers

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (FirebaseClientProvider + Toaster)
│   ├── page.tsx                  # Landing page publique
│   ├── globals.css               # Variables CSS + classes utilitaires (.apple-card, .text-gradient)
│   ├── login/page.tsx            # Authentification (email + Google)
│   ├── register/page.tsx         # Inscription (email + Google)
│   ├── cycling/page.tsx          # Hub cyclisme (CTL/ATL/TSB + budget kJ, gouverneur de charge, coach mémoire, matériel, chaînes)
│   ├── nutrition/page.tsx        # Plan nutrition + livre de recettes (Firestore)
│   ├── weather/page.tsx          # Assistant météo IA (flow Claude)
│   ├── home-management/page.tsx  # Tâches récurrentes + plantes (Firestore)
│   ├── lifestyle/page.tsx        # Sommeil, HRV, stress, récupération
│   ├── finance/page.tsx          # Budgets et dépenses lifestyle
│   └── settings/page.tsx        # Intégration Intervals.icu (Firestore)
│
├── components/
│   ├── layout/
│   │   └── sidebar.tsx           # AppNavigation : sidebar desktop + bottom nav mobile
│   └── ui/                       # Composants shadcn/ui (button, card, dialog, etc.)
│
├── firebase/
│   ├── index.ts                  # Exports publics du module Firebase
│   ├── config.ts                 # firebaseConfig (variables d'env)
│   ├── provider.tsx              # FirebaseProvider (contexte Auth + Firestore)
│   ├── client-provider.tsx       # FirebaseClientProvider (wrapper SSR-safe)
│   ├── auth/use-user.tsx         # Hook useUser() → { user }
│   ├── firestore/
│   │   ├── use-collection.tsx    # Hook useCollection(path | query) → { data, loading }
│   │   └── use-doc.tsx           # Hook useDoc(path) → { data, loading }
│   ├── errors.ts                 # FirestorePermissionError
│   ├── error-emitter.ts          # errorEmitter (EventEmitter pour erreurs Firestore)
│   ├── non-blocking-updates.tsx  # Wrapper pour mutations Firestore non-bloquantes
│   └── non-blocking-login.tsx    # Wrapper pour login non-bloquant
│
├── ai/
│   ├── anthropic.ts               # Client Claude (Anthropic SDK) + helper generateJson()
│   └── flows/
│       ├── cycling-outfit-recommendation-flow.ts  # Recommandation tenue cycliste (tool use)
│       ├── identify-plant-flow.ts                 # Identification de plante par photo (vision)
│       └── recovery-insight-flow.ts               # Analyse récupération (texte)
│
├── hooks/
│   ├── use-toast.ts              # Hook toast (shadcn)
│   └── use-mobile.tsx            # Hook useIsMobile()
│
└── lib/
    └── utils.ts                  # cn() helper (clsx + tailwind-merge)
```

## Patron de Page (App)

Toutes les pages de l'application authentifiée suivent ce patron exact :

```tsx
"use client"

import { AppNavigation } from '@/components/layout/sidebar'

export default function MyPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Catégorie</h2>
            <h1 className="text-3xl font-bold">Titre de la Page</h1>
          </div>
          {/* Actions header optionnelles */}
        </header>

        {/* Contenu avec Tabs ou sections */}
      </main>
    </div>
  )
}
```

Points clés :
- `pb-20 md:pb-0` : espace pour la bottom nav mobile
- `md:pl-64` : espace pour la sidebar desktop (largeur 256px)
- `mt-16 md:mt-0` dans le header : compense le header mobile fixe

## Navigation (`AppNavigation`)

Définie dans `src/components/layout/sidebar.tsx`. La nav items list :

```ts
const navItems = [
  { name: 'Cyclisme',    href: '/cycling',         icon: Bike },
  { name: 'Nutrition',   href: '/nutrition',        icon: CookingPot },
  { name: 'Météo AI',    href: '/weather',          icon: CloudSun },
  { name: 'Maison',      href: '/home-management',  icon: Home },
  { name: 'Vie & Santé', href: '/lifestyle',        icon: HeartPulse },
  { name: 'Finances',    href: '/finance',          icon: Wallet },
]
```

Maison regroupe les tâches récurrentes et les plantes sous deux onglets (`TasksTab`/`PlantsTab`
dans `src/components/home-management/`) — anciennement deux modules de nav séparés (Maison +
Botanica), fusionnés suite à l'audit (voir `AUDIT.md`/`PLAN.md` section 3.2). L'ancienne route
`/botanica` redirige vers `/home-management` (`next.config.ts`).

Pour ajouter un module : ajouter une entrée ici + créer `src/app/<route>/page.tsx`.

## Modèle de Données Firestore

Toutes les données utilisateur sont sous `users/{uid}/` :

| Collection | Document | Description |
|-----------|----------|-------------|
| `users/{uid}/recipes` | `{recipeId}` | Recettes : title, ingredients[], instructions, calories, protein, carbs |
| `users/{uid}/tasks` | `{taskId}` | Tâches : name, room, priority, recurrenceDays, nextDueDate (Timestamp), isActive |
| `users/{uid}/settings/intervals` | (singleton) | intervalsAthleteId, intervalsApiKey |
| `users/{uid}/settings/powerCurve` | (singleton) | shortRecord/mediumRecord/longRecord `{seconds, watts}` — records perso pour l'indice d'endurance de Riegel |
| `users/{uid}/coachInjuries` | `{injuryId}` | Blessures : bodyRegion, severity (1-5), status, startDate, description, physioInstructions |
| `users/{uid}/coachGoals` | `{goalId}` | Objectifs coach IA : eventName, eventDate, targetOutcome, priority |
| `users/{uid}/coachMemory` | `lifestyle` / `facts` (singletons) | Style de vie (texte libre) et faits retenus (`items: string[]`) |
| `users/{uid}/sessionFeedback` | `{activityId}` ou `daily-{yyyy-MM-dd}` | RPE (1-10), feeling, motivation par séance — alimente le gouverneur de charge interne |

### Hooks Firebase

```ts
// Lecture temps-réel d'une collection
const { data, loading } = useCollection(`users/${uid}/recipes`)

// Lecture temps-réel avec query
const q = query(collection(db, path), where(...))
const { data, loading } = useCollection(q)

// Lecture d'un document
const { data, loading } = useDoc(`users/${uid}/settings/intervals`)

// Contexte Auth
const { user } = useUser()
const auth = useAuth()
const db = useFirestore()
```

### Gestion des erreurs Firestore

Pour les mutations, utiliser le pattern :

```ts
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

setDoc(ref, data).catch(async () => {
  const permissionError = new FirestorePermissionError({
    path: ref.path,
    operation: 'create', // 'create' | 'update' | 'delete'
    requestResourceData: data,
  })
  errorEmitter.emit('permission-error', permissionError)
})
```

## Flows IA (Claude)

Les flows sont dans `src/ai/flows/` et s'appellent côté client via des Server Actions Next.js
(fonctions `'use server'` important directement, pas d'abstraction Genkit). Chaque flow appelle
`@anthropic-ai/sdk` via le client partagé `src/ai/anthropic.ts` (modèle `claude-haiku-4-5`,
suffisant et peu coûteux pour ces usages perso). Le helper `generateJson(schema, { system, messages })`
demande une réponse JSON pure à Claude et la valide avec Zod — pattern uniforme utilisé par les
3 flows plutôt que `output_config.format` (plus simple à garder cohérent avec l'appel d'outil du
premier flow).

### Flow existant : `cyclingOutfitRecommendation`
- Input : `{ location, dateTime, durationHours, clothingInventory[] }`
- Output : `{ predictedWeather, recommendation, recommendedItems[] }`
- Usage : `src/app/weather/page.tsx`
- Utilise le tool use de Claude (`get_weather_forecast`, appelle Open-Meteo) avant de produire le JSON final.

### Flow existant : `identifyPlant`
- Input : `{ photoDataUri }` (base64 data URI)
- Output : identification botanique + conseils de soin
- Usage : `src/components/home-management/plants-tab.tsx` (onglet Plantes de Maison)
- Envoie l'image comme content block `{ type: 'image', source: { type: 'base64', ... } }` (vision Claude).

### Flow existant : `recoveryInsight`
- Input : `{ dailyMetrics[], goals[], training }`
- Output : `{ summary, recommendation, highlights[], watchouts[] }`
- Usage : `src/app/lifestyle/page.tsx` (bouton "Analyser" dans l'onglet Récupération)

### Créer un nouveau flow

```ts
// src/ai/flows/mon-flow.ts
'use server'
import { z } from 'zod'
import { generateJson } from '@/ai/anthropic'

const OutputSchema = z.object({ ... })

export async function monFlow(input: MonInput) {
  const system = `Instructions... Réponds UNIQUEMENT avec un objet JSON de cette forme : {...}`
  return generateJson(OutputSchema, {
    system,
    messages: [{ role: 'user', content: '...' }],
  })
}
```

Variable d'environnement requise : `ANTHROPIC_API_KEY` (déclarée dans `apphosting.yaml`, secret
`anthropic-api-key` à créer dans Secret Manager via `firebase apphosting:secrets:set`).

## Design System

### Classes CSS Utilitaires (globals.css)

```css
.apple-card        /* Card arrondie avec ombre douce et hover lift */
.glass-header      /* Header sticky avec backdrop-blur */
.text-gradient     /* Dégradé foreground → foreground/50 */
```

### Tokens CSS (thème clair par défaut, bascule sombre via `useTheme()`)

Le thème par défaut d'un nouveau visiteur est **clair** — la classe `.dark` n'est ajoutée à
`<html>` que si `localStorage['lifecycle-theme'] === 'dark'` (voir le script anti-FOUC dans
`src/app/layout.tsx` et le hook `src/hooks/use-theme.ts`, basculé depuis `/settings`).

| Token | Valeur claire | Valeur sombre |
|-------|----------------|----------------|
| `--background` | #F5F5F7 (gris très clair) | #000000 |
| `--primary` / `--accent` | #007AFF (bleu système iOS) | #0A84FF |
| `--card` | #FFFFFF | #1C1C1E |
| `--border` | #E5E5EA | #3A3A3C |

Palette "Apple HIG" (`src/app/globals.css`), pas la palette bleu-électrique documentée dans une
version antérieure de ce fichier.

### Échelle de rayons (convention, pas encore appliquée partout — voir AUDIT.md)

`rounded-lg` (interactif inline) → `rounded-xl` (boutons/panneaux) → `rounded-2xl` (cartes) →
`rounded-3xl` (dialogues plein écran). Éviter les valeurs arbitraires `rounded-[Npx]` pour tout
nouveau composant.

### Composants UI disponibles

Tous dans `src/components/ui/` (shadcn/ui) :
`Button`, `Card`, `Badge`, `Tabs`, `Dialog`, `Input`, `Label`, `Textarea`, `Select`, `Progress`, `Skeleton`, `Avatar`, `Calendar`, `Popover`, `Sheet`, `ScrollArea`, `Separator`, `Slider`, `Switch`, `Table`, `Tooltip`, `Checkbox`, `Toast`

`MetricCard` (`src/components/ui/metric-card.tsx`) : wrapper pour tout widget dépendant d'une donnée optionnelle
(puissance, HRV, poids…). Props `isAvailable`, `requiredInputs: string[]`, `ctaLabel`/`ctaHref`/`ctaAction` — affiche
un état "métrique indisponible" explicite plutôt qu'un graphique vide ou une valeur par défaut trompeuse.

Charts via Recharts : `BarChart`, `LineChart`, etc. avec wrapper `ChartContainer`.

## Authentification

- Firebase Auth avec email/password et Google OAuth
- Après connexion : redirect vers `/home-management`
- Pages publiques : `/`, `/login`, `/register`
- Pages protégées : toutes les autres (accès conditionné à `useUser().user`)

## Commandes

```bash
npm run dev          # Serveur Next.js dev (port 9002, Turbopack)
npm run build        # Build production
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test          # Vitest (tests unitaires)
```

## Règles de développement

1. **Langue** : UI en français, code en anglais
2. **"use client"** : obligatoire sur toutes les pages et composants avec hooks
3. **Imports Firebase** : toujours depuis `@/firebase` (pas directement firebase/*)
4. **Mutations** : utiliser le pattern errorEmitter pour les erreurs Firestore
5. **Nouveau module** : page dans `src/app/<route>/page.tsx` + entrée dans `navItems` de sidebar.tsx
6. **Dates** : utiliser `date-fns` avec `import { fr } from 'date-fns/locale'`
7. **Images externes** : `picsum.photos` autorisé dans next.config.ts
