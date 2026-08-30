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
| Validation | Zod (schémas des flows IA) — les formulaires de dialogue utilisent `FormData` brut + validation manuelle, pas react-hook-form (dépendance présente, câblée uniquement dans le primitif shadcn `ui/form.tsx`, jamais importée ailleurs — voir AUDIT.md) |

## Structure des Fichiers

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (FirebaseClientProvider + Toaster)
│   ├── page.tsx                  # Landing page publique
│   ├── globals.css               # Variables CSS + classes utilitaires (.lc-card, .text-gradient)
│   ├── login/page.tsx            # Authentification (email + Google)
│   ├── register/page.tsx         # Inscription (email + Google)
│   ├── cycling/page.tsx          # Page données, pas d'onglets : tuiles Vue d'ensemble (CTL/ATL/TSB/FTP/Riegel/sommeil/HRV/readiness) + budget kJ + gouverneur + PMC (courbe 12 semaines, charge hebdo, records de puissance) en scroll continu
│   ├── cycling/metric/[id]/page.tsx  # Page détail d'une tuile Vue d'ensemble : courbe ~180j + explication (metric-info.ts) — une seule route dynamique pour les 8 métriques
│   ├── coach/page.tsx            # Hub coaching IA — 6 sous-onglets : Proposition du jour (défaut), Sorties (journal d'activités), Météo & Tenue (ex-/weather), Plan, Stella, Mémoire coach
│   ├── garage/page.tsx           # Matériel + Chaînes + Garde-robe (Firestore) — sorti de Cyclisme, sa propre destination de nav
│   ├── nutrition/page.tsx        # Plan nutrition + livre de recettes (Firestore)
│   ├── home-management/page.tsx  # Tâches récurrentes + plantes (Firestore)
│   ├── lifestyle/page.tsx        # Sommeil, HRV, stress, récupération (auto-sync Intervals.icu en priorité, saisie manuelle en complément — voir `mergeDailyWellness`)
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
import { PageHeader } from '@/components/ui/page-header'

