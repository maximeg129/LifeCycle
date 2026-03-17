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
| IA | Google Genkit (`genkit` + `@genkit-ai/google-genai`) |
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
│   ├── cycling/page.tsx          # Hub cyclisme (entraînement CTL/ATL + matériel)
│   ├── nutrition/page.tsx        # Plan nutrition + livre de recettes (Firestore)
│   ├── weather/page.tsx          # Assistant météo IA (Genkit flow)
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
│   ├── genkit.ts                 # Instance Genkit configurée avec Google GenAI
│   ├── dev.ts                    # Entrée pour `genkit:dev`
│   └── flows/
│       ├── cycling-outfit-recommendation-flow.ts  # Recommandation tenue cycliste
│       └── identify-plant-flow.ts                 # Identification de plante par photo
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
  { name: 'Cyclisme',       href: '/cycling',          icon: Bike },
  { name: 'Nutrition',      href: '/nutrition',         icon: CookingPot },
  { name: 'Météo AI',       href: '/weather',           icon: CloudSun },
  { name: 'Maison & Plantes', href: '/home-management', icon: Leaf },
  { name: 'Vie & Santé',    href: '/lifestyle',         icon: HeartPulse },
  { name: 'Finances',       href: '/finance',           icon: Wallet },
]
```

Pour ajouter un module : ajouter une entrée ici + créer `src/app/<route>/page.tsx`.

## Modèle de Données Firestore

Toutes les données utilisateur sont sous `users/{uid}/` :

| Collection | Document | Description |
|-----------|----------|-------------|
| `users/{uid}/recipes` | `{recipeId}` | Recettes : title, ingredients[], instructions, calories, protein, carbs |
| `users/{uid}/tasks` | `{taskId}` | Tâches : name, room, priority, recurrenceDays, nextDueDate (Timestamp), isActive |
| `users/{uid}/settings/intervals` | (singleton) | intervalsAthleteId, intervalsApiKey |

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

## Flows IA (Genkit)

Les flows sont dans `src/ai/flows/` et s'appellent côté client via des Server Actions Next.js.

### Flow existant : `cyclingOutfitRecommendation`
- Input : `{ location, dateTime, durationHours, clothingInventory[] }`
- Output : `{ predictedWeather, recommendation, recommendedItems[] }`
- Usage : `src/app/weather/page.tsx`

### Flow existant : `identifyPlant`
- Input : `{ photoDataUri }` (base64 data URI)
- Output : identification botanique + conseils de soin
- Usage : `src/app/home-management/page.tsx`

### Créer un nouveau flow

```ts
// src/ai/flows/mon-flow.ts
'use server'
import { ai } from '@/ai/genkit'
import { z } from 'genkit'

const InputSchema = z.object({ ... })
const OutputSchema = z.object({ ... })

export async function monFlow(input: z.infer<typeof InputSchema>) {
  return ai.generate({
    prompt: `...`,
    output: { schema: OutputSchema },
  })
}
```

## Design System

### Classes CSS Utilitaires (globals.css)

```css
.apple-card        /* Card arrondie avec ombre douce et hover lift */
.glass-header      /* Header sticky avec backdrop-blur */
.text-gradient     /* Dégradé foreground → foreground/50 */
```

### Tokens CSS (dark mode par défaut, `<html class="dark">`)

| Token | Valeur dark |
|-------|-------------|
| `--background` | Bleu très sombre (#0B0F1A) |
| `--primary` | Bleu électrique (HSL 230 84% 63%) |
| `--accent` | Bleu électrique (identique à primary) |
| `--card` | Identique background |
| `--border` | Bleu-gris sombre |

### Composants UI disponibles

Tous dans `src/components/ui/` (shadcn/ui) :
`Button`, `Card`, `Badge`, `Tabs`, `Dialog`, `Input`, `Label`, `Textarea`, `Select`, `Progress`, `Skeleton`, `Avatar`, `Calendar`, `Popover`, `Sheet`, `ScrollArea`, `Separator`, `Slider`, `Switch`, `Table`, `Tooltip`, `Checkbox`, `Toast`

Charts via Recharts : `BarChart`, `LineChart`, etc. avec wrapper `ChartContainer`.

## Authentification

- Firebase Auth avec email/password et Google OAuth
- Après connexion : redirect vers `/home-management`
- Pages publiques : `/`, `/login`, `/register`, `/pricing`
- Pages protégées : toutes les autres (accès conditionné à `useUser().user`)

## Commandes

```bash
npm run dev          # Serveur Next.js dev (port 9002, Turbopack)
npm run build        # Build production
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run genkit:dev   # Serveur Genkit (flows IA)
```

## Règles de développement

1. **Langue** : UI en français, code en anglais
2. **"use client"** : obligatoire sur toutes les pages et composants avec hooks
3. **Imports Firebase** : toujours depuis `@/firebase` (pas directement firebase/*)
4. **Mutations** : utiliser le pattern errorEmitter pour les erreurs Firestore
5. **Nouveau module** : page dans `src/app/<route>/page.tsx` + entrée dans `navItems` de sidebar.tsx
6. **Dates** : utiliser `date-fns` avec `import { fr } from 'date-fns/locale'`
7. **Images externes** : `picsum.photos` autorisé dans next.config.ts