export default function MyPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <PageHeader category="Catégorie" title="Titre de la Page" actions={<Button>...</Button>} />

        {/* Contenu avec Tabs ou sections */}
      </main>
    </div>
  )
}
```

Points clés :
- `pb-20 md:pb-0` : espace pour la bottom nav mobile
- `md:pl-64` : espace pour la sidebar desktop (largeur 256px)
- `mt-16 md:mt-0` (baked into `PageHeader`) : compense le header mobile fixe

## Navigation (`AppNavigation`)

Définie dans `src/components/layout/sidebar.tsx`. La nav items list :

```ts
const navItems = [
  { name: 'Cyclisme',    href: '/cycling',         icon: Bike },
  { name: 'Coach',       href: '/coach',           icon: BrainCircuit },
  { name: 'Garage',      href: '/garage',          icon: Wrench },
  { name: 'Nutrition',   href: '/nutrition',        icon: CookingPot },
  { name: 'Maison',      href: '/home-management',  icon: Home },
]
```

Maison regroupe les tâches récurrentes et les plantes sous deux onglets (`TasksTab`/`PlantsTab`
dans `src/components/home-management/`) — anciennement deux modules de nav séparés (Maison +
Botanica), fusionnés suite à l'audit (voir `AUDIT.md`/`PLAN.md` section 3.2). L'ancienne route
`/botanica` redirige vers `/home-management` (`next.config.ts`).

**Garage** (`src/app/garage/page.tsx`, Matériel/Chaînes/Garde-robe en sous-onglets) a sa propre
route et son propre item de nav — sorti de Cyclisme suite au retour utilisateur : il doit vivre
indépendamment du coaching/data, pas comme un sous-onglet noyé dedans. Garde-robe (vêtements
cycliste, `wardrobe-tab.tsx`) s'y est ajoutée ensuite — c'est du matériel comme le reste, elle
vivait auparavant dans Coach > Météo & Tenue (à côté de la fonctionnalité IA qui la consomme) plutôt
que dans Garage (à côté du reste du matériel) ; les données (`cyclingClothingItems`,
`src/components/weather/clothing-types.ts`/`use-clothing-inventory.ts`) n'ont pas bougé, seule
l'UI a changé de page.

**Coach** (`src/app/coach/page.tsx`) regroupe tout ce qui concerne planifier/faire/relire une
sortie et la relation coach : Proposition du jour (onglet par défaut), Sorties (le journal
d'activités, déplacé depuis Cyclisme > Vue d'ensemble), Météo & Tenue (l'ex-page `/weather`, qui
redirige maintenant ici — `next.config.ts` — et qui renvoie vers Garage > Garde-robe plutôt que
d'embarquer son propre CRUD vêtements), Plan, Stella, Mémoire coach — remplace l'ancien onglet
"Coaching" de Cyclisme. Planifier une sortie avec la bonne intensité et planifier une sortie avec
la bonne tenue sont le même geste ; les séparer en deux destinations de nav n'avait pas de sens.
Cyclisme redevient purement la page données (Vue d'ensemble + PMC, sans onglets — voir plus bas).
Proposition du jour peut aussi recevoir un lieu/heure de départ optionnels : le flow
`dailyWorkoutRecommendation` récupère alors la météo réelle (vent inclus) et ajoute un conseil de
direction pour l'avoir dans le dos au retour — voir la section flows IA plus bas.

**Chaque tuile de Vue d'ensemble renvoie vers `/cycling/metric/<id>`** (`cycling/metric/[id]/page.tsx`)
— une page détail avec la courbe des ~180 derniers jours et une explication du principe de
l'indicateur (`metric-info.ts`, contenu statique par métrique). CTL/ATL/TSB viennent de
`useFitnessChart` et Sommeil/HRV/Readiness de `useLifestyleData(180)` (le paramètre `days`,
optionnel, garde tous les appels existants à 7 jours par défaut inchangés) — `WELLNESS_WINDOW_DAYS`/
`FITNESS_WINDOW_DAYS` dans `use-intervals.tsx` sont passés de 90 à 180 jours pour donner de la marge.
FTP et l'indice Riegel n'ont pas d'historique suivi jour par jour aujourd'hui (FTP vient d'un test
ponctuel Intervals.icu, Riegel est recalculé à la volée depuis la courbe de puissance actuelle) —
leur page affiche honnêtement "pas encore d'historique suivi" plutôt que d'inventer une tendance.

**Vie & Santé et Finances ne sont plus dans `navItems`** (ni dans la nav mobile) — leurs pages
(`/lifestyle`, `/finance`) restent entièrement fonctionnelles mais ne sont plus accédées que via
la carte "Autres modules" de `/settings`. Les métriques Vie & Santé les plus utilisées par le
coach IA (sommeil, HRV, readiness) vivent désormais dans Cyclisme > Vue d'ensemble
(`performance-bento.tsx`), qui reste la même source de données (`useLifestyleData`) — pas une
copie. Le bottom nav mobile (5 icônes + Réglages) montre
Cyclisme/Coach/Garage/Nutrition/Maison.

Pour ajouter un module à la nav principale : ajouter une entrée à `navItems` + créer
`src/app/<route>/page.tsx`. Un module qui ne justifie pas une place dans la nav principale peut
rester accessible via la carte "Autres modules" de Réglages à la place.

## Modèle de Données Firestore

Toutes les données utilisateur sont sous `users/{uid}/` :

| Collection | Document | Description |
|-----------|----------|-------------|
| `users/{uid}/recipes` | `{recipeId}` | Recettes : title, ingredients[], instructions, calories, protein, carbs |
| `users/{uid}/tasks` | `{taskId}` | Tâches : name, room, priority, recurrenceDays, nextDueDate (Timestamp), isActive |
| `users/{uid}/settings/intervals` | (singleton) | intervalsAthleteId, intervalsApiKey |
| `users/{uid}/settings/powerCurve` | (singleton) | shortRecord/mediumRecord/longRecord `{seconds, watts}` — records perso pour l'indice d'endurance de Riegel. Auto-rempli depuis la vraie courbe de puissance Intervals.icu quand connecté (`usePowerCurve` fusionne manuel + auto, manuel prioritaire par champ — même logique que `mergeDailyWellness`) ; ce doc ne stocke que les valeurs manuellement corrigées, pas les valeurs auto-calculées |
| `users/{uid}/coachInjuries` | `{injuryId}` | Blessures : bodyRegion, severity (1-5), status, startDate, description, physioInstructions |
| `users/{uid}/coachGoals` | `{goalId}` | Objectifs coach IA : eventName, eventDate, targetOutcome, priority |
| `users/{uid}/coachMemory` | `lifestyle` / `facts` (singletons) | Style de vie (texte libre) et faits retenus (`items: string[]`) |
| `users/{uid}/sessionFeedback` | `{activityId}` ou `daily-{yyyy-MM-dd}` | RPE (1-10), feeling, motivation par séance — alimente le gouverneur de charge interne |
| `users/{uid}/workoutProposals` | `{yyyy-MM-dd}` | Proposition du jour IA : availableMinutes, proposal (sortie `dailyWorkoutRecommendation`), ride (`{location, departureDateTime}` optionnel — pour le conseil vent, voir plus bas), sentToIntervals — un doc par jour, écrasé à la régénération |
| `users/{uid}/trainingPlans` | `{planId}` | Plan structuré moyen/long terme IA : name, status (`active`/`archived` — un seul actif à la fois), eventName/eventDate, weeklyAvailableMinutes, weeks[] (phase/focus/targetWeeklyMinutes/notes par semaine, sortie `trainingPlanGeneration`, + `sampleSessions?` : séances type générées à la demande par `planWeekSessions` quand l'utilisateur déplie la semaine) — collection préexistante dans le schéma d'origine (jamais utilisée avant), réutilisée telle quelle |
| `users/{uid}/coachChatMessages` | `{messageId}` | Log plat du chat "Stella" : role (`user`/`assistant`), content, createdAt — append-only, aucune règle `update` (un message n'est jamais modifié, seulement créé ou supprimé en vidant l'historique) |

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

### Dialogues CRUD ("add X" / "edit X")

Pattern partagé pour tout dialogue d'ajout/édition (voir AUDIT.md/PLAN.md section 2.2 — 19 dialogues
répétaient ce squelette avant cette extraction) :

```tsx
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { useCrudSubmit } from '@/hooks/use-crud-submit'

const [open, setOpen] = useState(false)
const { isSaving, submit } = useCrudSubmit()

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  // ... validation manuelle + construction de `data` ...
  const ref = doc(collection(db, path))
  const ok = await submit(() => setDoc(ref, data), { path: ref.path, operation: 'create', requestResourceData: data })
  if (ok) { setOpen(false); toast({ title: '...' }) }
}

return (
  <CrudDialogShell title="..." trigger={<Button>...</Button>} open={open} onOpenChange={setOpen} isSaving={isSaving} onSubmit={handleSubmit}>
    {/* champs du formulaire */}
  </CrudDialogShell>
)
```

`useCrudSubmit` absorbe le `setIsSaving(true)/try/catch { errorEmitter... }/finally` identique
partout — il ne fait AUCUNE hypothèse sur ce que fait `action()` (un seul `setDoc`, plusieurs
écritures sur des collections différentes, calcul d'un agrégat...). `CrudDialogShell` absorbe le
chrome `Dialog/Header/Footer` + boutons Annuler/Enregistrer, avec `trigger` optionnel (omis si un
parent contrôle `open` lui-même, ex. un dialogue d'édition ouvert depuis un item de liste) et
`disableSubmit` pour désactiver la soumission sans toucher au bouton Annuler (ex. données externes
requises absentes). Les champs du formulaire et l'écriture Firestore elle-même restent propres à
chaque dialogue — c'est justement ce qui varie trop pour être généralisé sans forcer une forme qui
ne colle pas partout.

## Flows IA (Claude)

Les flows sont dans `src/ai/flows/` et s'appellent côté client via des Server Actions Next.js
(fonctions `'use server'` important directement, pas d'abstraction Genkit). Chaque flow appelle
`@anthropic-ai/sdk` via le client partagé `src/ai/anthropic.ts` (modèle `claude-haiku-4-5`,
suffisant et peu coûteux pour ces usages perso). Le helper `generateJson(schema, { system, messages })`
demande une réponse JSON pure à Claude et la valide avec Zod — pattern uniforme utilisé par 5 des
6 flows (tous sauf `cyclingOutfitRecommendation`, qui garde son appel d'outil manuel, et `coachChat`,
texte brut) plutôt que `output_config.format`.

**`generateJson` ne lève jamais d'exception** — il renvoie `FlowResult<T>` (`{ok:true, data} |
{ok:false, error}`), et chaque flow qui l'utilise propage ce type comme son propre type de retour
(`Promise<FlowResult<Output>>`, avec son corps entier dans un `try/catch` qui convertit toute
exception de validation d'input en `{ok:false, error}` de la même façon). Ce n'est pas un choix de
style : Next.js redacte le message de toute erreur qui traverse la frontière Server Action en
production — le client ne reçoit jamais que le texte générique "An error occurred in the Server
Components render...", quel que soit le message original (confirmé dans le bundle client
`react-server-dom-webpack`, fonction `resolveErrorProd()`). Un message ne survit que s'il voyage
comme donnée dans une promesse résolue, jamais comme rejet — d'où `{ok:false, error}` plutôt qu'un
`throw`. Chaque hook appelant (`use-daily-workout.ts`, `use-training-plan.ts`,
`recovery-insight-panel.tsx`, `plants-tab.tsx`) doit vérifier `result.ok` et afficher `result.error`
dans le toast plutôt que d'attraper une exception. `generateJson` logue aussi côté serveur
(`console.error`, visible dans les logs Firebase App Hosting/Cloud Run) chaque échec — appel API,
JSON introuvable/invalide, validation Zod — pour le débogage, puisque le client ne peut voir que la
version résumée dans `result.error`.

`fetchWeatherForecast`/`degreesToCompass` (`src/ai/weather.ts`) sont le fetch météo
réel (Open-Meteo, sans clé API) partagé par `cyclingOutfitRecommendation` (via tool use) et
`dailyWorkoutRecommendation` (appel direct, pas de tool use — la météo est un pré-fetch déterministe,
pas une décision à laisser au modèle).

### Flow existant : `cyclingOutfitRecommendation`
- Input : `{ location, dateTime, durationHours, clothingInventory[] }`
- Output : `{ predictedWeather, recommendation, recommendedItems[] }`
- Usage : `src/components/coach/weather-outfit-tab.tsx` (sous-onglet "Météo & Tenue" de Coach — ex-page `/weather`, qui redirige maintenant vers `/coach`)
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

### Flow existant : `dailyWorkoutRecommendation`
- Input : `{ date, availableMinutes, sportType?, training?, recentSessions[], planWeek?, recovery?, coachContext?, ride? }`
  — `recovery` (sleepHours/sleepQuality/hrv/readiness) vient de la même série fusionnée auto-sync Intervals.icu +
  saisie manuelle que Vie & Santé (`useLifestyleData`) : une mauvaise nuit doit réduire l'intensité proposée
  même si la charge d'entraînement suggérerait autre chose — la récupération prime en cas de tension.
  `ride` (`{location, departureDateTime}`, optionnel, saisi dans l'onglet) déclenche un fetch météo réel
  (`fetchWeatherForecast` dans `src/ai/weather.ts`, partagé avec `cyclingOutfitRecommendation`) — échoue en
  silence (pas de section météo dans le prompt) plutôt que de casser toute la génération si le lieu n'est pas
  géocodable.
- Output : `{ title, sportType, durationMinutes, intensityLabel, rationale, structuredWorkout, warnings[], windAdvice }`
  — `structuredWorkout` est le script texte du "workout builder" Intervals.icu que le site parse lui-même :
  en-têtes de section (optionnellement suffixés `Nx` pour une répétition) suivis de lignes `- <durée> <cible%>`.
  Le format inline `Nx (étape / étape)` n'est PAS reconnu par le parseur — voir le prompt du flow.
  `windAdvice` (string ou null) : conseil de direction générale au départ pour avoir le vent dans le dos au
  retour, rempli seulement quand `ride` est fourni ET que le vent prévu dépasse 15 km/h (seuil codé en dur,
  pas laissé à l'appréciation du modèle) — sinon `null`, jamais un conseil inventé sans signal réel.
- Usage : `src/components/cycling/daily-workout-tab.tsx` (sous-onglet "Proposition du jour" de Coach — onglet par défaut)
- Réutilise `buildCoachContext` (blessures/objectifs/style de vie/faits retenus/gouverneur/budget kJ) comme
  `recoveryInsight`, plus le CTL/ATL/TSB courant et les séances des 7 derniers jours (`summarizeRecentSessions`
  dans `daily-workout-types.ts`). L'utilisateur peut éditer le titre/durée/script avant envoi. Poussée sur le
  calendrier Intervals.icu via `IntervalsService.createPlannedWorkout()` → `POST /api/intervals/events`
  (`upsertOnUid=true` : ré-envoyer la même journée met à jour l'événement au lieu de le dupliquer, voir
  `dailyWorkoutExternalId`). Stocké dans `users/{uid}/workoutProposals/{yyyy-MM-dd}` (y compris `ride`, pour
  préremplir le lieu/heure à la réouverture de l'onglet).
- Si un plan d'entraînement actif existe (voir `trainingPlanGeneration` ci-dessous), reçoit en plus
  `planWeek` (phase/focus/volume cible de la semaine en cours, via `currentPlanWeek` dans
  `training-plan-types.ts`) — la séance du jour doit alors coller à la phase du plan plutôt qu'être
  générée dans le vide.

### Flow existant : `trainingPlanGeneration`
- Input : `{ today, goal, weekCount, weeklyAvailableMinutes, training?, coachContext? }`
- Output : `{ planName, weeks[] (phase/focus/targetWeeklyMinutes/notes — exactement `weekCount` éléments),
  warnings[] }`
- Usage : `src/components/cycling/training-plan-tab.tsx` (sous-onglet "Plan" de Coach)
- Périodisation classique (base → build → peak → taper, semaines recovery tous les 3-4 semaines) vers un
  objectif choisi parmi `coachGoals`. Le flow ne génère QUE le contenu de chaque semaine — jamais les
  dates elles-mêmes : `buildPlanWeekSkeleton`/`mergePlanWeeks` (`training-plan-types.ts`) calculent les
  bornes de semaine (alignées sur lundi) de façon déterministe et zippent le contenu IA dessus par index,
  pour éviter de faire faire de l'arithmétique de dates à l'IA. Un seul plan `active` à la fois par
  utilisateur (`status: 'active'|'archived'` sur `users/{uid}/trainingPlans/{planId}`) — en générer un
  nouveau archive l'ancien plutôt que de l'écraser.
- Cliquer sur une semaine dans le tableau du Plan la déplie et déclenche (une seule fois, en lazy —
  voir `planWeekSessions` ci-dessous) la génération de ses séances type, mises en cache dans
  `PlanWeek.sampleSessions` (champ optionnel sur `weeks[]`, absent tant que non générées).

### Flow existant : `planWeekSessions`
- Input : `{ weekNumber, phase, focus, targetWeeklyMinutes, notes?, sportType?, training?, coachContext? }`
  — le contenu d'une semaine de plan déjà générée par `trainingPlanGeneration`.
- Output : `{ sessions[] }` — entre 2 et 5 séances type (`title`, `sportType`, `durationMinutes`,
  `intensityLabel`, `rationale`, `structuredWorkout`) dont la somme des durées colle au volume cible de
  la semaine (±20%).
- Usage : `WeekSessionsPanel` dans `src/components/cycling/training-plan-tab.tsx`, déclenché à
  l'ouverture d'une semaine (voir ci-dessus).
- Distinct de `dailyWorkoutRecommendation` : ce ne sont PAS des séances adaptées au temps réellement
  disponible un jour précis ni à la récupération du moment — c'est la répartition idéale de la semaine
  étant donné sa phase/focus, que l'athlète peut ensuite envoyer telle quelle sur Intervals.icu pour une
  date de son choix dans la semaine (bouton par séance, date contrainte à `[week.startDate, week.endDate]`).
  Réutilise le même chemin de push que la Proposition du jour (`buildWorkoutEventPayload` dans
  `daily-workout-types.ts`, généralisé pour accepter un `externalId` ; ici `planSessionExternalId(planId,
  weekNumber, sessionIndex)` dans `training-plan-types.ts` — indépendant de la date choisie, donc changer
  la date d'une séance déplace l'événement calendrier au lieu de le dupliquer) et le même
  `STRUCTURED_WORKOUT_SYNTAX` (constante partagée exportée par `structured-workout-syntax.ts`, pour ne
  jamais laisser dériver la syntaxe du "workout builder" Intervals.icu entre les deux flows).

### ⚠️ Un fichier `'use server'` ne peut exporter QUE des fonctions async

Piège vécu en prod, très difficile à diagnostiquer : `STRUCTURED_WORKOUT_SYNTAX` vivait à l'origine
dans `daily-workout-recommendation-flow.ts` (un fichier `'use server'`), exportée à côté du flow
lui-même. Next.js interdit ça — *"A 'use server' file can only export async functions, found
string."* (`node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js`) —
mais cette vérification tourne **au runtime**, pas au build : `next build`/`tsc`/`next start` en
local ne montrent RIEN. En prod (Firebase App Hosting), ça faisait échouer **instantanément** —
avant même d'exécuter une seule ligne du flow — absolument tout appel à `dailyWorkoutRecommendation`
ET `planWeekSessions` (qui importait la constante depuis ce même fichier), avec le message générique
Next.js "An error occurred in the Server Components render..." côté client (voir `FlowResult` dans
`anthropic.ts`) et rien du tout dans les logs serveur (l'erreur est levée par Next.js lui-même, avant
que le code applicatif — donc les `console.error` de `generateJson` — n'ait la moindre chance de
tourner). Diagnostiqué par bisection avec des Server Actions de complexité croissante dans une route
de debug temporaire (`/debug-headers`, supprimée une fois confirmé) : une Server Action vide
réussissait, un appel Anthropic minimal depuis une Server Action réussissait, mais dès qu'une
d'elles importait quoi que ce soit depuis `daily-workout-recommendation-flow.ts`, TOUTES les
Server Actions de ce module échouaient — y compris celles qui n'utilisaient pas cet import. **Toute
constante/type/valeur partagée entre un fichier `'use server'` et autre chose doit vivre dans son
propre fichier plain (sans `'use server'`)**, jamais être exportée à côté d'un flow.

### Flow existant : `coachChat`
- Input : `{ messages[] (role user/assistant, historique complet dont le nouveau message), coachContext?, training?, planWeek?, recovery? }`
- Output : `string` (texte brut — **seul flow de l'app qui ne répond pas en JSON**, `generateJson` ne
  s'applique pas à une conversation libre ; appelle directement `anthropic.messages.create` avec le
  système/historique en `messages`).
- Usage : `src/components/cycling/stella-chat-tab.tsx` (sous-onglet "Stella" de Coach)
- Persona conversationnelle réutilisant le même `buildCoachContext` + CTL/ATL/TSB + semaine de plan en
  cours que les autres flows coach — pas une mémoire séparée. Volontairement consultative seulement : le
  prompt système interdit à Stella de générer elle-même une séance structurée ou un plan (elle renvoie vers
  les onglets dédiés) pour ne pas dupliquer un chemin de génération avec un format à respecter en dehors du
  flow prévu pour ça.
- Historique stocké intégralement dans `users/{uid}/coachChatMessages` (affichage), mais seule la fenêtre
  glissante des ~20 derniers messages est effectivement envoyée au modèle à chaque tour
  (`trimChatHistoryForPrompt` dans `coach-chat-types.ts`) pour borner le coût/latence.

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

### Server Actions derrière Firebase App Hosting : `allowedOrigins`

`next.config.ts` déclare `experimental.serverActions.allowedOrigins: ['**.hosted.app']`. Sans ça,
**tous** les flows IA (Server Actions) échouent en prod avec une erreur instantanée, systématique,
que l'appareil soit en navigation privée ou non — Firebase App Hosting fronte le backend Cloud Run
avec son propre proxy, donc l'en-tête `Origin` du navigateur (le domaine public `*.hosted.app`) et
le `Host`/`x-forwarded-host` vus par le backend peuvent différer, ce qui déclenche la protection
CSRF intégrée de Next.js pour les Server Actions (`Invalid Server Actions request.`,
`action-handler.js`). L'erreur est levée avant même d'exécuter le code applicatif, donc invisible
aux `console.error` de `generateJson` — diagnostiquée via `/api/debug/anthropic` (route temporaire,
supprimée une fois le diagnostic confirmé), une simple Route Handler non soumise à cette protection
qui a confirmé que la clé API et l'appel Anthropic fonctionnaient très bien en direct, isolant le
problème aux Server Actions elles-mêmes. Si un domaine personnalisé est ajouté un jour, il faudra
l'ajouter à `allowedOrigins` en plus.

## Design System — "Performance Lab"

Identité visuelle propre (plus une copie du langage Apple HIG — voir AUDIT.md, l'audit de design
qui a motivé cette refonte). Décision produit : clair par défaut, fun et orienté découverte des
données plutôt que dashboard SaaS générique. Une palette d'accent lime fraîche + tuiles "à
découvrir" pour donner envie d'explorer ses propres stats.

### Typographie

`Space Grotesk` (titres + corps, via `next/font/google`, variable `--font-display`) + `JetBrains
Mono` (lectures de données chiffrées — stats, prix, dates de table — variable `--font-mono-data`,
classes utilitaires `font-data` / `.lc-data`). Remplace Inter + `-apple-system`.

### Classes CSS Utilitaires (globals.css)

```css
.lc-card           /* Card arrondie avec ombre douce et hover lift (ex .apple-card) */
.glass-header      /* Header sticky avec backdrop-blur */
.text-gradient     /* Dégradé foreground → foreground/50 */
.lc-data           /* Lecture de donnée en monospace, chiffres tabulaires */
```

### Tokens CSS (thème clair par défaut, bascule sombre via `useTheme()`)

Le thème par défaut d'un nouveau visiteur est **clair** — la classe `.dark` n'est ajoutée à
`<html>` que si `localStorage['lifecycle-theme'] === 'dark'` (voir le script anti-FOUC dans
`src/app/layout.tsx` et le hook `src/hooks/use-theme.ts`, basculé depuis `/settings`). Valeurs
stockées en triplet HSL nu (`H S% L%`, sans wrapper `hsl(...)`) — c'est ce qui permet aux
utilitaires d'opacité Tailwind (`bg-primary/10`, `border-border/60`, utilisés partout dans l'app)
de fonctionner : Tailwind les réécrit en `hsl(var(--x) / <alpha>)`, ce qui casserait silencieusement
si la variable elle-même contenait déjà une fonction de couleur complète (`oklch(...)`, etc.).

| Token | Valeur claire | Valeur sombre |
|-------|----------------|----------------|
| `--background` | `60 20% 97%` — blanc cassé chaud | `100 6% 6%` — quasi noir |
| `--primary` / `--accent` | `86 68% 40%` — lime fraîche | `78 90% 66%` — lime claire |
| `--card` | `60 25% 99%` | `100 6% 11%` |
| `--border` | `60 14% 88%` | `100 5% 22%` |
| `--chart-1..5` | lime / corail / violet / bleu ciel / rouge chaud | déclinaisons plus claires |

`--chart-1..5` (mappés sur `chart-1`..`chart-5` dans `tailwind.config.ts`) servent aussi de
palette de tags catégoriels hors graphique (ex. bandeau cross-domaine de `performance-bento.tsx` :
sommeil, HRV, budget — chaque catégorie sa couleur).

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

`PageHeader` (`src/components/ui/page-header.tsx`) : le bloc titre canonique de chaque page —
`category` (eyebrow), `title`, `description?`/`badge?` optionnels, `actions?` pour les boutons/dialogues
à droite. Toutes les pages authentifiées l'utilisent désormais ; ne pas ré-écrire `<header>` à la main.

`EmptyState` (`src/components/ui/empty-state.tsx`) : le bloc "aucune donnée" partagé — `icon?`, `title`,
`description?`, `cta?`, `size: 'default' | 'compact'` (section/onglet entier vide vs. sous-liste vide dans
une page déjà peuplée). Ne s'applique pas aux placeholders de graphique à hauteur fixe (ceux-ci gardent
leur propre bloc centré, la hauteur fixe évite un saut de layout) ni aux hints inline très compacts (<12px).

Charts via Recharts : `BarChart`, `LineChart`, etc. avec wrapper `ChartContainer`.

## Authentification

- Firebase Auth avec email/password et Google OAuth
- Après connexion : redirect vers `/home-management`
- Pages publiques : `/`, `/login`, `/register`
- Pages protégées : toutes les autres, wrappées dans `AuthGuard`
  (`src/components/layout/auth-guard.tsx`) — chaque `src/app/<route>/page.tsx` protégé enveloppe
  son `return` dans `<AuthGuard>...</AuthGuard>` (voir le Patron de Page ci-dessus). Affiche un
  spinner pendant la vérification initiale (`isUserLoading`), puis `router.replace('/login')` si
  personne n'est connecté — avant cet ajout, une page protégée ouverte directement (URL tapée,
  favori) affichait le shell (nav + widgets vides, chaque requête Firestore étant déjà gardée par
  `user ? ... : null`) sans jamais rediriger vers `/login`. Les règles de sécurité Firestore
  bloquaient déjà les lectures/écritures sous-jacentes — ce n'était pas une brèche de données, mais
  ça laissait un visiteur non connecté voir la coquille de l'app plutôt que d'être renvoyé se
  connecter.
- Déconnexion : bouton dans le bloc du bas de la sidebar desktop **et** dans le menu ☰ (Sheet) de
  la nav mobile (`AppNavigation` dans `sidebar.tsx`) — la nav mobile n'exposait auparavant aucun
  moyen de se déconnecter (le menu ne listait que les items de nav, sans Réglages ni Déconnexion).

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
5. **Nouveau module** : page dans `src/app/<route>/page.tsx` (return enveloppé dans `AuthGuard`,
   voir Authentification ci-dessus) + entrée dans `navItems` de sidebar.tsx
6. **Dates** : utiliser `date-fns` avec `import { fr } from 'date-fns/locale'`
7. **Images externes** : `picsum.photos` autorisé dans next.config.ts
