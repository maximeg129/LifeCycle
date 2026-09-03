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
│   ├── cycling/page.tsx          # Page données, pas de PageHeader ni d'onglets : tuiles Vue d'ensemble (CTL/ATL/TSB/FTP/Riegel/sommeil/HRV/readiness) + budget kJ + gouverneur + PMC (courbe 12 semaines, charge hebdo) en scroll continu
│   ├── cycling/metric/[id]/page.tsx  # Page détail d'une tuile Vue d'ensemble : courbe ~180j + explication (metric-info.ts) — une seule route dynamique pour les 8 métriques ; pour `riegel`, affiche `PowerCurveCard` (saisie des records + calculateur TTE) à la place du graphique, qui n'existe pas pour cette métrique
│   ├── cycling/budget/page.tsx   # Page détail du widget "Budget de la semaine" : `KJBudgetWidget` + méthode de calcul (load-types.ts)
│   ├── cycling/governor/page.tsx # Page détail du "Gouverneur de charge interne" : `GovernorWidget` + méthode de calcul des 6 signaux (governor-types.ts/use-governor.ts)
│   ├── coach/page.tsx            # Hub coaching IA — 7 sous-onglets, dont 5 visibles dans la TabsList (Aujourd'hui [défaut, séance du jour], Plan [plan périodisé complet — onglet séparé, pas fusionné avec Aujourd'hui, voir "vue calendrier v2"], Journal, Météo & Tenue, Stella) + 2 démotés dans un menu "Plus" (Mémoire coach, Bibliothèque — voir COACH_UX_AUDIT.md)
│   ├── garage/page.tsx           # Matériel + Chaînes + Garde-robe (Firestore) — sorti de Cyclisme, sa propre destination de nav
│   ├── nutrition/page.tsx        # Plan nutrition + livre de recettes (Firestore)
│   ├── nutrition/fueling/page.tsx # Page détail du widget "Fueling vs Workload" : brûlé/mangé/écart + méthode de calcul (fueling-types.ts)
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

## Internationalisation (i18n) — chantier en cours

Retour utilisateur : "le multilangue de l'app" — un gros chantier, démarré volontairement en deux
temps : ce commit pose **le mécanisme complet de bout en bout** (une preuve, pas une couverture
exhaustive) ; l'extraction page par page des ~30 pages/100+ composants reste à faire, listée dans le
"Reste à faire" ci-dessous. Décisions actées avec l'utilisateur avant de commencer :
- V1 : français (existant) + anglais.
- La langue est une **préférence explicite** choisie dans Réglages — jamais une détection
  automatique du navigateur.
- Le contenu généré par l'IA (Stella, propositions de séance, analyses...) doit aussi changer de
  langue, pas seulement l'UI statique.

**Librairie : `next-intl`**, en mode "pas de préfixe de langue dans l'URL" (pas de
`/en/cycling`/`/fr/cycling`, pas de dossier `src/app/[locale]/...`) — cette app est
personnelle/authentifiée, pas un site public multi-marché ; un préfixe forcerait à restructurer
TOUTES les routes existantes (chaque `page.tsx`, les redirects de `next.config.ts`, chaque `<Link>`)
pour un bénéfice (SEO) qui ne s'applique pas ici.

**Comment la locale est résolue** — `src/i18n/config.ts` (locales supportées, cookie name
`NEXT_LOCALE`, `defaultLocale = 'fr'`) + `src/i18n/request.ts` (lit le cookie côté serveur à chaque
requête, `fr` par défaut si absent/invalide). `next.config.ts` est enveloppé par
`createNextIntlPlugin('./src/i18n/request.ts')`. `src/app/layout.tsx` (redevenu `async`) appelle
`getLocale()`/`getMessages()` et pose `<html lang={locale}>` + `<NextIntlClientProvider>` — jamais
`lang="fr"` en dur comme avant. **Jamais résolu depuis la préférence Firestore directement** : cette
app ne lit Firestore que côté client (voir "Authentification" plus bas — aucun accès Firebase Admin
côté serveur), donc le serveur ne peut connaître la préférence de l'utilisateur qu'via ce cookie.

**`<LocaleSync>`** (`src/i18n/locale-sync.tsx`, monté une fois dans `layout.tsx` à côté de
`FirebaseClientProvider`) tient ce cookie à jour avec `users/{uid}/settings/language` (même patron
"un doc par préoccupation" que `settings/notifications`/`settings/powerCurve`) : sur un nouvel
appareil (pas encore de cookie, ou cookie périmé), il détecte l'écart entre la préférence Firestore
et la locale servie, pose le cookie et déclenche `router.refresh()` — silencieusement, sans jamais
écrire dans Firestore lui-même (ce n'est pas son rôle). **`LanguageCard`**
(`src/components/settings/language-card.tsx`, sur `/settings`, juste après `ProfileCard`) est
l'action consciente inverse : l'utilisateur choisit dans un `Select`, le composant pose le cookie
lui-même (effet immédiat, sans attendre le round-trip du listener Firestore) ET écrit la préférence
dans Firestore (persistance cross-device), puis `router.refresh()`.

**⚠️ Bug attrapé en direct par l'utilisateur ("I can't select anglais")** : le `Select` était
contrôlé directement par `useLocale()` (next-intl), qui ne change qu'après l'aller-retour cookie +
`setDoc` + `router.refresh()` — cliquer sur "Anglais" semblait n'avoir aucun effet le temps de ce
round-trip (voire pour de bon si le refresh échouait silencieusement). Corrigé avec un état local
optimiste (`selected`, mis à jour immédiatement au clic) : le menu reflète la sélection à l'instant,
resynchronisé avec `locale` une fois le refresh réellement arrivé (`useEffect`, sans effet s'ils
convergent déjà) — et remis en arrière en cas d'échec de l'écriture Firestore.

**⚠️ Coût de cette approche, accepté consciemment** : `i18n/request.ts` appelle `cookies()`
(`next/headers`) à chaque rendu, ce qui désactive le rendu statique pour TOUTE page qui passe par le
layout racine — confirmé par `next build` : toutes les routes sont passées de `○ (Static)` à
`ƒ (Dynamic)` après ce changement. Pour une app personnelle authentifiée (chaque page déjà derrière
`AuthGuard`, déjà très majoritairement `"use client"`) ce coût est jugé acceptable face à la
simplicité de ne pas restructurer les routes — mais c'est un vrai changement de comportement
(légèrement plus de latence/charge serveur par requête), à garder en tête si l'app grossit.

**Fichiers de traduction** : `src/messages/fr.json` / `src/messages/en.json`, un namespace par
concept UI (`Nav`, `LanguageCard` existent déjà). Utilisation : `useTranslations('Nom')` dans un
composant client (`const t = useTranslations('Nav'); t('cycling')`) — jamais au scope module (le hook
n'y est pas utilisable, voir le commentaire sur `navItems` dans `sidebar.tsx` pour le contournement
quand une constante module-level a besoin d'un libellé traduit).

**IA multilingue** : `src/ai/language.ts` (fichier *plain*, PAS `'use server'` — même raison que
`structured-workout-syntax.ts`, voir plus bas "Un fichier 'use server' ne peut exporter QUE des
fonctions async") exporte `languageInstruction(language)`, à interpoler dans le system prompt de
chaque flow à la place d'un `"Write your entire response in French."` figé. **Seul `recoveryInsight`
migré pour l'instant** (`language: z.enum(['fr','en']).default('fr')` ajouté à son schéma d'input —
le `.default('fr')` préserve le comportement de tout appelant pas encore mis à jour), consommé par
`recovery-insight-panel.tsx` via `useLocale()` (`next-intl`, `language: locale as 'fr' | 'en'` — le
cast est sûr, `request.ts` ne résout jamais autre chose qu'une locale configurée).

**Reste à faire (chantier ouvert)** :
- **Flows IA** (6 restants, même recette que `recoveryInsight` sur chacun : ajouter `language` au
  schéma Zod d'input avec le même `.default('fr')`, interpoler `languageInstruction(language)` dans
  le system prompt, passer `useLocale()` côté composant appelant) :
  `dailyWorkoutRecommendation`, `trainingPlanGeneration`, `planWeekSessions`, `rideAnalysis`,
  `cyclingOutfitRecommendation`, `coachChat` (celui-ci n'utilise pas `generateJson` — le system prompt
  vit directement dans le flow, même principe d'interpolation).
- **Extraction du texte UI** — la quasi-totalité de l'app reste en français en dur (chaque
  `page.tsx`, `CLAUDE.md` section "Règles de développement" point 1 dit encore "UI en français" sans
  qualifier "aujourd'hui"). Namespace par module logique (`Cycling`, `Nutrition`, `Coach`, `Garage`,
  `HomeManagement`, `Lifestyle`, `Finance`, `Settings`...) plutôt qu'un fichier plat — suivre le
  découpage de `src/app/` donne une correspondance directe fichier↔namespace. Prioriser les pages de
  la nav principale (Cyclisme/Coach/Garage/Nutrition/Maison/Réglages) avant les pages sorties de la
  nav (Vie & Santé, Finances).
- **`date-fns`** : `import { fr } from 'date-fns/locale'` est câblé en dur dans chaque fichier qui
  formate une date — remplacer par une locale résolue depuis `useLocale()` (`date-fns/locale` exporte
  aussi `enUS`).
- **Métadonnées** (`layout.tsx` `export const metadata`) : titre/description de la page restent en
  français statique (les métadonnées `<head>` ne peuvent pas dépendre du provider React) — nécessite
  `generateMetadata()` avec `getTranslations()` côté serveur si on veut les traduire aussi.
- **Tests** : aucun test ne couvre encore `computeBMR`-style la logique i18n elle-même (pas de pure
  logic à tester ici, `languageInstruction()` est trivial) — mais toute future pure logic de
  formatage dépendant de la langue (pluriels, formats de date) devrait suivre le patron
  test-le-fichier-`*-types.ts` habituel de ce projet.

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
sortie et la relation coach : **Aujourd'hui** (onglet par défaut — la séance du jour, voir "Plan
figé par jour" ci-dessous ; Proposition du jour y a fusionné), **Plan** (le plan périodisé complet —
onglet séparé, pas fusionné avec Aujourd'hui malgré un temps où ça a été le cas, voir "Plan
d'entraînement — vue calendrier v2" plus bas pour le pourquoi du retour en arrière), Journal
(ex-"Sorties", le journal d'activités, déplacé depuis Cyclisme > Vue d'ensemble), Météo & Tenue
(l'ex-page `/weather`, qui redirige maintenant ici —
`next.config.ts` — et qui renvoie vers Garage > Garde-robe plutôt que d'embarquer son propre CRUD
vêtements), Stella, Mémoire coach — remplace l'ancien onglet "Coaching" de Cyclisme. Planifier une
sortie avec la bonne intensité et planifier une sortie avec la bonne tenue sont le même geste ; les
séparer en deux destinations de nav n'avait pas de sens. Cyclisme redevient purement la page
données (Vue d'ensemble + PMC, sans onglets — voir plus bas). La séance du jour peut recevoir un
lieu/heure de départ optionnels : le flow `dailyWorkoutRecommendation` récupère alors la météo
réelle (vent inclus) et ajoute un conseil de direction pour l'avoir dans le dos au retour — voir la
section flows IA plus bas.

## Plan d'entraînement — figé par jour, lien réalisé/prévu, page Coach restructurée

Retour utilisateur, en un seul message qui a motivé tout ce chantier (une chaîne de 3 PRs) : "le
plan d'entrainement ne devrais t il pas etre figé avec les seances par jour? on garde l'ajustement
automatique par semaine, comment lier les seances realisees aux seance prevues, lien entre plan et
sorties (d'ailleurs peut etre pas le bon nom), la structure complete de la page coach est peut etre
compliquée." Quatre pièces, dans l'ordre où elles ont été construites (chacune dépend de la
précédente) :

**1. Séances figées par jour** (`training-plan-types.ts`) — avant ce chantier, une semaine type
n'avait que son volume hebdomadaire ; chaque séance type n'obtenait une date qu'au moment de
l'envoi vers Intervals.icu (sélecteur libre, jamais persisté, remis à zéro à chaque ouverture de
l'onglet). `distributeWeekdayOffsets()`/`assignSessionDates()` assignent maintenant une date
(yyyy-MM-dd) à chaque séance dès sa génération (`generateWeekSessions` dans `use-training-plan.ts`)
— étalée aussi régulièrement que possible sur les 7 jours de la semaine, JAMAIS confiée à l'IA (même
raisonnement que `buildPlanWeekSkeleton` pour les dates de semaine : de l'arithmétique de dates
déterministe, pas un jugement à faire). L'athlète peut ensuite déplacer une séance vers un autre
jour (`moveSessionDate`, persisté ; `clampDateToWeek` empêche de la faire glisser dans une autre
semaine du plan). L'ajustement automatique hebdomadaire déjà en place (recalibration —
`weekNeedsRecalibration`/`applyRecalibration`, voir plus haut dans ce fichier) n'a pas changé : le
plan reste "figé par jour" à l'intérieur d'une semaine dont le contenu (phase/focus/volume) peut
toujours être recalibré automatiquement à la fin de chaque semaine.

**2. Lien réalisé/prévu** (`matchSessionCompletion`, `training-plan-types.ts`) — une séance
"cycling" datée est rapprochée d'une vraie activité Intervals.icu du même jour (heuristique par
date : cette app n'a pas accès au "pairing" interne d'Intervals.icu entre événement planifié et
activité réelle, juste ce que l'API renvoie). Une séance "strength" est rapprochée d'un
`strengthSessionLogs` via `planWeekNumber`+`planSessionIndex` (nouveau champ sur
`StrengthSessionLog`, threadé depuis les deux chemins d'écriture existants —
`LiveStrengthSessionView` et `LogStrengthSessionDialog`) — plus fiable qu'une date, qui peut avoir
changé après coup via `moveSessionDate`. Badge Réalisée/Manquée affiché sur chaque séance de
l'onglet Plan (`getSessionCompletion` dans `use-training-plan.ts`, réutilise `planActivities` déjà
fetché pour la recalibration — pas une deuxième lecture).

**3. Journal unifié** (`rides-journal-tab.tsx`, ex-"Sorties") — "Sorties" ne couvrait que les
activités Intervals.icu, donc uniquement le vélo ; retour utilisateur : "lien entre plan et sorties
(d'ailleurs peut etre pas le bon nom)". Fusionné avec les séances muscu loguées
(`strengthSessionLogs`) en un seul flux chronologique (`journalEntries`, trié ensemble — pas deux
listes séparées), chaque entrée muscu affichant directement son lien vers le plan ("Plan S{n}",
depuis `planWeekNumber` déjà porté par le log). Onglet Coach renommé "Sorties" → "Journal" en
conséquence. Le rapprochement réalisé/prévu du vélo (badge Réalisée/Manquée) reste affiché sur
l'onglet Plan uniquement — pas dupliqué ici.

**4. Proposition du jour ajuste le plan au lieu de générer dans le vide** — avant ce chantier, le
flow `dailyWorkoutRecommendation` recevait `planWeek` (phase/focus/volume, un CONTEXTE) mais
composait toujours une séance à partir de rien, même quand le plan avait déjà daté une séance
CONCRÈTE pour aujourd'hui. Nouvel input optionnel `plannedSession` (title/sportType/durationMinutes/
structuredWorkout) — la séance exacte assignée à aujourd'hui (`todaysPlanSession` dans
`use-daily-workout.ts`) — avec une règle impérative dans le prompt : partir de CETTE séance et
l'ajuster (durée, intensité, home trainer si météo dégradée) plutôt que d'en inventer une nouvelle,
et la renvoyer telle quelle si rien ne justifie un changement. Nouveaux champs de sortie
`adjustedFromPlan`/`planAdjustmentNote`, affichés en badge dans `daily-workout-tab.tsx` ("Ajustée
depuis le plan" vs "Générée librement"). Un `planSessionRef` (planId/weekNumber/sessionIndex) est
capturé à la génération et stocké dans `workoutProposals/{date}`, pour que `sendToIntervals`
réutilise le MÊME externalId que la séance du Plan (`planSessionExternalId`) plutôt que
`dailyWorkoutExternalId` — envoyer depuis "Aujourd'hui" et depuis l'onglet Plan mettent désormais à
jour LE MÊME événement calendrier, jamais deux pour la même journée. **Ce flow reste cycling-only** :
quand la séance planifiée du jour est de la musculation, `daily-workout-tab.tsx` court-circuite
entièrement la génération IA (n'a pas de sens pour ce flow) et affiche directement la séance prévue
avec les mêmes actions que l'onglet Plan (suivi en direct `LiveStrengthSessionView` / saisie
rétroactive `LogStrengthSessionDialog`).

**Toggle "Vélo / Salle"** — retour utilisateur : "un petit toggle pour faire la proposition du jour
si l'athlète ne veut pas ou ne peut pas faire de vélo, mais pour aller à la gym". Inverse du
court-circuit ci-dessus : même quand le plan a assigné une séance CYCLING aujourd'hui (ou aucune),
l'athlète peut basculer manuellement sur "Salle" dans `daily-workout-tab.tsx` pour voir/démarrer la
séance de musculation de la semaine en cours plutôt que le vélo — `findWeekStrengthSession()`
(`training-plan-types.ts`, pur/testé) trouve la première séance `sessionKind: "strength"` dans
`planWeek.sampleSessions`, quel que soit le jour où `assignSessionDates` l'avait initialement datée.
Jamais une génération IA ad-hoc (ce flow reste cycling-only) — toujours le contenu déjà produit par
`planWeekSessions`. La faire un jour différent de sa date d'origine reste correctement comptabilisée
sans rien devoir déplacer : `matchSessionCompletion` rapproche déjà une séance strength par
`(weekNumber, sessionIndex)`, jamais par date. Choix d'affichage purement local (pas persisté,
contrairement à `indoorRequested`) — pas un paramètre de génération, juste "qu'est-ce qu'on affiche
aujourd'hui". Sans séance muscu dans la semaine (musculation non activée pour ce plan, ou aucun plan
actif), affiche un état honnête plutôt qu'inventer une séance — renvoie vers l'onglet Plan pour
l'activer.

**Page Coach restructurée : 7 → 6 sous-onglets** — retour utilisateur : "la structure complete de la
page coach est peut etre compliquée." Une fois la Proposition du jour devenue l'ajustement
au-jour-le-jour du plan (point 4 ci-dessus), garder "Proposition du jour" et "Plan" comme deux
onglets séparés pour la même notion de "mon plan" n'avait plus de sens. Fusionnés dans
`coach/page.tsx` : l'onglet "Plan" (devenu l'onglet par défaut) affiche `DailyWorkoutTab`
("Aujourd'hui") au-dessus de `TrainingPlanTab` (le plan périodisé complet), plutôt que deux
`TabsContent` distincts. Vérification hors ligne de ce chantier (pas de ANTHROPIC_API_KEY dans ce
sandbox, voir plus bas la technique de vérification via fixtures) :
`daily-workout-recommendation-output.test.ts` (même patron `satisfies`-le-vrai-schéma que
`plan-week-sessions-output.test.ts`). ⚠️ Défusionnés par la suite, une fois `TrainingPlanTab` devenu
un vrai écran de gestion — voir "Aujourd'hui et Plan redéfusionnés" plus bas, après la section
"vue calendrier v2".

**Audit UX Coach vs concurrents (Join/Frive/TrainerRoad) → bandeau "à traiter" + démotion 6→4
onglets** — retour utilisateur : "je suis toujours pas convaincue de la présentation et de
l'organisation du coach... nous devrions peut-être effectuer un audit ainsi qu'une review des best
practices ainsi que des applications compétitrices (genre Join ou Frive)." Diagnostic complet dans
`COACH_UX_AUDIT.md` (racine du repo, distinct de `AUDIT.md`/`PLAN.md` qui datent d'une phase
antérieure du projet) — recherche web sur Join/Frive/TrainerRoad (accès direct aux sites bloqué par
le proxy réseau du sandbox, comme pour `intervals.icu` ; basé sur des extraits indexés). Constat
principal : les 3 concurrents traitent readiness + séance du jour comme un seul écran d'accueil,
LifeCycle les sépare entre Cyclisme et Coach — tension identifiée mais volontairement PAS tranchée
dans ce chantier (défait plusieurs décisions déjà prises et documentées dans ce fichier). Deux
recommandations retenues et construites immédiatement (les deux autres — fusion "Aujourd'hui" et
vue prévu/réalisé compacte — restent en attente d'arbitrage) :
- **Bandeau "à traiter"** (`pending-feedback-banner.tsx`, inspiré de la "Pending Feedback card" de
  Join) — sorties Intervals.icu des 7 derniers jours sans RPE (ni sur Intervals.icu lui-même via
  `bestRpe()`, ni en local via `sessionFeedback`), affichées en haut de l'onglet Plan avec action
  inline (réutilise `QuickFeedbackButton` tel quel). Scope volontairement limité au vélo — une
  séance muscu capture déjà son RPE au moment de la logger (voir `sessionRpe`,
  `strength-log-types.ts`), il n'existe pas de geste rétroactif côté muscu aujourd'hui pour la
  corriger après coup, donc l'inclure ici pointerait vers une action qui n'existe pas.
- **Démotion Mémoire coach/Bibliothèque** — aucun des 3 concurrents examinés ne place un écran de
  configuration (mémoire/bibliothèque de sources) au même niveau de nav qu'un écran d'usage
  quotidien. `TabsList` passe de 6 à 4 déclencheurs visibles (Plan/Journal/Météo & Tenue/Stella) ;
  Mémoire coach et Bibliothèque restent de VRAIS onglets (même valeur, même `TabsContent`, deep-link
  `?tab=memory`/`?tab=library` inchangé) mais leur déclencheur passe dans un menu "Plus"
  (`DropdownMenu`) plutôt que la `TabsList`. `Tabs` devient contrôlé (`value`/`onValueChange`,
  jusqu'ici `defaultValue` non contrôlé) pour que ce menu puisse changer l'onglet actif sans être
  lui-même un `TabsTrigger` Radix ; le bouton "Plus" reprend le style `data-[state=active]` quand
  Mémoire coach ou Bibliothèque est ouvert, pour ne pas perdre le repère "où suis-je".

Un complément UI/visuel (pas seulement structurel) est aussi documenté dans `COACH_UX_AUDIT.md`
§5 : `daily-workout-tab.tsx`/`training-plan-tab.tsx` n'utilisent quasiment jamais `.lc-card` (la
carte canonique du design system), au profit de combinaisons ad hoc (`bg-card/60 border-primary/20
border-2` répété sur 3+ cartes différentes) qui font perdre toute hiérarchie visuelle entre "voici
la chose à faire maintenant" et "voici un résumé pour information" — même symptôme que celui déjà
documenté dans `AUDIT.md` pour d'autres modules, non corrigé dans ce chantier (recommandation
seulement, migration non construite).

**Chaque tuile de Vue d'ensemble renvoie vers `/cycling/metric/<id>`** (`cycling/metric/[id]/page.tsx`)
— une page détail avec la courbe des ~180 derniers jours et une explication du principe de
l'indicateur (`metric-info.ts`, contenu statique par métrique). CTL/ATL/TSB viennent de
`useFitnessChart` et Sommeil/HRV/Readiness de `useLifestyleData(180)` (le paramètre `days`,
optionnel, garde tous les appels existants à 7 jours par défaut inchangés) — `WELLNESS_WINDOW_DAYS`/
`FITNESS_WINDOW_DAYS` dans `use-intervals.tsx` sont passés de 90 à 180 jours pour donner de la marge.
FTP et l'indice Riegel n'ont pas d'historique suivi jour par jour aujourd'hui (FTP vient d'un test
ponctuel Intervals.icu, Riegel est recalculé à la volée depuis la courbe de puissance actuelle) —
la page FTP affiche honnêtement "pas encore d'historique suivi" plutôt que d'inventer une tendance ;
la page Riegel affiche à la place `PowerCurveCard` (saisie des 3 records de puissance + calculateur
de TTE), déplacé ici depuis la page Cyclisme principale (section PMC) — retour utilisateur, capture
d'écran cerclant en rouge ce module sur la page principale : "Enlève les éléments cerclés de rouge...
[le module] n'avait pas sa place noyé dans PMC". Même retour utilisateur pour deux autres éléments
cerclés de rouge, tous deux supprimés sans remplacement : le `PageHeader` "Performance / LifeCycle
Vault" de la page Cyclisme (faisait doublon avec le header mobile fixe + la sidebar desktop, qui
disent déjà "LifeCycle" et surlignent "Cyclisme" comme page active — la page utilise maintenant
`pt-20` au lieu du `PageHeader` pour la clearance mobile) et le lien "Objectifs, analyse IA &
historique complet" vers `/lifestyle` dans le panneau "Aujourd'hui" (`performance-bento.tsx`).

**Boutons de plage sur le graphe de tendance** (`cycling/metric/[id]/page.tsx`) — retour
utilisateur, capture d'écran de la page HRV à l'appui : "pouvons nous rajouter des petits boutons
qui viendraient réduire/ajuster la vue a 1 semaine, 1 mois, 6 mois, all ?". Filtre purement
client-side sur la série déjà chargée (`RANGE_OPTIONS`, état local `range`) — la fenêtre de fetch
elle-même reste `TREND_DAYS` (180j) inchangée, donc "6 mois" et "Tout" affichent la même chose
aujourd'hui, mais "Tout" reste un bucket sans borne de date plutôt qu'un alias codé en dur sur
180, pour rester correct si la fenêtre de fetch s'élargit un jour. `TrendPoint` porte désormais un
`rawDate` (yyyy-MM-dd, jamais affiché) à côté du `date` déjà formaté pour l'affichage, pour que le
filtre compare sur la vraie date plutôt que de compter des éléments (fragile si la série a des
trous — cas réel pour HRV/sommeil quand une journée n'a pas de donnée). `tsbYDomain` (bornes Y des
5 zones de fraîcheur) suit désormais la série filtrée plutôt que la série complète, pour que le
zoom recadre aussi l'échelle verticale. Boutons en pill switcher (même langage que le sélecteur
Connexion/Inscription des pages d'auth) dans l'en-tête de la carte, masqués tant qu'il n'y a pas au
moins 2 points à afficher (rien à filtrer sinon) ; absent sur Riegel (pas de courbe d'historique,
voir plus haut).

**`KJBudgetWidget` et `GovernorWidget` renvoient chacun vers leur propre page détail** (`/cycling/budget`,
`/cycling/governor`) — même capture d'écran, cerclant ces deux widgets en vert cette fois avec la
demande "crées de sous page qui donne du détails, méthode de calcul, compréhension, composition".
Composites calculés en direct (pas des métriques suivies jour par jour) — routes dédiées plutôt que
`/cycling/metric/[id]`. Chaque widget est enveloppé dans un `<Link>` (même convention "carte entière
cliquable" que `MetricTile`/`RingItem`, chevron inclus), et chaque page détail réaffiche le widget
live suivi d'une explication du calcul fidèle au code réel (`load-types.ts` pour le budget kJ ;
`governor-types.ts`/`use-governor.ts` pour les 6 signaux du gouverneur).

**Vue d'ensemble ouvre sur 3 anneaux Forme/Récupération/Sommeil, façon Whoop** (`ring-gauge.tsx`/
`ring-metrics.ts`, `src/components/cycling/`) — retour utilisateur, capture d'écran des anneaux
Whoop à l'appui : "forme tsb - readiness - sommeil (heure et qualité), peux ton avoir... représenté
de cette façon ?". `RingGauge` (`ring-gauge.tsx`) est un simple cercle SVG (technique
`stroke-dasharray`/`strokeDashoffset`, pas de librairie de graphes) prenant un `percent` 0-100 et une
vraie couleur CSS ; `ring-metrics.ts` (pur, testé) calcule ce pourcentage et cette couleur par métrique
— TSB n'étant pas nativement sur une échelle 0-100, `tsbRingPercent` le ramène dans une fenêtre
pratique [-30, 20] (le plancher de la zone Optimal au plafond de la zone Frais, voir `tsb-zones.ts`),
`tsbRingColor` réutilise `tsbZone(tsb).fillColor` (même classification que la tuile détail, pas une
deuxième) ; le sommeil affiche les heures au centre mais son remplissage suit la qualité (0-100) quand
connue, sinon une estimation heures/9h, et sa couleur suit `sleepQualityBand()` (Great/Good/Average/Poor
— voir bug ci-dessous, Great+Good regroupés en vert) ; la récupération utilise directement le score
Readiness existant. Les 3 anneaux et les stats HRV/FC repos vivent dans un seul panneau
« Aujourd'hui » teinté citron vert (`bg-primary/5 border-primary/20`, même traitement que la tuile
Riegel) plutôt qu'un bloc noir (`bg-foreground`) — retour utilisateur après relecture d'un brouillon
de canevas de design proposant 3 pistes : "Le a avec le bloc mais pas en noir mais plus comme les
couleurs de l'indice riegel". La grille « Entraînement » juste en dessous ne garde que Riegel/CTL/
ATL/FTP. `RingItem`/`StatChip` (`performance-bento.tsx`) posent les anneaux/stats directement sur le
panneau (pas de carte individuelle par anneau), séparés par un simple `divide-x`. Reprend le piège déjà
documenté pour `tsb-zones.ts` : un cercle SVG se peint via l'attribut `stroke`, pas la propriété CSS
`background-color` qu'une classe Tailwind `bg-*` pose, donc `ring-metrics.ts` expose des couleurs CSS
réelles (hex ou `hsl(var(--destructive))`), jamais des classes Tailwind, pour l'anneau lui-même — la
piste (fond clair) sert aussi de couleur de repli pour l'arc quand une donnée manque, plutôt que le
blanc translucide de l'ancien traitement sombre.
La tuile détail TSB (`cycling/metric/[id]/page.tsx`) garde son propre traitement — bandes de fond +
légende des 5 zones sur le graphe historique — documenté juste au-dessus.

**⚠️ `wellness.sleepQuality` (Intervals.icu) n'est PAS un pourcentage** — bug attrapé en direct par
l'utilisateur, capture d'écran de sa propre page Intervals.icu à l'appui (score "82" et "Q2" affichés
côte à côte pour la même nuit) : ce champ brut de l'API est en réalité la bande dérivée 1-4
d'Intervals.icu (1=Great 90-100, 2=Good 80-89, 3=Average 60-79, 4=Poor <60, confirmé contre leur doc
publique "Wellness Fields"), pas un score 0-100. Le champ `sleepQuality` de CETTE app veut dire "0-100"
partout ailleurs (UI, prompts IA, calcul de readiness, saisie manuelle) — `mergeDailyWellness()`
(`lifestyle-types.ts`) préférait ce champ brut à `sleepScore` (le vrai 0-100), donc une nuit "Good" (2)
s'affichait "Qualité 2%". Corrigé : `sleepScore` est prioritaire, `sleepQualityBandToScore()` ne sert
que de repli (peu probable per la doc Intervals.icu — la bande est dérivée du score, jamais l'inverse)
si jamais seule la bande 1-4 est présente. `sleepQualityBand()` (exportée) reclassifie un score 0-100
dans ces mêmes bornes 90/80/60 — c'est elle qui pilote la couleur de l'anneau Sommeil (`ring-metrics.ts`)
plutôt que de relire la bande brute d'Intervals.icu.

**FC repos (Resting HR) + LEDs de tendance jour/veille sur les tuiles Vue d'ensemble** — retour
utilisateur : "tu n'a pas remonté le resting HR... si on peut y inclure pour les tiles où c'est utile
[un] petit indicateur... une petite led rouge/vert/jaune l'évolution vis a vis de la veille". Le champ
brut `restingHR` existait déjà sur `IntervalsWellness` (`intervals-api.ts`) mais n'était lu nulle part
— maintenant threadé de bout en bout comme `hrv` : `HealthMetric`/`HealthMetricLike`/`WellnessLike`
(`lifestyle-types.ts`), `mergeDailyWellness()`, saisie manuelle dans `LogMetricDialog`, tuile "FC repos"
dans `performance-bento.tsx` (`/cycling/metric/restingHr`, nouvel id dans `metric-info.ts`). La LED de
tendance (`vitalTrend()`, `lifestyle-types.ts` — pur, testé) compare la valeur du jour à celle de la
veille via `previousValue()` (marche en arrière dans `dailySeries` en sautant les jours sans donnée pour
ce champ, même principe que `pickLatestWithData`) : vert = amélioration, rouge = dégradation, jaune =
égalité stricte — `direction` dit quel sens est une amélioration (`'lower-better'` pour FC repos,
`'higher-better'` pour HRV). Affichée sur les tuiles FC repos et HRV pour l'instant (`MetricTile`
accepte un prop `trend?`), pas sur Riegel/FTP/CTL/ATL qui n'ont pas de sens "mieux/moins bien" jour à
jour aussi direct.

**Icônes rouges sur les stats HRV/FC repos du panneau "Aujourd'hui"** (`StatChip` dans
`performance-bento.tsx`) — retour utilisateur, capture d'écran du mockup `public/screenshots/cycling.png`
(voir section Landing page) à l'appui : "j'aime beaucoup [ce format]... surtout les éléments pointés en
rouge". `StatChip` n'affichait auparavant aucune icône (juste un libellé au-dessus, une valeur en dessous)
— redessiné en layout icône + valeur inline centré, mirroring le mockup : `HeartPulse` pour HRV, `Activity`
pour FC repos, toutes deux `text-destructive` (le seul token rouge de l'app, pas une couleur rose
arbitraire) — une couleur "signe vital" fixe, indépendante de la tendance jour/veille (`TrendDot`, qui reste
inchangée juste à côté). Libellé de FC repos raccourci à "repos" pour ce contexte (suffixe "48 bpm repos"
comme le mockup) plutôt que "FC repos" en entier, l'icône cœur/pulsation portant déjà le sens "cardiaque".

**Pas de décimales sur les tuiles** — même retour utilisateur. Les heures de sommeil ("7.5h", lu comme
un possible "75h" au premier coup d'œil) sont formatées `formatSleepDuration()` (`lifestyle-types.ts`) en
"XhYY" façon durée (ex. "7h30") plutôt qu'un nombre décimal brut — même convention que
`formatDuration()` dans `rides-journal-tab.tsx`. HRV et FC repos sont arrondis à l'affichage (`Math.round`)
— la donnée brute Intervals.icu peut porter une décimale que l'app n'affichait pas encore. Riegel (indice
0-1, `.toFixed(2)`) et le ratio W/kg de la FTP gardent volontairement leurs décimales : les arrondir à
l'entier les rendrait inexploitables (l'indice Riegel est toujours entre 0,85 et 0,95).

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

## Export d'une séance muscu vers Intervals.icu (Strava en attente)

Retour utilisateur : "seras t il possible d'exporter la séance de muscu vers Strava et/ou dans
intervals". Les deux services demandaient une décision : Intervals.icu réutilise l'authentification
déjà en place dans l'app (clé API, `settings/intervals`) — construit tout de suite. Strava
demanderait une intégration OAuth complète depuis zéro (aucune app Strava enregistrée, aucun jeton
nulle part dans cette app aujourd'hui — le seul "Strava" existant est un badge d'affichage en
lecture seule sur les activités déjà synchronisées *via* Intervals.icu, voir `rides-journal-tab.tsx`)
— différé, l'athlète doit d'abord créer une application API sur son propre compte Strava (developers
.strava.com → "My API Application" — nom, catégorie, "Authorization Callback Domain" pointant vers le
domaine de l'app) avant qu'une intégration OAuth ait un `client_id`/`client_secret` à utiliser.

**`IntervalsService.createManualActivity()`** (`intervals-api.ts`) — crée une activité RÉALISÉE (pas
planifiée, voir `createPlannedWorkout` plus bas) via `POST /activities/manual`, sans upload de
fichier FIT/GPX. **Endpoint corroboré via la documentation communautaire (forum Intervals.icu + une
spec OpenAPI tierce) — confirmé fonctionnel en prod** (badge "~ Manual Entry" visible côté athlète
au premier envoi réel) ; l'erreur de l'API remonte telle quelle côté athlète (même chemin
`postIntervals`/toast que le reste de l'intégration Intervals.icu) si jamais un champ s'avérait
incorrect — pas un échec silencieux. **Intervals.icu n'a pas de modèle structuré séries/répétitions
pour une activité créée via l'API** (confirmé par les retours de la communauté) —
`formatStrengthLogDescription()` (`strength-log-types.ts`, pur/testé) met donc le détail série par
série en texte libre dans `description`, une ligne par exercice. **Pas d'upsert par id externe**
(contrairement à `/events`) : renvoyer la même séance créerait un doublon plutôt qu'une mise à jour
— `intervalsActivityId` (nouveau champ sur `StrengthSessionLog`, posé au premier envoi réussi) sert
de garde côté UI (`use-strength-log-export.ts` désactive le bouton une fois présent).

**`durationSeconds`** (nouveau champ sur `StrengthSessionLog`) — le chrono de
`LiveStrengthSessionView` existait déjà mais n'était jusqu'ici jamais persisté ; nécessaire pour
renseigner `moving_time` à l'export. Absent pour une séance loguée via le formulaire rétroactif
(`log-strength-session-dialog.tsx`, qui ne suit pas le temps).

**Bouton d'export** sur chaque entrée muscu du Journal (`rides-journal-tab.tsx`) — pas sur les
sorties vélo juste à côté, qui viennent déjà d'Intervals.icu (sync entrant) : une séance muscu n'a
aucun capteur/montre qui la synchronise automatiquement, d'où ce geste manuel. Remplacé par une coche
une fois exportée.

**"Weight Lifted" (kg_lifted) + Load (session_rpe)** — retour utilisateur après un premier envoi
réel, capture d'écran de l'activité créée sur Intervals.icu à l'appui : "ça ne revoit pas beaucoup
d'informations... alors qu'on a la charge, le temps... Je ne sais pas si c'est possible le load."
Le premier export ne remplissait que `name`/`description`/`moving_time` — deux champs réels
d'Intervals.icu restaient donc à "?" sur l'activité (Weight Lifted, Load) alors que l'app a déjà (ou
pourrait avoir) de quoi les renseigner honnêtement. Les deux noms de champ exacts ont été confirmés
via le schéma OpenAPI public d'Intervals.icu (`kg_lifted`, `session_rpe` sur `Activity`) plutôt que
devinés — même sandbox network-blocked que documenté plus haut, contourné cette fois en téléchargeant
le spec JSON tiers directement (`raw.githubusercontent.com`, non bloqué) et en l'inspectant en local
plutôt qu'en résumé tronqué.
- **`totalWeightLiftedKg()`** (`strength-log-types.ts`, pur/testé) — somme reps × charge sur chaque
  série qui porte une charge, exact via `setsDetail` (suivi en direct) ou dégradé sur
  `sets × loadKg × répétitions moyennes de la chaîne "reps"` sinon (saisie rétroactive, voir
  `averageRepsCount`). Une série au poids du corps (sans charge) est ignorée plutôt que de lui
  attribuer un poids corporel estimé. Calculable à 100% depuis les données déjà loguées — aucune
  nouvelle saisie demandée à l'athlète, envoyé systématiquement (sauf séance purement poids du corps,
  où `weightLiftedKg` reste 0 et n'est alors pas envoyé — "?" reste honnête plutôt qu'un zéro trompeur).
- **Load — décision consciente de ne PAS l'inventer.** Le Load d'Intervals.icu dépend normalement de
  la FC pendant l'effort (absente : aucune séance muscu de cette app ne capte de FC) ; à défaut, le
  seul signal qu'Intervals.icu peut exploiter pour une activité manuelle est `session_rpe` (1-10) —
  jamais calculé côté app (pas de formule sRPE maison, cohérent avec la discipline "jamais un chiffre
  inventé" documentée partout ailleurs dans ce fichier). `StrengthSessionLog.sessionRpe` est donc une
  nouvelle saisie OPTIONNELLE et réelle de l'athlète : un petit sélecteur 1-10 en bas de
  `LiveStrengthSessionView` (juste avant "Terminer la séance", RPE non renseigné = séance quand même
  loguable) et un champ numérique optionnel dans `LogStrengthSessionDialog` (saisie rétroactive). Si
  absent, `session_rpe` n'est simplement pas envoyé — Load reste "?" côté Intervals.icu plutôt qu'un
  nombre halluciné.

## Suivi en direct — pause/reprise, recommencer, modifier une série validée

Retour utilisateur : "revoir le fonctionnement du chronomètre... qu'on puisse mettre pause et/ou
recommencer le training, il faudrait aussi pouvoir modifier lorsqu'un exercice a été validé" —
inspiré d'un tour d'horizon de Hevy (référence du marché pour le suivi de musculation en direct).

**Pause/reprise** (`LiveStrengthSessionView`) — le chrono de séance était jusqu'ici un simple
horodatage de départ sans façon de le suspendre. `isPaused`/`pausedAtRef`/`totalPausedMsRef` :
`elapsedSeconds` se fige à l'instant de la mise en pause plutôt que de continuer à avancer, et
soustrait le temps cumulé passé en pause une fois repris — jamais remis à zéro par une pause, juste
suspendu. Conséquence directe et voulue : le `durationSeconds` envoyé à l'export Intervals.icu (voir
section ci-dessus) exclut déjà le temps de pause, sans changement côté export. État persisté dans le
brouillon localStorage (`StrengthSessionDraft.isPaused`/`pausedAt`/`totalPausedMs`) au même titre que
la progression, pour qu'une pause en cours au moment d'une fermeture accidentelle de l'onglet reste
exacte à la réouverture.

**Recommencer** (`handleRestart`) — remet TOUT à zéro (progression, chrono, pause, repos, RPE) comme
une nouvelle ouverture de la même séance ; `buildFreshProgress()` (le même calcul de préremplissage
que l'ouverture initiale, extrait en fonction réutilisable plutôt que dupliqué) reconstruit la
progression vierge. Confirmé via `AlertDialog` (même patron que la suppression de compte dans
`danger-zone-card.tsx`) car destructif — contrairement à dé-valider une seule série (voir ci-dessous),
il n'y a pas de retour en arrière possible une fois confirmé.

**Modifier une série déjà validée** — les champs reps/temps tenu/charge d'une série restent
désormais éditables même une fois "faite" (plus de `disabled={set.done}`, Hevy laisse pareillement
les champs toujours éditables) ; le bouton "Fait" devient un bouton d'annulation (icône `Undo2`) qui
redé-valide la série plutôt que de rester inerte une fois cochée. `restKeyRef` retient quelle série
précise (`exIndex-setIndex`) a déclenché le décompte de repos en cours : dé-valider CETTE série
l'annule, dé-valider une AUTRE série (plus ancienne, pendant qu'un repos plus récent tourne) laisse
le décompte en cours tranquille — évite qu'une simple correction de charge sur une vieille série ne
coupe le repos en cours d'un athlète qui vient d'enchaîner une série plus tard dans la séance.

## Suivi en direct v2 — record personnel, contexte, repos ajustable, écran allumé, technique

Retour utilisateur, en réponse à une liste de propositions inspirées d'un tour d'horizon de Hevy :
badge record personnel (oui, avec un vrai soin UX/UI), contexte "dernière fois" visible en direct
(oui), note par exercice pendant la séance (non — préféré : une note de séance globale AVANT
l'envoi Intervals.icu), série improvisée/exercice libre ajouté en direct (non aux deux), sauter un
exercice explicitement (oui), ajuster le repos en direct (oui), calculateur de plaques (non) — plus
deux demandes indépendantes : écran toujours allumé pendant le suivi, et un accordéon de bonne
technique par exercice.

**Badge record personnel** (`isNewPersonalRecord`, `LiveStrengthSessionView`) — `exercisePRMap`
(calculé une fois à l'ouverture, `useMemo`) retient la charge max déjà loguée par exercice
(`exerciseHistory`, jamais la séance en cours). Valider une série dont la charge dépasse ce max ET
toute série déjà faite plus tôt dans CETTE séance déclenche un toast "🏆 Nouveau record personnel !"
et marque la série (`prSetKeys`, clé `exIndex-setIndex`) — un `Trophy` ambre reste affiché sur la
ligne, fond ambre plutôt que le fond lime habituel d'une série "faite", pour rester visible après le
toast. Dé-valider la série retire le badge (même logique que `restKeyRef` pour le repos). Jamais un
score inventé (pas de 1RM estimé) — juste "cette charge bat-elle la meilleure connue ?".

**Contexte "dernière fois"** — la donnée servait déjà à préremplir les champs
(`buildFreshProgress`) mais n'était jusqu'ici jamais réaffichée en clair pendant la séance,
contrairement à `LogStrengthSessionDialog` (saisie rétroactive). Une ligne `Dernière fois (date) :
Nx... @ Ykg` sous le nom de l'exercice, dès qu'un historique existe.

**Note de séance avant export** (`StrengthLogExportButton`, nouveau composant) — retour
utilisateur : "pas nécessaire [par exercice], nous pouvons faire une note après la séance avant
d'envoyer sur intervalles". Le bouton d'export du Journal (`rides-journal-tab.tsx`) devient une
`Popover` avec un `Textarea` optionnel plutôt qu'un envoi immédiat au clic — "Envoyer sans note"
reste un simple clic, la Popover n'ajoute une étape que si l'athlète a effectivement quelque chose à
dire. `exportLog(log, note?)` (`use-strength-log-export.ts`) ajoute la note à la `description`
envoyée à Intervals.icu (`"\n\nNotes : ..."`, Intervals.icu n'a pas de champ notes dédié sur une
activité manuelle) ET la persiste (`StrengthSessionLog.sessionNotes`) pour rester visible même sans
export.

**Sauter un exercice explicitement** (`skippedExercises`, `toggleSkipExercise`) — ne rien valider
suffisait déjà techniquement (`handleFinish` filtre les exercices à 0 série faite), mais restait
ambigu visuellement ("pas encore fait" vs "volontairement sauté"). Un bouton "Passer" par exercice,
disponible uniquement tant qu'aucune série n'est validée (sauter un exercice déjà entamé n'a pas de
sens — "Recommencer" est le geste pour repartir de zéro sur un exercice mal engagé) ; l'exercice
sauté s'affiche grisé, ses champs masqués.

**Repos ajustable en direct** (`adjustRest`) — boutons `-15s`/`+15s` dans le bandeau de repos, à
côté de "Passer". Ajuste uniquement le décompte EN COURS (`restEndAt`), clampé à 0 — la durée par
défaut des prochaines séries reste celle décidée par l'IA (`restSeconds`), pas modifiée en cascade.

**Écran toujours allumé** (Screen Wake Lock API) — retour utilisateur : "l'écran de l'iPhone ne
s'éteint pas parce que c'est vraiment pénible de faire le suivi". Contrairement au Bluetooth (voir
la discussion capteur HR — Web Bluetooth n'est PAS supporté sur iOS, position de principe
WebKit/Apple, y compris sous Chrome sur iPhone qui tourne sur le même moteur WebKit imposé par
Apple), Wake Lock EST supporté par Safari iOS depuis la version 16.4 — vérifié à jour, pas juste la
mémoire d'entraînement du modèle. `navigator.wakeLock.request('screen')` à l'ouverture, redemandé à
chaque retour de visibilité (l'OS relâche automatiquement le verrou quand l'onglet passe en
arrière-plan) — feature-detect + échec avalé silencieusement (permission refusée, navigateur
ancien), jamais bloquant pour la séance elle-même.

**Accordéon "bonne technique"** (`exercise-technique.ts`, contenu statique, testé) — retour
utilisateur : "un lien aussi descriptif, condensé en accordéon... la bonne technique à avoir". Keyé
par `pattern` (le mouvement — bilatéral lourd, charnière de hanche, unilatéral, anti-extension,
anti-rotation/latéral, cheville/mollet — champ déjà présent sur chaque `StrengthExercise` du schéma
S05) plutôt que par nom d'exercice exact : le nom est du texte libre généré par l'IA ("Squat",
"Presse à cuisses"...), donc non énumérable, alors que les 6 patterns du référentiel couvrent déjà
tout exercice muscu que cette app génère. Contenu rédigé une fois et relu — pas soumis à la
discipline "jamais un chiffre inventé" (ce sont des repères techniques génériques établis, pas une
donnée personnelle de l'athlète), mais jamais généré à la volée par le modèle non plus. Un
`Accordion` collapsible en bas de chaque carte d'exercice (masqué si l'exercice est sauté).

**Vérification pause/reprise/recommencer/terminer** — relu à la demande de l'utilisateur : les
quatre s'enchaînent correctement (`elapsedSeconds` reste cohérent à travers pause→reprise→
terminer, `handleRestart` remet bien tout l'état à zéro y compris pause/repos/RPE/badges PR/
exercices sautés). Aucun bug trouvé — confirmé sans changement de code.

**⚠️ Vérification visuelle non faite dans ce sandbox** — la page jetable habituelle
(`preview-strength-session`, même patron que `preview-recipe` pour la landing page) a été créée puis
supprimée sans capture Playwright exploitable : le serveur de dev de ce sandbox échoue sur TOUTE
page (pas seulement celle-ci) avec une erreur de décodage de `favicon.ico` ("The PNG is not in RGBA
format"), un problème d'environnement préexistant sans rapport avec ce changement. Les classes
Tailwind ajoutées (ring de focus, badge ambre PR, opacité de l'exercice sauté...) suivent les
conventions déjà en place ailleurs dans l'app (voir Design System plus haut) mais n'ont pas été
vérifiées à l'écran — à confirmer par l'utilisateur au premier usage réel.

## Suivi en direct v3 — corrections après premier vrai usage (captures d'écran)

Retour utilisateur, deux captures d'écran d'un vrai téléphone à l'appui (la vérification visuelle
manquante ci-dessus, faite cette fois par l'utilisateur plutôt que par Playwright) : "ça me plaît,
il faut juste fixer les boutons Fait et Valider... la planche latérale affiche 25 reps au lieu de 25
secondes... je ne sais pas pourquoi tu rajoutes le poids pour ce type d'exercice... un timer plus
grand écran pour les exercices tenus."

**Débordement des boutons "Fait"/"Valider" hors du cadre de la carte** — chaque ligne de série
(numéro + input reps/temps + libellé unité + input charge + bouton) dépassait la largeur utile d'un
écran de téléphone (~340px), le bouton étant poussé hors du cadre visible plutôt que de passer à la
ligne. Corrigé par plusieurs réductions cumulées plutôt qu'un seul gros changement : bouton
Valider/Fait devenu icône seule (`size="icon"`, `Check`/`Undo2`, texte "Valider"/"Fait" retiré —
retour utilisateur : "peut-être juste le logo" — le libellé survit en `aria-label`/`title` pour
l'accessibilité) ; numéro de série réduit à un simple chiffre (`#`, largeur `w-5`) plutôt que "Série
N" répété sur chaque ligne ; le libellé d'unité "reps ×"/"tenu ×" répété par ligne est retiré au
profit d'une seule ligne d'en-tête de colonnes au-dessus de la liste (`#` / `Reps` ou `Temps` /
`Charge`), alignée sur les mêmes largeurs `w-5`/`w-16`/`w-9` que les lignes — plus proche du tableau
compact de Hevy que d'un libellé répété. Marge confortable désormais même sur un iPhone SE.

**⚠️ `isHoldReps()` seule ne suffisait pas** — capture d'écran à l'appui : "Planche latérale"
affichée en reps (25) plutôt qu'en temps tenu, alors que "Planche" juste au-dessus s'affichait
correctement. Cause : `isHoldReps()` ne lit QUE la chaîne `reps` texte-libre générée par l'IA (le
suffixe "s" de "30-45s") — un signal fragile qui peut manquer selon la génération, comme ici. Corrigé
en ajoutant un second signal, structuré et fiable celui-là : les patterns `anti-extension`/
`anti-rotation-lateral` (gainage) sont TOUJOURS tenus dans cette app par construction (voir S05/
`CORE_PATTERNS`, `strengthSessionValidator.ts` — jamais comptés en répétitions). `isHold` devient
`isHoldReps(reps) || pattern === 'anti-extension' || pattern === 'anti-rotation-lateral'` — le
pattern sert de garde-fou structuré même quand le texte libre de l'IA omet la convention "s".

**Charge (kg) masquée pour le gainage** — retour utilisateur : "je ne sais pas pourquoi tu rajoutes
le poids... je ne sais pas si c'est nécessaire pour ce type d'exercice". Le champ Charge n'a
jamais de sens réel pour `anti-extension`/`anti-rotation-lateral` dans cette app : la génération IA
documente déjà ces patterns comme `loadGuidance: "Poids du corps"` (voir S05,
`plan-week-sessions-output.test.ts`) — masquer le champ plutôt que de le laisser vide-mais-visible
aligne l'UI sur ce que l'IA produit déjà réellement, sans qu'il s'agisse d'une règle inventée pour
l'occasion. `isCorePattern` (même détection que `isHold` ci-dessus, sans le repli textuel) gate le
rendu de l'input.

**Chrono grand écran pour un exercice tenu** (`holdTimer`, overlay `fixed inset-0 z-[60]`) — retour
utilisateur : "quand on est en position planche, ce qu'on veut c'est pouvoir regarder le temps
facilement... dès qu'on a fini on appuie sur le chronomètre, ça arrête le temps de l'exercice, ça le
met dans l'application et ça lance le temps de pause". Un bouton ▶ à côté du champ temps (visible
tant que la série n'est pas faite) ouvre un plein écran — nom de l'exercice + chrono géant (`text-8xl`)
qui compte depuis l'instant du tap — dont TOUTE la surface est une zone de tap pour arrêter (pas
besoin de viser un petit bouton en position planche). `stopHoldTimer()`/`finishHoldSet()` posent le
temps écoulé dans `reps` ET marquent la série faite EN UN SEUL `updateSet` (plutôt que deux appels
séparés dont l'ordre serait fragile), ce qui déclenche directement le décompte de repos derrière —
exactement l'enchaînement demandé. Complète la saisie manuelle du champ (toujours possible, pour le
cas où le téléphone n'est pas dans une position lisible pendant l'exercice), ne la remplace pas.

**`ex.reps` d'un exercice tenu affiché en "dernière fois"** — corrigé au passage pour rester cohérent
avec le fix ci-dessus : `lastKnown.reps` (une chaîne "30", venant de `ExerciseHistoryPoint`) passe
maintenant par `formatTimer(Number(...))` quand `isHold`, pour afficher "0:30" plutôt que l'entier nu
"30" qui laissait croire à des répétitions.

## Plan d'entraînement — vue calendrier (remplace le long scroll)

Retour utilisateur, capture d'écran (export PDF de l'app) à l'appui : "c'est pas idéal encore des
long scroll beaucoup d'info et on peut se perdre, et si on faisait une calendar view? un peu à
l'exemple de intervals, et peut-être en donnant un visual de l'activité (avec zone de puissance/
couleurs) etc pour que l'athlète sache ce qu'il a à faire. De plus ça permettrait en drag and drop ou
en ajustant la date de modifier le plan (tout en gardant l'option peut-être via un bouton) de
réajuster le plan basé sur ce qui a été réalistiquement fait." Décisions prises avant de coder
(`AskUserQuestion`) : tout le chantier en une fois (pas de phasage), et un sélecteur de date
tap-friendly plutôt qu'un vrai glisser-déposer tactile (plus fiable sur mobile, aucune nouvelle
dépendance comme `@dnd-kit`).

**Remplace l'ancien accordéon** (`TrainingPlanTab` : 12 cartes-semaine empilées, chacune développable
en cliquant, contenant elle-même la liste de ses séances) par deux nouvelles vues qui coexistent :
- **`PlanOverviewGrid`** — une ligne compacte par semaine (phase, focus, volume, 7 pastilles de
  couleur) pour l'orientation dans le plan entier, à l'exemple du calendrier Intervals.icu. Taper une
  semaine la sélectionne.
- **`PlanWeekCalendar`** — la semaine sélectionnée en détail : une bande de 7 jours en défilement
  horizontal (pas une grille 7 colonnes rigide, illisible sous ~400px de large), chaque jour coloré
  selon l'intensité de sa séance. Taper un jour avec une séance ouvre une feuille (`Sheet`, bas
  d'écran) avec le détail complet — c'est ce détail qui remplace le long scroll : plus besoin de
  dérouler 12 semaines pour lire une seule séance.
- **`PlanSessionDetail`** — le contenu détaillé d'UNE séance (badges de statut, alimentation,
  exercices muscu, validation S05, sélecteur de date, boutons d'action), extrait tel quel de
  l'ancien `WeekSessionsPanel` sans changement de comportement — seul son contexte d'affichage change
  (une feuille de détail par jour tapé, plus un accordéon de liste).

**Couleur d'intensité par jour — décision consciente sur la source des données**
(`plan-calendar-types.ts`, pur/testé) : les vraies zones de puissance seconde-par-seconde
(`computePowerZoneDistribution`, `ride-analysis-types.ts`) exigent le flux détaillé d'UNE activité —
un fetch réseau à part entière, bien trop coûteux à répéter pour chaque jour d'un calendrier de
plusieurs semaines. Deux sources différentes selon l'état de la séance, toutes deux déjà chargées en
masse, jamais un flux re-téléchargé pour l'occasion :
- **Séance déjà FAITE** — `completedRideZone()` préfère `icu_intensity` (Intensity Factor déjà
  calculé par Intervals.icu = NP/FTP, présent dans la liste d'activités déjà fetchée) ; à défaut,
  `bestAverageWatts()/ftp` (même helper que le reste de l'app). Null si ni l'un ni l'autre n'est
  calculable — le jour affiche alors une marque "faite" neutre plutôt qu'une couleur devinée.
- **Séance PLANIFIÉE** — `parseStructuredWorkoutProfile()` parse le script "workout builder" déjà
  généré par l'IA (voir `STRUCTURED_WORKOUT_SYNTAX`, jamais interprété côté client avant ce
  chantier) en une liste d'étapes avec leur cible %FTP, expansées selon le suffixe "Nx" de répétition
  de section. `averageIntensityPct()` en tire une moyenne pondérée par la durée, classée dans
  l'échelle Coggan 7 zones (`POWER_ZONES`, désormais exportée depuis `ride-analysis-types.ts` — même
  référentiel que l'analyse de sortie, pas une deuxième table). Ne lève jamais d'exception : une
  ligne illisible (ex. une cible en watts absolus plutôt qu'en %, cas rare) est simplement ignorée.
- La musculation n'a pas de %FTP — traitée à part visuellement (icône haltère, teinte primaire),
  jamais forcée dans l'échelle de couleur des zones.
- Sept couleurs réelles (jamais une classe Tailwind — même piège documenté pour `tsb-zones.ts`/
  `ring-metrics.ts`, une couleur posée en `style` inline plutôt qu'une classe `bg-*`), dégradé
  bleu→vert→jaune→orange→rouge→violet du plus facile au plus dur.

**Déplacer une séance** — inchangé dans sa mécanique (`moveSessionDate`, déjà en place depuis "Plan
figé par jour" : un simple `<Input type="date">`, borné à la semaine via `clampDateToWeek`) ; ce qui
change est son emplacement, maintenant dans `PlanSessionDetail` au sein de la feuille de détail
plutôt que dans l'ancien accordéon. Retour utilisateur explicitement tranché avant de coder : tap +
sélecteur de date plutôt qu'un vrai glisser-déposer tactile.

**"Recalibrer maintenant"** — la recalibration automatique existait déjà (voir plus bas, section
"Plan d'entraînement — figé par jour") mais tournait silencieusement, seulement à l'ouverture de
l'onglet, sans bouton. `recalibrateNow()` (`use-training-plan.ts`) expose le MÊME chemin
(`weekNeedsRecalibration` + `runRecalibration`) sur demande explicite, avec un retour visible (toast)
que l'automatique n'a jamais eu — si rien n'est dû (aucune semaine terminée pas encore prise en
compte), le dit honnêtement ("Rien à recalibrer") plutôt que de forcer une deuxième recalibration
d'une semaine déjà traitée. `isRecalibrating` (nouveau state, reflète `recalibratingRef` pour l'UI —
le ref seul ne déclenche pas de re-render) anime le bouton pendant l'appel IA.

**Génération automatique de la semaine courante** — l'ancien accordéon ne générait les séances type
d'une semaine qu'au premier clic pour la déplier (`toggleWeek`). La vue calendrier n'a plus ce geste
d'expansion : la semaine courante est désormais générée automatiquement à l'arrivée sur l'onglet si
elle ne l'est pas déjà (`autoGeneratedRef` dans `TrainingPlanTab`, garde contre les doubles appels),
pour que l'athlète voie sa semaine déjà composée sans action — exactement "que l'athlète sache ce
qu'il a à faire". Les autres semaines restent lazy (bouton "Proposer les séances" dans
`PlanWeekCalendar`/`PlanOverviewGrid`), pour ne jamais déclencher tous les appels IA du plan d'un
coup à l'ouverture.

## Plan d'entraînement — vue calendrier v2 : repli de phase, expansion inline, vigilance compacte

Retour utilisateur après premier usage réel de la vue calendrier ci-dessus : "étant donné que l'IA
génère seulement une semaine de plan d'entraînement, les petites pastilles pour le reste du plan
d'entraînement sont vides... il y a très peu d'intérêt. Est-ce que l'on devrait générer le plan
entièrement... ou pas?... Je pense que [garder juste la semaine en cours, avec une couleur
particulière pour le thème comme précédemment] a plus de sens." Question explicitement tranchée par
l'utilisateur lui-même dans son propre message : **ne pas générer tout le plan d'avance** — ça irait
à l'encontre du principe déjà en place "jamais tous les appels IA du plan d'un coup" (voir
`autoGeneratedRef` ci-dessus). `PlanOverviewGrid`/`WeekRow` affichent maintenant le badge de phase
(`PHASE_LABELS`/`PHASE_BADGE_CLASS`, déplacées de `training-plan-tab.tsx` vers des exports de
`training-plan-types.ts` pour être partagées) à la place des 7 pastilles quand `week.sampleSessions`
est absent — même table que l'ancien accordéon pré-calendrier, "comme c'était précédemment". La
semaine courante (seule générée automatiquement) garde ses 7 vraies pastilles d'intensité,
inchangées.

**Expansion inline** — retour utilisateur : "j'irai mettre chaque séance d'entraînement de la
semaine en cours directement sous la semaine en cours." `PlanOverviewGrid` accepte désormais un prop
`renderExpanded: (week: PlanWeek) => ReactNode`, rendu directement sous la ligne de la semaine
sélectionnée (à l'intérieur de la boucle `weeks.map`, pas après). `training-plan-tab.tsx` n'a plus de
bloc séparé `{selectedWeek && (...)}` sous toute la grille — le header de semaine (badges phase/
actuelle/ajustée) + `PlanWeekCalendar` sont passés tels quels comme ce `renderExpanded`.

**Vigilance compacte** (`plan-attention-types.ts`, pur/testé + `PlanAttentionBadge`) — retour
utilisateur : "tu as fait à chaque fois... des box de warning... ça prend quand même pas mal de
place sur la page et ça rallonge [la page]... je me demande s'il ne serait pas plus user friendly de
simplement avoir des pastilles ou des petits points d'exclamation, un, deux, trois selon le nombre de
warnings et qu'après l'utilisateur clique sur ce warning pour le voir." Avant ce correctif,
`training-plan-tab.tsx` empilait jusqu'à trois blocs toujours dépliés : la bannière de verdict
(`currentVerdict`), chaque chaîne de `activePlan.warnings[]`, et le contrôle `loadProgressionCheck`
(plan-check-8). `buildPlanAttentionItems()` aplatit ces trois sources en une seule liste
`AttentionItem[]` (`{severity: 'warn'|'block', text, ruleIds?}`) ; `PlanAttentionBadge` affiche un
unique bouton compact (icône + "N points de vigilance") qui ouvre une `Popover` listant chaque item —
remplace entièrement les trois blocs. Sévérité honnête préservée (retour utilisateur : "si on a des
box rouges, s'il y a vraiment un point de vigilance et que l'athlète ne devrait pas s'entraîner") :
`attentionOverallSeverity()` colore le déclencheur en rouge (`text-destructive`) si au moins un item
est `'block'`, en ambre sinon — jamais aplati en un point d'exclamation générique, et chaque item
déplié garde sa propre couleur/icône (`ShieldAlert` rouge vs `AlertTriangle` ambre) plus sa
`SourceCitation` quand il cite une règle (le contrôle de progression de charge). Placé à côté du
déclencheur "Pourquoi ce plan ?" existant — les deux sont le même geste "taper pour en savoir plus".
Note : `checkLoadProgressionWithoutDeload` (planValidator.ts) ne produit en pratique jamais
`'block'` aujourd'hui (seulement `'insufficient_data'|'warn'|'ok'`) — `buildPlanAttentionItems` gère
ce cas par cohérence de type, sans dépendre de cette garantie fragile.

## Coach — Aujourd'hui et Plan redéfusionnés

Retour utilisateur, après usage réel de la fusion documentée dans "Page Coach restructurée : 7 → 6
sous-onglets" (plus haut) : "je reste vraiment pas sûre d'avoir le côté plan et séances du jour sur
le même onglet... est-ce que tu peux faire une analyse critique et voir ce qui serait le plus
acceptable pour l'athlète ?"

**Diagnostic** — au moment de la fusion, "Aujourd'hui" (`DailyWorkoutTab`) et "Plan"
(`TrainingPlanTab`) étaient tous les deux légers : la fusion avait du sens, planifier une séance et
consulter son plan étaient le même geste mental. Depuis, `TrainingPlanTab` a grossi de façon
organique (le chantier "vue calendrier" : grille du plan entier, semaine dépliée inline, badge de
vigilance, journal des recalibrations — voir les deux sections "vue calendrier" ci-dessus) — il est
devenu un vrai écran de *gestion*, consulté par intermittence, pas un compagnon léger du geste
quotidien. Un séparateur visuel ("Plan complet") avait déjà été ajouté une fois pour rendre le long
scroll résultant plus lisible — un pansement sur le symptôme, pas la cause.

**Relu contre `COACH_UX_AUDIT.md` §2-3** (recherche Join/Frive/TrainerRoad déjà faite pour l'audit
précédent) : le motif commun des 3 concurrents n'est pas "plan vs séance du jour" sur un même écran
ou pas — Join fusionne bien readiness + séance du jour + *aperçu* de la semaine sur un seul écran,
mais c'est un résumé compact, pas un calendrier de 12 semaines éditable avec journal d'historique.
TrainerRoad sépare explicitement : son écran "Career" (glance quotidien : prochaine séance +
progression) est une destination, son "Calendar" (parcourir/éditer le plan) en est une autre. Le vrai
distinguo est **coup d'œil quotidien vs écran de gestion occasionnel** — pas la présence ou non d'un
plan à l'écran.

**Décision, tranchée par l'utilisateur après une analyse à deux options** (`AskUserQuestion` :
séparer en deux onglets vs garder fusionné avec le plan replié par défaut) : **séparer à nouveau**.
`coach/page.tsx` : `VALID_TABS` passe de 6 à 7 entrées (`'today'` ajouté, `'plan'` inchangé) ;
`TabsList` affiche désormais 5 déclencheurs (Aujourd'hui, Plan, Journal, Météo & Tenue, Stella) au
lieu de 4 — le menu "Plus" (Mémoire coach/Bibliothèque) reste inchangé à 2. "Aujourd'hui"
(`PendingFeedbackBanner` + `DailyWorkoutTab`) redevient l'onglet par défaut et son propre
`TabsContent` ; "Plan" (`TrainingPlanTab` seul, plus de séparateur "Plan complet" — devenu inutile,
les deux sont maintenant deux écrans distincts) redevient sa propre destination. Bénéfice secondaire
non cherché : `TrainingPlanTab` (code-splitté via `next/dynamic`) ne charge plus au premier rendu de
la page — avant, il partageait le même `TabsContent` qu'Aujourd'hui donc chargeait dès l'ouverture,
"à la demande" en théorie seulement ; maintenant qu'il a son propre onglet, le lazy-loading devient
réel.

Textes de Stella (`coach-chat-flow.ts`, system prompt) mis à jour en cohérence — référençaient encore
"Proposition du jour" et "Plan" (les noms d'onglets d'avant la fusion documentée plus haut, jamais
corrigés au moment de celle-ci) plutôt que "Aujourd'hui" et "Plan", les vrais libellés actuels vers
lesquels Stella renvoie l'athlète quand on lui demande une séance/un plan structuré.

## Plan calendrier v3 : statut visible, reprogrammer une séance manquée, mini-graphique de séance

Retour utilisateur, capture d'écran de la semaine dépliée à l'appui : "on ne retourne pas les séances
qui ont effectivement été effectuées... on ne sait pas si la séance est effectuée ou pas effectuée ou
si elle a été loupée. Il faudrait sûrement pouvoir donner la possibilité de, si une séance est
loupée [...] remettre quelque part dans la semaine... pourquoi là on n'utilise pas à la façon
intervalles la vue avec les zones cible, le temps... un peu comme un graphique, comme c'est sur
intervalles, ça serait sûrement un petit peu plus visuel." Trois demandes distinctes, sur la bande de
jours compacte de `PlanWeekCalendar` (la vue "preview" visible directement sous la semaine dépliée) :

**1. Statut réalisée/manquée invisible à ce niveau compact** — la feuille de détail
(`PlanSessionDetail`, ouverte au tap d'un jour) affichait déjà des badges "Réalisée"/"Manquée" clairs,
mais la bande de jours elle-même ne portait qu'un traitement discret (opacité + barré pour une séance
manquée, rien pour une séance réalisée) — insuffisant pour juger d'un coup d'œil sans ouvrir chaque
jour. Chaque tuile de séance dans la bande affiche désormais une icône explicite
(`CheckCircle2`/`XCircle`, même vocabulaire que `PlanSessionDetail`) en plus du traitement existant.

**2. Reprogrammer une séance manquée** — le déplacement d'une séance existait déjà (sélecteur de date
dans `PlanSessionDetail`, borné à la semaine) mais restait un geste générique, pas une action pensée
pour ce cas précis. `nextAvailableWeekDate()` (`training-plan-types.ts`, pur/testé) trouve le premier
jour de la semaine — à partir de DEMAIN, jamais un jour déjà passé — qui n'est pas déjà pris par une
autre séance de la semaine ; un nouveau bouton "Reprogrammer" apparaît à côté du badge "Manquée" dans
`PlanSessionDetail` et y déplace directement la séance en un tap (`onMoveDate` réutilisé tel quel).
Désactivé (jamais un repli inventé) si la semaine est déjà pleine à partir de demain — l'athlète
retombe alors sur le sélecteur de date manuel juste en dessous. **"Régénérer le plan pour la fin de
la semaine"** (l'autre volet de cette demande) n'a pas nécessité de nouveau mécanisme : le bouton
"Régénérer" de `PlanWeekCalendar` (déjà en place, régénère l'intégralité des séances type de la
semaine via l'IA) couvre déjà ce besoin — pas dupliqué.

**3. Mini-graphique de profil de séance, façon "workout builder" Intervals.icu** — remplace la simple
pastille de couleur unique (une couleur pour toute la séance) par un profil par étape. `WorkoutProfileBar`/
`workoutProfileBars()` (`plan-calendar-types.ts`, pur/testé) convertissent le profil déjà parsé
(`parseStructuredWorkoutProfile`, voir "vue calendrier" plus haut) en barres : largeur = part de la
durée totale, hauteur = **%FTP relatif au PIC de la séance** (jamais une échelle %FTP absolue — sinon
une sortie d'endurance à 30-60% et une séance VO2max à 110-120% rendraient toutes les deux des barres
"hautes" ou "basses" sans repère commun ; relatif au pic, chaque séance reste lisible sur son propre
profil), couleur = zone Coggan (`zoneForPct`, même échelle que `sessionZone` — pas une deuxième
palette). Plancher à 4% de hauteur pour qu'une étape de récupération à faible %FTP reste visible
plutôt que de s'aplatir à ~0px. Nouveau composant `WorkoutProfileChart` (`workout-profile-chart.tsx`,
rendu pur — la logique de calcul vit dans `workoutProfileBars`, testée séparément), utilisé à deux
tailles : compact (12px de haut) dans chaque tuile de la bande de jours, détaillé (48px) en tête de
`PlanSessionDetail`. Cycling uniquement (`session.sessionKind !== 'strength'`) — la musculation n'a
pas de %FTP, garde son traitement icône haltère existant ; `[]` (composant qui ne rend rien) pour une
séance sans script structuré exploitable, jamais un graphique vide ou inventé.

## Plan : voir l'activité liée à une séance réalisée

Retour utilisateur : "est-il possible de voir l'activité qui est liée à l'activité planifiée ?" —
une séance du plan marquée "Réalisée" (`matchSessionCompletion`, voir "Lien réalisé/prévu" plus haut)
savait déjà QU'elle avait été faite, mais ne gardait jamais l'id de l'activité Intervals.icu
réellement rapprochée : impossible d'ouvrir cette activité depuis le plan, il fallait la retrouver à
la main dans le Journal.

**`SessionCompletion.activityId`** (`training-plan-types.ts`) — nouveau champ optionnel, présent
uniquement pour une séance cycling `'done'`. `CyclingActivityLike` porte désormais un `id` (en plus
de `startDate`/`durationMinutes`), et `matchSessionCompletion()` le recopie dans `activityId` au
moment du rapprochement. `getSessionCompletion()` (`use-training-plan.ts`) thread `a.id` (l'id
Intervals.icu réel, déjà présent sur `IntervalsActivity` mais jusqu'ici jeté au moment de construire
la liste `cyclingActivities` allégée) — aucun nouveau fetch, la donnée était déjà chargée. Absent
côté musculation (`SessionCompletion` reste rapproché via `strengthSessionLogs`, pas une activité
Intervals.icu — pas d'équivalent "voir l'activité" pour ce cas aujourd'hui, une séance muscu n'a pas
de fiche Intervals.icu à visiter).

**`PlanSessionDetail`** — deux nouveaux boutons apparaissent à côté du badge "Réalisée" quand
`activityId` est présent, réutilisant tels quels les mêmes mécanismes que le Journal
(`rides-journal-tab.tsx`) plutôt que d'en dupliquer la logique : un lien "Voir sur Intervals.icu"
(`https://intervals.icu/activities/{id}`, nouvel onglet — même URL que le lien de ligne du Journal)
et un bouton "Analyser" qui ouvre `RideAnalysisDialog` (`ride-analysis-dialog.tsx`, déjà existant —
analyse IA de sortie, stockée dans `rideAnalyses/{activityId}`, régénérable) directement depuis la
séance du plan.

## Cyclisme : aperçu de la séance prévue + fix auto-génération

Retour utilisateur : "revenons sur la proposition de mettre sous les indicateurs clef du jour la
séance « prévue » au plan du jour (si pas de plan un bouton pour préparer le plan), un autre bouton
pourrait être prévoir une autre activité." Place le geste "que dois-je faire aujourd'hui ?"
directement à côté des indicateurs de forme (Forme/Récupération/Sommeil) sur Cyclisme, plutôt que
d'exiger un aller-retour de nav vers Coach — même motif "readiness + séance du jour sur un seul
écran" documenté dans `COACH_UX_AUDIT.md` (Join/TrainerRoad), appliqué ici SANS dupliquer tout
`DailyWorkoutTab` : Cyclisme reste la page données (voir "Coach" plus haut — "Cyclisme redevient
purement la page données"), Coach reste seul propriétaire de la génération/l'ajustement de la
séance elle-même.

**`TodaysSessionCard`** (`todays-session-card.tsx`) — nouvelle carte dans le panneau "Aujourd'hui"
de `performance-bento.tsx`, juste sous les anneaux Forme/Récupération/Sommeil et les stats HRV/FC
repos. Lit `useTodaysPlanSession()` (`use-todays-plan-session.ts`, nouveau hook), volontairement
READ-ONLY (aucune génération IA, aucune mutation) pour ne pas faire porter à Cyclisme une
responsabilité qui appartient à Coach — juste un `useCollection` sur `trainingPlans` (`status ==
'active'`) + `currentPlanWeek()`/recherche de la séance datée aujourd'hui (`training-plan-types.ts`,
déjà existants). Trois états : aucun plan actif → bouton "Préparer mon plan" (`/coach?tab=plan`) +
bouton secondaire "Prévoir une activité" (`/coach?tab=today`) ; plan actif avec séance du jour
connue → titre/durée/icône (vélo ou haltère selon `sessionKind`) + boutons "Voir la séance"/"Prévoir
une autre activité" (tous deux vers `/coach?tab=today` — intentions différentes, même destination :
`DailyWorkoutTab` gère déjà les deux, suivre le plan par défaut ou en dévier via le toggle Vélo/
Salle, dupliquer ce choix ici introduirait une deuxième façon de le faire) ; plan actif mais semaine
courante pas encore composée → phase/focus affichés à la place du titre précis, mêmes boutons.

**⚠️ Régression découverte et corrigée en construisant cette carte** : depuis la séparation
Aujourd'hui/Plan en deux onglets (voir "Aujourd'hui et Plan redéfusionnés" plus haut),
l'auto-génération de la semaine courante (voir "Génération automatique de la semaine courante",
section "vue calendrier") ne se déclenchait plus que depuis l'onglet Plan (`training-plan-tab.tsx`,
`autoGeneratedRef`) — un athlète qui n'ouvrait que "Aujourd'hui" (l'onglet par défaut désormais) ne
voyait donc plus jamais sa semaine composée automatiquement, ni dans "Aujourd'hui" ni dans cette
nouvelle carte Cyclisme. `generateWeekSessions`/`generatingSessionsForWeek` extraits de
`use-training-plan.ts` vers un hook partagé, **`useGenerateWeekSessions()`**
(`use-generate-week-sessions.ts`) — prend en paramètre les données déjà chargées par l'appelant
(mémoire coach, budget kJ, gouverneur, indices de puissance, athlète) plutôt que de les refetch :
`use-training-plan.ts` ET `use-daily-workout.ts` les ont chacun DÉJÀ pour leur propre appel IA, donc
brancher les deux sur ce hook partagé n'introduit AUCUNE lecture Firestore/Intervals.icu
supplémentaire — juste une génération réellement déclenchable depuis les deux onglets. Même effet
`autoGeneratedRef` ajouté à `daily-workout-tab.tsx` (dupliqué plutôt que partagé au niveau composant
— chaque onglet garde sa propre garde contre le double-appel — mais le mutateur lui-même reste
unique). Cyclisme, lui, reste strictement en lecture : s'il est visité avant tout passage par Coach,
`TodaysSessionCard` dégrade gracieusement sur phase/focus plutôt que de déclencher un appel IA
depuis la page données.

## Indicateurs Cyclisme — audit "propriétaire" et anneau Récupération

Retour utilisateur : "si on revient sur la page cyclisme je pense qui serait utile de mettre tous
les indicateurs que nous avons défini et d'éviter tous indicateurs qui reste propriétaire (hors
TSS)." Plutôt que de deviner ce qui est "propriétaire", audit direct du système de règles sourcées
déjà en place (`src/domain/cycling/evidence/`) — ce projet a en réalité déjà une position écrite sur
le sujet, pas encore totalement respectée partout.

**Ce qui est déjà correct** : la règle `power-np-if-tss-label-proprietary` (`evidence/rules.ts`)
classe NP/IF/**TSS** comme "métriques propriétaires non validées par les pairs" — exactement le
"hors TSS" de la demande, déjà codifié avant même cette conversation. NP/IF ne sont d'ailleurs
jamais affichés comme un chiffre brut nulle part dans l'app (seulement utilisés en interne pour le
Variability Index et la classification de zones) — rien à corriger de ce côté. Le modèle 5-7 zones
Coggan (`POWER_ZONES`, `zoneForPct` — utilisé par `sessionZone`/`WorkoutProfileChart` sur le
calendrier du plan, et par l'analyse de sortie) reste lui aussi une convention issue du même
algorithme, jamais présentée comme validée indépendamment (`power-zones-5-7-zone-prescription-
convention`) — accepté tel quel, c'est le langage visuel standard du secteur pour prescrire une
séance, pas un chiffre affiché en soi.

**⚠️ Écart trouvé et corrigé** : l'anneau "Récupération" (`readinessRingColor`, `ring-metrics.ts`)
préférait jusqu'ici le score de récupération propriétaire d'un capteur connecté (WHOOP, relayé par
Intervals.icu, champ `wellness.readiness`) à la formule locale sleep/stress/mood de l'app —
`resolveReadiness()` (`lifestyle-types.ts`) retournait ce score de capteur dès qu'il était présent.
Ça contredisait directement une règle déjà écrite dans ce même projet, `readiness-composition-
explicit-weighting` (`evidence/rules.ts`) : la composition du score readiness doit avoir "une
pondération explicite et visible/modifiable par l'utilisateur" — ce qu'un score de capteur en boîte
noire ne peut par nature pas offrir. Décision utilisateur (`AskUserQuestion`, deux options : toujours
la formule transparente vs. garder la priorité au capteur) : **toujours la formule transparente**.
`resolveReadiness()` supprimé — `computeReadiness()` (formule locale, déjà existante, inchangée) est
désormais la seule source, dans les 3 endroits qui lisaient un score readiness (`use-lifestyle-
data.ts` pour le ring Cyclisme et les pages détail, `use-governor.ts` pour le signal readiness du
gouverneur de charge interne — les deux consommaient déjà `resolveReadiness`, donc les deux
héritent du même correctif sans changement de comportement l'un par rapport à l'autre). Compromis
assumé, documenté dans le code : moins précis qu'un capteur haut de gamme quand un est connecté,
mais jamais une boîte noire.

**Métriques définies mais jamais affichées, identifiées pour discussion future** (pas construites
dans ce chantier — l'utilisateur a demandé un plan avant d'aller plus loin) : `durability.ts`
(dégradation de puissance sur effort long — documentée dans son propre code comme "le cœur
différenciant du produit... aucun équivalent n'existe") et `decoupling.ts` (découplage cardiaque
Pw:HR) sont déjà calculées pour l'analyse IA d'une sortie (`use-ride-analysis.ts`) mais jamais
montrées comme un chiffre autonome ; `criticalPower.ts` (modèle CP/W′) pareil à l'époque de cet
audit — depuis affiché comme sa propre tuile, voir juste en dessous ; `impulseResponse.ts` (modèle
Banister fitness-fatigue, alternative de simulation au CTL/ATL directement lus depuis Intervals.icu)
et `metabolism.ts` (équation Ten-Haaf, plus fiable que Mifflin-St Jeor selon R32 mais bloquée tant
que `TEN_HAAF_COEFFICIENTS`, evidence/constants.ts, reste `pending`) ne sont carrément pas branchés à
l'UI. Chacun a son propre commentaire de fichier documentant précisément pourquoi/dans quel contexte
l'utiliser — point de départ pour une future proposition détaillée plutôt qu'une redécouverte.

**Tuile Puissance critique (CP/W′)** — retour utilisateur, en réponse directe à la question "quelle
ampleur donner à ces métriques non affichées ?" (`AskUserQuestion`) : construire la tuile CP/W′ en
priorité. `riegel-prefer-critical-power-side-cycling` (`evidence/rules.ts`) fait de ce modèle
l'alternative à privilégier côté vélo par rapport à l'indice Riegel déjà affiché — physiologiquement
fondé (Jones et al. 2010, Travail = CP × durée + W′) plutôt qu'un simple ajustement statistique.
`fitCriticalPower()` (`criticalPower.ts`, déjà existant/testé, jusqu'ici utilisé seulement en
interne pour le contexte coach) est maintenant appelé côté UI sur les mêmes 3 records personnels
que Riegel (`usePowerCurve`) — aucune nouvelle saisie demandée à l'athlète. Nouvelle `MetricTile`
"Puissance critique" dans la grille "Entraînement" de `performance-bento.tsx`, juste après FTP
(masquée si le modèle ne peut pas être ajusté — moins de 2 records valides). Nouvel id `criticalPower`
sur `/cycling/metric/[id]` (`metric-info.ts`) : comme Riegel, pas de courbe d'historique (recalculé
à la volée depuis les mêmes 3 records, jamais stocké jour par jour) — affiche `PowerCurveCard` (le
même composant de saisie que Riegel) plutôt qu'un graphique vide, plus un encart W′ dédié sous le
verdict citant la règle qui motive la tuile. L'entrée `readiness` de `metric-info.ts` a été
corrigée au passage : son texte référençait encore l'ancien comportement de préférence au capteur,
périmé depuis le correctif ci-dessus.

**Analyse de sortie : encarts Durabilité + Découplage cardiaque** — deuxième pièce du même audit
(`AskUserQuestion` : "Durabilité + Découplage dans l'analyse d'une sortie"). `durability.ts`
(dégradation de puissance sur effort long) et `decoupling.ts` (découplage cardiaque Pw:HR,
Maunder et al. 2021, R06) étaient déjà calculés dans `use-ride-analysis.ts` pour nourrir le prompt
IA de `rideAnalysis`, mais le résultat n'était jamais persisté ni affiché comme chiffre autonome —
seul le texte généré par l'IA était visible dans `RideAnalysisDialog`. Deux encarts chiffrés
ajoutés, en complément du texte IA (pas un remplacement) :
- **Durabilité** — `computeDurabilityProfile()` sort un profil complet (5 paliers de travail
  accumulé × 6 durées de MMP testées), bien trop dense pour un encart de dialogue.
  `summarizeDurabilityForDisplay()` (`ride-analysis-types.ts`, pur/testé) le réduit à une seule
  durée repère (5 min) : le % de MMP conservé à chaque palier de fatigue franchi PENDANT la sortie,
  comparé au palier "à froid" (0 kJ/kg) de la MÊME sortie — jamais une comparaison à l'historique de
  l'athlète (`compareDurabilityToHistory()`, qui exigerait de refetcher plusieurs sorties passées
  comparables, hors scope ici) ni à un autre athlète ou un seuil labo, conformément à la règle
  `ride-analysis-2-power-profile-by-accumulated-tier`. `null` (encart masqué) si le palier "à froid"
  n'a pas de MMP à 5 min (sortie trop courte) ou si aucun palier de fatigue n'a été franchi.
- **Découplage cardiaque (Pw:HR)** — `computeDecoupling()` (déjà existant/testé), affiché tel quel :
  l'efficience puissance/FC de chaque moitié de la sortie (W/bpm) et le % de dérive entre les deux,
  coloré (rouge si dérive positive = FC monte plus que la puissance, vert sinon) — jamais interprété
  au-delà de ce que dit le module lui-même (le module calcule le nombre, ne l'interprète pas — voir
  son commentaire de fichier).
- **Persistance** — `StoredRideAnalysis` (`users/{uid}/rideAnalyses/{activityId}`) porte désormais
  `durability`/`decoupling` (`null`, jamais `undefined`, que Firestore refuse) à côté de `analysis` :
  recalculer ces deux chiffres à chaque ouverture du dialogue exigerait de refetcher les streams
  seconde par seconde (coûteux, voir la note existante sur `getActivityStreams()` plus haut) — ils
  sont donc écrits une fois à la génération et relus depuis Firestore comme `analysis`, écrasés au
  même moment (`setDoc`) qu'un "Régénérer".

**Métabolisme de base : coefficients Ten-Haaf sourcés (`TEN_HAAF_COEFFICIENTS`)** — troisième et
dernière pièce du même audit (`AskUserQuestion` : "Sourcer les coefficients Ten-Haaf (BMR)").
`metabolism.ts` refusait systématiquement de calculer (`requireConstant()` levait) tant que R33
(ten Haaf & Weijs 2014) n'était pas extraite du tableau du papier — la règle explicite déjà inscrite
dans `constants.ts` ("Je les remplirai moi-même depuis les papiers. Ne les invente sous aucun
prétexte, même approximativement.") interdisait justement ce que ce correctif fait.

**⚠️ Exception documentée, explicitement approuvée** (`AskUserQuestion`, après avoir buté sur cette
règle) : l'accès direct au papier primaire (PLoS ONE, PMC, ResearchGate, Frontiers,
medicalalgorithms.com — même Wikipedia, même `journals.plos.org`/`doi.org` en `curl` direct) est
bloqué par le proxy réseau de ce sandbox, comme documenté ailleurs dans ce fichier pour
intervals.icu/Join/Frive/TrainerRoad — seuls `raw.githubusercontent.com`/`api.github.com` (git infra)
restent joignables. Les coefficients ont donc été **triangulés via 3 recherches web indépendantes**
qui reproduisent exactement les mêmes chiffres à chaque fois, avec un signe fort de fiabilité : la
conversion kJ→kcal d'une des sources (donnée séparément de la formule kJ/jour) tombe exactement
juste sur les 5 coefficients indépendants de la variante masse corporelle
(49,940/4,184≈11,936 ; 2459,053/4,184≈587,728 ; 34,014/4,184≈8,129 ; 799,257/4,184≈191,027 ;
122,502/4,184≈29,279) — une coïncidence hautement improbable si les chiffres étaient fabriqués.
`TEN_HAAF_COEFFICIENTS` passe donc de `pending` à `sourced` (refs `['R33']`), avec un `note` qui
documente cette méthode de sourcing en toutes lettres plutôt que de la faire disparaître derrière un
statut `sourced` silencieux — à re-confirmer contre le tableau original si l'accès réseau direct
devient possible un jour.

**`computeRestingMetabolicRate()`** (`metabolism.ts`) calcule désormais réellement les deux variantes
de l'équation (masse corporelle : poids/taille/âge/sexe ; masse maigre : FFM seule, préférée si
fournie et positive) — coefficients en kJ/jour comme publiés, convertis en kcal/jour (÷4,184, la même
conversion physique déjà documentée pour le budget kJ dans `fueling-types.ts`) pour rester dans
l'unité déjà utilisée partout ailleurs dans l'app. **Portée volontairement limitée à ce déblocage** :
`computeBMR()` (tuile Fueling vs Workload) continue d'utiliser Mifflin-St Jeor pour l'instant — le
remplacer est une décision UI distincte (déjà anticipée dans le commentaire de fichier de
`metabolism.ts` comme "Phase 5"), pas le scope de "sourcer les coefficients" demandé ici.

## Readiness : intégration HRV/FC repos (tendance vs ligne de base)

Retour utilisateur, après une question sur l'écart entre le readiness de l'app et le score WHOOP :
"si on a pas de data point en input n'utilisons pas ces indicateurs, je suis d'accord sur le
changement et l'intégration hrv et fc". Diagnostic posé avant de coder : `computeReadiness()`
(voir "Indicateurs Cyclisme — audit propriétaire" plus haut) ne moyennait que sommeil/stress/humeur
— jamais le HRV ni la FC repos, alors que ce sont précisément les deux signaux qui dominent le score
Recovery de WHOOP. Sur un jour de bon sommeil mais de HRV effondré par une charge accumulée (le cas
que WHOOP est justement fait pour détecter), le readiness de l'app restait haut faute de jamais
regarder le HRV.

**HRV/FC repos ajoutés comme TENDANCE, pas valeur brute** — `computeReadiness()` accepte désormais un
second paramètre optionnel `history` (le reste de la série mergée). Quand fourni, deux composantes
supplémentaires rejoignent la moyenne (sleepQuality/stress/mood, inchangées) : la tendance HRV et FC
repos de la fenêtre récente (7j) par rapport à une ligne de base (28j), via `windowedTrendSignal()`
— **réutilisé tel quel depuis `governor-types.ts`** (déjà utilisé par le gouverneur de charge interne
pour exactement ce calcul) plutôt qu'un deuxième algorithme de comparaison à une baseline. Jamais la
valeur brute du jour comparée à un seuil absolu : le HRV varie trop d'une personne à l'autre pour
qu'un chiffre isolé ait un sens, seule la trajectoire par rapport à SA PROPRE ligne de base compte
(principle-2, evidence/rules.ts) — et cette trajectoire ne pèse jamais seule dans le score : c'est une
composante parmi 3 à 5 dans une moyenne, jamais un verdict affiché isolément (`principle-3-hrv-sign-
ambiguous`/`forbidden-hrv-sign-fatigue-freshness` : le signe d'une variation de HRV reste ambigu en
soi, une hausse comme une baisse pouvant signaler une adaptation négative). Le signal `-1/0/+1/null`
de `windowedTrendSignal()` se convertit simplement en `0/50/100` sur la même échelle que les autres
composantes ; `null` (baseline insuffisante, ou champ absent ce jour-là) omet la composante de la
moyenne plutôt que d'y substituer un 50 par défaut — exactement la demande utilisateur ("si on a pas
de data point... n'utilisons pas ces indicateurs").

**`useLifestyleData()` élargit son fetch interne, sans changer sa fenêtre affichée** — calculer une
tendance 7j vs baseline 28j exige plus d'historique que les 7 jours que ce hook fetch par défaut
(fenêtre déjà utilisée par le graphe 7 jours de `/lifestyle`, entre autres). `dayIds`/`dailySeries`
retournés publiquement restent scopés à `days` (aucun changement de forme pour les consommateurs
existants) ; en interne, une `extendedDayIds` (`days + 28`) alimente le fetch Firestore
`healthMetrics` (coût réel mais modeste — peu de docs pour une app mono-utilisateur) ET la requête
`useWellness()` (coût nul : ce hook filtre un contexte déjà entièrement synchronisé sur 180 jours,
voir `WELLNESS_WINDOW_DAYS` dans `use-intervals.tsx` — élargir la plage demandée ne déclenche aucun
fetch réseau supplémentaire). `use-governor.ts` n'a rien eu à changer côté fetch : ses 36 jours déjà
récupérés pour ses propres signaux couvraient déjà largement le besoin — seul son appel à
`computeReadiness()` a été mis à jour pour lui passer cet historique déjà en main.

**`readinessBaselineLookbackDays()`** (`lifestyle-types.ts`) réutilise `GOVERNOR_BASELINE_WINDOW`
(evidence/constants.ts, déjà la fenêtre ≥4 semaines du gouverneur) plutôt qu'une deuxième constante
inventée pour l'occasion — un seul référentiel de "ligne de base" dans toute l'app.

## Coach — "Aujourd'hui" affiche la séance du plan directement, formulaire en action secondaire

Retour utilisateur : "on devrait voir la séance qui est proposée [par] le plan... je me demande s'il
ne serait pas intéressant d'avoir ça sur l'onglet Aujourd'hui où on aurait les actions à faire
[bandeau RPE manquant, déjà présent — voir "Audit UX Coach" plus haut], puis la séance du jour
proposée sur le plan, et un bouton... de proposition alternative où l'utilisateur clique et ça
l'emmène [définir] combien de temps tu as disponible, où tu es, etc." — pour si l'athlète a moins de
temps que prévu, par exemple.

**Avant ce correctif**, `DailyWorkoutTab` affichait TOUJOURS le formulaire temps disponible/intérieur-
extérieur/lieu/heure en premier, que le plan ait déjà daté une séance vélo aujourd'hui ou non — il
fallait cliquer "Proposer une séance" (un appel IA) juste pour voir ce que le plan prévoyait déjà
(le flow utilise en interne `plannedSession`, voir plus haut, mais ne l'affiche qu'après génération).

**`showPlanPreview`** (`daily-workout-tab.tsx`) — quand `todaysPlanSession` existe (séance CYCLING
déjà datée aujourd'hui par le plan) et qu'aucun draft n'a encore été généré, une carte compacte
affiche directement titre/durée/intensité/motif de CETTE séance — aucun appel IA nécessaire juste
pour la voir, ces champs sont déjà dans `PlanWeekSession`. Deux actions : **"Utiliser cette séance"**
appelle `generate()` (même chemin qu'avant, `plannedSession` ajusté-ou-inchangé par l'IA) avec les
paramètres de la séance du plan elle-même (sa durée, extérieur, sans lieu) — garde le même chemin
d'envoi unique (verdict/warnings/édition avant "Envoyer sur Intervals.icu"), un seul appel plutôt que
zéro, pour ne pas dupliquer la logique d'ajustement/validation déjà en place. **"Proposer une séance
alternative"** révèle le formulaire temps/lieu/heure existant (`showAlternativeForm`, nouvel état
local, jamais persisté — même statut que `wantsGym`) — exactement le geste demandé : "combien de
temps tu as disponible, où tu es" pour une sortie différente (moins de temps, ailleurs...). Un lien
"← Revenir à la séance prévue par le plan" permet de rebrousser chemin tant qu'aucun draft n'a encore
été généré depuis le formulaire.

**Sans séance datée par le plan aujourd'hui** (pas de plan actif, ou jour sans séance vélo prévue) —
comportement inchangé : le formulaire reste la vue par défaut (rien à prévisualiser). Une fois un
draft généré par n'importe quel chemin, le formulaire redevient (ou reste) visible pour rester
ajustable/régénérable — comportement identique à avant ce correctif.

## ⚠️ Bug réel : `QuickFeedbackButton` (RPE) — `preventDefault()` empêchait le Popover Radix de s'ouvrir

Retour utilisateur, en cherchant où saisir un RPE manquant dans l'app : "le menu ne s'ouvre pas".
`QuickFeedbackButton` (`quick-feedback-widget.tsx`) est un `<PopoverTrigger asChild>` dont le bouton
enfant appelait `e.preventDefault(); e.stopPropagation()` — pensé pour empêcher la ligne parente
(un `<a>` vers Intervals.icu dans le Journal, `rides-journal-tab.tsx`) de naviguer au clic.

**Cause exacte, tracée dans le code de Radix** (`@radix-ui/react-popover`, `PopoverTrigger`) : le
`onClick` du trigger est composé avec le handler interne d'ouverture via
`composeEventHandlers(props.onClick, context.onOpenToggle)` — et `composeEventHandlers`
(`@radix-ui/primitive`) a `checkForDefaultPrevented: true` par défaut : `context.onOpenToggle`
n'est appelé que si `!event.defaultPrevented`. Dès que le `onClick` du bouton enfant appelle
`preventDefault()`, `onOpenToggle` n'est donc plus jamais invoqué — le Popover reste fermé à
chaque clic, silencieusement (aucune erreur console, rien dans les logs). Confirmé en lisant
directement `node_modules/@radix-ui/react-popover/dist/index.js` et `.../primitive/dist/index.js`,
pas une supposition.

**`stopPropagation()` seul suffit** à empêcher la navigation du `<a>` parent (l'événement ne se
propage jamais jusqu'à l'ancêtre, donc son action par défaut — la navigation — ne se déclenche
jamais) — pas besoin de `preventDefault()` pour ça. Même patron déjà correct ailleurs dans le
projet, `strength-log-export-button.tsx` (`<PopoverTrigger asChild>` avec
`onClick={(e) => e.stopPropagation()}` seul) — la comparaison entre les deux fichiers a d'ailleurs
été le premier indice avant de remonter à la cause exacte côté Radix.

**Audit fait sur toute la base** (`grep` de `Trigger asChild` croisé avec `preventDefault`) : aucun
autre `PopoverTrigger`/`DialogTrigger`/`DropdownMenuTrigger asChild` du projet ne combine les deux —
bug isolé à ce seul fichier, corrigé sans toucher au reste.

## Readiness : score de tendance HRV/FC repos continu, plus discret 0/50/100

Retour utilisateur, après le correctif "intégration HRV/FC repos" ci-dessus (déjà en place) : "I
still have big gap between readiness and what whoop give me, today I am at 90% on whoop but only
50% in our app; it is a major gap that we should close."

**Diagnostic** — l'intégration HRV/FC repos précédente convertissait déjà la tendance récente (7j)
vs ligne de base (28j, `windowedTrendSignal`, `governor-types.ts`) en composante de score, mais via
le signal discret `-1/0/+1` que ce helper produit pour le verdict catégoriel du gouverneur (vert/
orange/rouge). `trendToReadinessScore()` mappait alors ce signal en `0/50/100` — donc N'IMPORTE
QUELLE tendance favorable, qu'elle soit à peine positive (+2%) ou massivement positive (+50%,
calibre WHOOP 90%), contribuait de façon identique, plafonnée à 100. Une journée avec un sommeil
correct (disons 80) et une tendance HRV/FC repos réellement excellente ne se distinguait donc pas,
dans la moyenne, d'une journée avec le même sommeil et une tendance à peine favorable — le signal
fort était dilué au lieu de tirer le score vers le haut proportionnellement à sa vraie force. Ce
n'est pas seulement "ne colle pas à la boîte noire de WHOOP" : c'est un défaut structurel de la
formule elle-même, qui aplatit une information continue (l'ampleur réelle de la tendance) en trois
paliers grossiers.

**`trendReadinessScore()`** (`lifestyle-types.ts`) remplace `trendToReadinessScore(signal)` —
réutilise `splitRecentBaseline()`/`averageOrNull()` (`governor-types.ts`, les primitives de
fenêtrage sous-jacentes à `windowedTrendSignal`, déjà partagées/testées) directement plutôt que le
signal discret déjà aplati, pour calculer un score CONTINU 0-100 proportionnel au vrai `%` d'écart
entre la moyenne récente et la ligne de base — `favorableDirection` (`'higher'`/`'lower'`, HRV vs FC
repos) détermine le sens qui compte comme amélioration, exactement comme avant. `null` si moins de 2
points dans l'une des deux fenêtres, ou ligne de base à 0 — comportement de garde inchangé (voir
"si on a pas de data point... n'utilisons pas ces indicateurs", déjà acté).

**`READINESS_TREND_FULL_SWING_PCT = 20`** — constante plate documentée, même statut que
`SEVERE_WIND_THRESHOLD_KMH` (`ai/weather.ts`) : un choix de réactivité produit/UX, PAS une valeur
scientifique sourcée (donc hors du système `Constant<T>`/`sourced`/`pending` de
`evidence/constants.ts`, réservé aux valeurs citées). Un écart de ±20% entre moyenne récente et
ligne de base sature désormais le score à 0 ou 100 ; un écart plus petit est mis à l'échelle
linéairement autour de 50 (`50 + (favorablePct / 20) * 50`, clampé [0,100]) — ex. +10% → 75, +5% →
63. Le seuil de 20% a été choisi car cohérent avec l'ordre de grandeur des tendances HRV/FC repos
déjà observées ailleurs dans l'app (le gouverneur de charge, `governor-types.ts`, utilise des seuils
du même ordre pour son propre signal discret) — pas dérivé d'une étude, donc explicitement une
constante plate plutôt que `sourced`.

**Ce que ce correctif NE fait PAS, consciemment** : il ne calibre pas la formule pour reproduire
le chiffre exact de WHOOP (95% ou 50% un jour donné) — ça contredirait directement
`readiness-composition-explicit-weighting` (`evidence/rules.ts`, déjà invoqué pour la suppression de
`resolveReadiness()` plus haut dans ce fichier) : la formule doit rester une composition
transparente/auditable, jamais réglée pour imiter la sortie d'une boîte noire propriétaire. Le
correctif est justifié sur son propre mérite structurel (proportionnalité — ne plus diluer un signal
réellement fort au même palier qu'un signal à peine favorable), pas sur un objectif de faire
correspondre un chiffre externe précis. La signature publique de `computeReadiness(latest, history?)`
est inchangée — aucun appelant (`use-lifestyle-data.ts`, `use-governor.ts`) n'a eu besoin d'être
modifié.

**Tests** (`lifestyle-types.test.ts`) — les 4 tests de saturation existants (tendance HRV/FC repos
fortement favorable/défavorable → 100/0) ont vu leur fixture FC repos resserrée (65→55 devenait 88,
plus 100, sous le nouveau calcul continu — remplacée par 80→55, qui sature toujours proprement) ;
deux nouveaux tests valident directement le cœur du correctif — une tendance HRV modérée (+10%) score
75, une tendance légère (+5%) score 63 — plutôt que les anciens 50/100 plats.

## Retrait du `PageHeader` sur les pages de nav principale (déjà fait pour Cyclisme)

Retour utilisateur, capture d'écran de la page Coach à l'appui (le bandeau "COACHING IA / Coach"
cerclé en jaune) : "remove this header in all tabs it is not necessary as the user know from the
nav bar at the bottom where he is." Suite directe du même raisonnement déjà appliqué à Cyclisme
(voir "Chaque tuile de Vue d'ensemble renvoie vers..." plus haut — le `PageHeader` "Performance /
LifeCycle Vault" y avait été supprimé pour la même raison), jamais généralisé au reste de l'app
jusqu'ici.

**Portée : les destinations de `navItems` + Réglages, PAS les pages détail.** `sidebar.tsx` surligne
un item de nav via `isActive = pathname === item.href` — un **exact match**, pas un `startsWith`.
Donc la sidebar/bottom nav surlignent bien "Coach" sur `/coach`, "Cyclisme" sur `/cycling`, etc.,
mais ne surlignent RIEN sur une sous-page comme `/cycling/budget`, `/cycling/governor`,
`/cycling/metric/[id]`, `/nutrition/fueling`, `/finance` ou `/lifestyle` — sur ces pages-là, le
`PageHeader` reste la SEULE indication de l'écran sur lequel on se trouve, donc il reste. Retiré
uniquement sur : `coach/page.tsx`, `garage/page.tsx`, `nutrition/page.tsx`, `home-management/
page.tsx`, `settings/page.tsx` (Réglages n'est pas dans `navItems` mais reçoit le même traitement
`pathname === '/settings'` dans `sidebar.tsx` — même surlignage, même redondance).

**Mécanique identique à Cyclisme** : suppression de l'import + du rendu `<PageHeader
category="..." title="..." />`, `<main>` passe de `p-4 md:p-8` à `px-4 pt-20 pb-4 md:p-8` — `pt-20`
remplace la clearance mobile (`mt-16 md:mt-0`) que `PageHeader` apportait via son propre style,
pour ne pas passer sous le header mobile fixe. Un commentaire dans chaque fichier documente le
choix, pointant vers le même raisonnement plutôt que de le redupliquer intégralement partout.

**`nutrition/page.tsx` — seule page à porter des `actions` réelles dans son `PageHeader`** (les
dialogues "Objectifs" et "Ajouter une recette", via `actions={<>...</>}`) : ces boutons ne sont PAS
redondants avec la nav (ce sont de vraies actions, pas un libellé de page), donc ils restent — juste
posés dans un simple `<div className="flex items-center justify-end gap-3">` en haut du flux
plutôt que dans le bandeau titre disparu. Les autres pages traitées (Coach, Garage, Maison,
Réglages) n'avaient aucune action dans leur `PageHeader` — suppression pure, rien à replacer.

**Comportement inchangé, aucun test à toucher** : ce chantier ne touche que la mise en page (JSX +
classes), aucune logique pure — la suite de 825 tests passe sans modification.

## Chaînes : sorties liées, stockées à chaque sync plutôt que recalculées au clic

Retour utilisateur, sur la tuile "194 km" (Chaînes, Garage) : "crois-tu qu'en cliquant sur les km on
puisse voir les sorties liées ?" — le nombre était jusqu'ici du texte brut, sans lien ni requête
possible (`km-sync.ts` n'agrège qu'un delta total, aucun id d'activité individuel n'était jamais
gardé). Deux options posées : (1) reconstruire la liste à la volée au clic (filtrer les activités
Intervals.icu par `gear.id` + date), ou (2) stocker les activités qui contribuent à chaque sync.
Décision utilisateur après une première proposition orientée option 1 : "Non en fait l'option 2
semble plus robuste vérifie ? Attention à bien mettre les sorties sur la chaîne qui est montée en ce
moment" — et une correction sur le fenêtrage : "Pas depuis le dernier fartage mais depuis le dernier
montage."

**`LinkedRide`** (`chain-types.ts`) — `{activityId, name, date, km}`, nouveau champ `Chain.linkedRides?:
LinkedRide[]` (optionnel — absent sur toute chaîne créée avant ce chantier, chaque lecteur retombe
sur `[]`). Conservé pour toute la vie de la chaîne, à travers les cycles montage/démontage — même
convention "jamais supprimé" que la sous-collection `waxHistory` — plutôt que remis à zéro à chaque
montage : `ridesSinceMount()` (pur, testé) est ce qui scope l'affichage à la période de montage EN
COURS (`date >= chain.mountedDate`), pas un vidage de la liste elle-même. Filtre volontairement sur
`mountedDate` et non `lastWaxDate` : `kmSinceWax` se remet à zéro à chaque fartage alors que la
chaîne reste généralement montée à travers plusieurs fartages — scoper par date de fartage aurait
fait disparaître des sorties que l'athlète s'attend toujours à voir.

**`extractLinkedRides()`** (`km-sync.ts`) — même règle de correspondance que
`computeGearKmFromActivities()` (même gear id, distance réelle, strictement après la date de coupure),
factorisée dans un seul prédicat privé `matchesGearSinceCutoff()` partagé par les deux, pour que la
liste de sorties et le delta km ne puissent jamais compter des activités différentes. Renvoie les
activités elles-mêmes (id/nom/date/km arrondi individuellement) plutôt que leur somme.

**Attribution garantie à la chaîne montée EN CE MOMENT** (le point de vigilance explicite de
l'utilisateur) — `applyKmDeltaToBikeDependents()` reçoit maintenant un paramètre optionnel
`newlyLinkedRides` et l'écrit (`arrayUnion(...)`) dans le MÊME appel `updateDoc()` que le delta
km, sur le MÊME `chainToUpdate` que `planKmDeltaUpdate()` a déjà choisi (`bikeChains.find(c =>
c.status === 'montee')`, déjà testé) — jamais une deuxième écriture séparée qui pourrait cibler une
chaîne différente si un montage change entre les deux. `use-intervals.tsx` (`applyGearKmSync`, le
vrai chemin de sync Intervals.icu) calcule `newlyLinkedRides` via `extractLinkedRides(fullHistory,
bike.externalGearId, bike.lastSyncDate)` — capturé AVANT que `bike.lastSyncDate` soit écrasé par le
sync en cours, pour qu'une sortie ne soit jamais rattachée deux fois à la même chaîne d'un sync à
l'autre. Le chemin d'édition manuelle du km (`gear-tab.tsx`, `handleUpdateKm`) ne fournit jamais
`newlyLinkedRides` — une correction manuelle n'a aucune activité réelle à attribuer, honnête plutôt
que d'inventer un lien.

**⚠️ Limite honnête, symétrique à celle déjà acceptée pour le km total lui-même** — comme
`computeGearKmFromActivities()` ne redescend jamais si une activité est supprimée après coup côté
Intervals.icu, `linkedRides` est un instantané pris au moment du sync, jamais recalculé
rétroactivement si l'historique change ensuite (activité éditée/supprimée) ; et si `bike.totalKm`
a été ajusté par une édition manuelle entre deux vrais syncs, le delta recalculé et la liste de
sorties (bornée par date) peuvent légèrement diverger — jamais la mauvaise chaîne, au pire une liste
imprécise sur la bonne.

**`chain-card.tsx`** — nouvelle section "Sorties depuis le montage (N)" (`Collapsible`, même patron
que "Historique de fartage" juste en dessous), masquée si la chaîne n'a jamais été montée
(`chain.mountedDate` null — rien à scoper). Chaque ligne (nom, date, km) est un lien
`https://intervals.icu/activities/{activityId}` — même URL que les autres liens sortants vers
Intervals.icu déjà dans l'app (Journal, `PlanSessionDetail`).

## Onboarding Intervals.icu — audit "prêt pour quelqu'un d'autre que moi"

Retour utilisateur : "je veux qu'on passe en revue l'app sous l'angle 'prêt à être utilisé par
quelqu'un d'autre que moi' — documentation et onboarding, pas de nouvelle feature." Chantier en
quatre étapes explicitement demandées (audit d'abord, validation du plan avant tout code) :

**Étape 1 — audit** (aucun changement de code) : `/settings` était le SEUL écran mentionnant
Intervals.icu, et supposait déjà un compte existant (deux champs vides + un lien vers
`intervals.icu/settings`) — aucune mention de créer un compte, aucune mention qu'il faut d'abord
connecter Garmin/Strava/Wahoo *côté Intervals.icu* (LifeCycle ne s'en charge jamais). Aucune route
`/help`/`/about`/`/onboarding` n'existait ; `README.md` était le boilerplate Firebase Studio d'origine
(3 lignes, aucune mention de dépendance externe). Les écrans qui dépendent d'Intervals.icu se
répartissaient en trois catégories, déjà auditées avant ce chantier : (1) bien gérés —
`NotConfiguredBanner` (Cyclisme/Journal/PMC, un seul point de gate propre), le bandeau non-bloquant
de `/lifestyle` (le meilleur exemple existant : informe plutôt que bloque, saisie manuelle en
repli), `MetricCard`/`isAvailable` (Fueling vs Workload) ; (2) dégradation silencieuse correcte mais
sans guidage — `SyncButton` et le sélecteur "Lier à Intervals.icu" (Garage) disparaissent simplement
si non connecté, sans expliquer pourquoi ; (3) le vrai trou — **Coach > Aujourd'hui et Coach > Plan**
n'avaient aucun bandeau : l'athlète pouvait générer une proposition IA sans connexion (ça fonctionne,
contexte d'entraînement simplement omis) mais ne découvrait qu'il ne pouvait pas l'envoyer qu'APRÈS
avoir généré, via une petite ligne grise sous le bouton d'envoi.

**Étape 2 — plan validé par l'utilisateur** (`AskUserQuestion` sur trois choix d'implémentation avant
tout code : lien clé API `/settings` texte plutôt qu'ancre non vérifiable — accès réseau à
intervals.icu bloqué dans ce sandbox, même limite déjà documentée ailleurs dans ce fichier pour
Join/Frive/TrainerRoad ; formule d'attribution générique à rédiger plutôt qu'un texte de ToS non
vérifiable ; route dédiée `/onboarding` plutôt qu'une section dans une page d'aide plus large).

**Étape 3 — implémentation** :
- **`/onboarding`** (nouvelle route, pas dans `navItems` — même statut que `/lifestyle`/`/finance`,
  garde `PageHeader`) — 4 étapes explicites en cartes `.lc-card` : (1) créer un compte Intervals.icu
  gratuit, (2) connecter sa source d'activité *sur Intervals.icu* (Garmin/Strava/Wahoo — explicitement
  dit que LifeCycle n'y participe pas), (3) générer la clé API (`intervals.icu/settings`, "tout en bas,
  section Developer Settings" — instruction textuelle plutôt qu'un lien d'ancre non vérifiable, voir
  étape 2), (4) la renseigner dans Réglages. Badge de statut dynamique (`useAthlete().isConfigured`,
  même vérification que le reste de l'app — non-vide, pas une validation d'exactitude) sur l'étape 4 et
  dans le `PageHeader`. Dernière carte "Combien de temps avant de voir mes données ?" — la synchro
  LifeCycle est déjà automatique (`use-intervals.tsx`), le vrai délai variable est côté Intervals.icu
  lui-même selon la source (Strava quasi-immédiat, Garmin plus lent), et CTL/ATL/TSB ont besoin de
  plusieurs jours d'historique pour devenir significatifs — dit explicitement plutôt que de laisser
  l'utilisateur croire à un bug si rien ne s'affiche tout de suite après la première sortie importée.
- **`NotConfiguredBanner`** — CTA principal repointé vers `/onboarding` (guide pas-à-pas) plutôt que
  `/settings` directement (qui suppose un compte déjà existant) ; lien secondaire discret vers
  `/settings` conservé pour qui a déjà ses identifiants en main.
- **`IntervalsOnboardingNotice`** (`intervals-onboarding-notice.tsx`, nouveau composant partagé) —
  même patron visuel que le bandeau non-bloquant de `/lifestyle`. Affiché sur **Coach > Aujourd'hui**
  et **Coach > Plan** (les deux tabs qui n'avaient aucun signal avant ce chantier) via
  `canSendToIntervals` — déjà exposé par `useDailyWorkout()`/`useTrainingPlan()` (même check que le
  bouton d'envoi désactivé, aucune nouvelle lecture Firestore), donc le bandeau et le bouton ne peuvent
  jamais se désynchroniser. Non-bloquant par construction : la génération IA continue de fonctionner
  sans connexion, seul l'envoi vers Intervals.icu reste indisponible — le bandeau le dit avant que
  l'athlète ait à le découvrir en cliquant "Envoyer".
- **`/settings`** — nouvelle carte "Pas encore de compte Intervals.icu ?" au-dessus de la carte
  d'aide existante, qui pointe vers `/onboarding` plutôt que de redupliquer les explications sur cette
  page (qui reste focalisée sur la saisie des deux champs eux-mêmes, l'étape 4 du guide).
- **`README.md`** réécrit — était le boilerplate Firebase Studio d'origine (`"take a look at
  src/app/page.tsx"`, 3 lignes) : section "Dépendances externes" (Intervals.icu, Anthropic, Firebase —
  chacune avec ce qu'elle fournit et si elle est incontournable), setup dev (`npm install`/`npm run
  dev`, `ANTHROPIC_API_KEY` requis pour les flows IA), renvoi vers `CLAUDE.md` pour l'architecture et
  vers `/onboarding` in-app pour le parcours utilisateur final plutôt que de le redupliquer ici.

**Étape 4 — attribution Garmin** : chantier séparé, PR distincte — voir section suivante de ce fichier
(ajoutée par cette PR).

## Attribution des données Garmin (conditions d'utilisation Intervals.icu)

Retour utilisateur : Intervals.icu impose une attribution des données Garmin quand elles transitent
par leur API (section 1.1 de leurs conditions d'utilisation). **Accès réseau direct au texte des ToS
impossible depuis ce sandbox** (même limite déjà documentée ailleurs dans ce fichier pour
intervals.icu/Join/Frive/TrainerRoad — seuls `raw.githubusercontent.com`/`api.github.com` restent
joignables) — formule générique rédigée après validation explicite de l'utilisateur sur ce point
(`AskUserQuestion`, "Garmin-sourced data" comme ancrage), à ajuster si le texte exact des ToS
s'avère différent une fois l'accès réseau direct possible.

**Placement** : nouvelle carte "À propos des données" tout en bas de `/onboarding`, après la carte
sur le délai de sync — pas une page séparée (l'app n'en crée pas une pour ce seul besoin) et pas
`/settings` (qui reste focalisée sur l'action de connexion elle-même, pas une mention légale).
`/onboarding` est déjà l'endroit où l'app explique, à l'étape 2, que Garmin/Strava/Wahoo se
connectent côté Intervals.icu — cette carte prolonge naturellement cette explication plutôt que
d'être un ajout hors contexte ailleurs dans l'app.

**Contenu** : la formule couvre trois points — (1) les données affichées, y compris d'origine Garmin
("Garmin-sourced data"), viennent d'Intervals.icu, pas d'une connexion directe ; (2) LifeCycle ne se
connecte jamais lui-même à Garmin ni aux autres fabricants ; (3) Intervals.icu reste le seul
intermédiaire, conformément à ses propres conditions d'utilisation — sans citer un numéro de section
précis, puisque le texte exact n'a pas pu être vérifié directement.

## Modèle de Données Firestore

Toutes les données utilisateur sont sous `users/{uid}/` :

| Collection | Document | Description |
|-----------|----------|-------------|
| `users/{uid}/recipes` | `{recipeId}` | Recettes : title, ingredients[], instructions, calories, protein, carbs |
| `users/{uid}/tasks` | `{taskId}` | Tâches : name, room, priority, recurrenceDays, nextDueDate (Timestamp), isActive |
| `users/{uid}/settings/intervals` | (singleton) | intervalsAthleteId, intervalsApiKey |
| `users/{uid}/settings/powerCurve` | (singleton) | shortRecord/mediumRecord/longRecord `{seconds, watts}` — records perso pour l'indice d'endurance de Riegel. Auto-rempli depuis la vraie courbe de puissance Intervals.icu quand connecté (`usePowerCurve` fusionne manuel + auto, manuel prioritaire par champ — même logique que `mergeDailyWellness`) ; ce doc ne stocke que les valeurs manuellement corrigées, pas les valeurs auto-calculées |
| `users/{uid}/settings/biometrics` | (singleton) | `heightCm`/`age`/`sex` — saisie manuelle uniquement (Intervals.icu ne fournit que le poids), pour le calcul du métabolisme de base (Mifflin-St Jeor, `computeBMR()` dans `fueling-types.ts`) sur la tuile Fueling vs Workload |
| `users/{uid}/coachInjuries` | `{injuryId}` | Blessures : bodyRegion, severity (1-5), status, startDate, description, physioInstructions |
| `users/{uid}/coachGoals` | `{goalId}` | Objectifs coach IA : eventName, eventDate, targetOutcome, priority |
| `users/{uid}/coachMemory` | `lifestyle` / `facts` (singletons) | Style de vie (texte libre) et faits retenus (`items: string[]`) |
| `users/{uid}/sessionFeedback` | `{activityId}` ou `daily-{yyyy-MM-dd}` | RPE (1-10), feeling, motivation par séance — alimente le gouverneur de charge interne |
| `users/{uid}/workoutProposals` | `{yyyy-MM-dd}` | Proposition du jour IA : availableMinutes, proposal (sortie `dailyWorkoutRecommendation`), ride (`{location, departureDateTime}` optionnel — pour le conseil vent, voir plus bas), sentToIntervals — un doc par jour, écrasé à la régénération |
| `users/{uid}/trainingPlans` | `{planId}` | Plan structuré moyen/long terme IA : name, status (`active`/`archived` — un seul actif à la fois), eventName/eventDate, weeklyAvailableMinutes, weeks[] (phase/focus/targetWeeklyMinutes/notes par semaine, sortie `trainingPlanGeneration`, + `sampleSessions?` : séances type générées à la demande par `planWeekSessions` quand l'utilisateur déplie la semaine) — collection préexistante dans le schéma d'origine (jamais utilisée avant), réutilisée telle quelle |
| `users/{uid}/coachChatMessages` | `{messageId}` | Log plat du chat "Stella" : role (`user`/`assistant`), content, createdAt — append-only, aucune règle `update` (un message n'est jamais modifié, seulement créé ou supprimé en vidant l'historique) |
| `users/{uid}/rideAnalyses` | `{activityId}` | Analyse IA complète d'une sortie (sortie `rideAnalysis`), keyée par l'id d'activité Intervals.icu — un doc par sortie, écrasé à la régénération ("Régénérer" dans le dialogue) |
| `users/{uid}/coachLibrary` | `{entryId}` | Bibliothèque du coach : title, authors, sourceType (`etude`/`article`/`livre`/`note-coach`), url, tags[], summary, fullText (optionnel, collé ou extrait d'un PDF) — voir section "Bibliothèque du coach" plus bas |

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

## Livre de recettes (Nutrition)

Refonte complète — retour utilisateur, capture d'écran mobile : le titre d'une recette en overlay
sur la photo chevauchait les boutons Modifier/Fermer, symptôme d'un dialogue monolithique
(~280 lignes ad-hoc dans `nutrition/page.tsx`) qui n'avait jamais été pensé mobile-first. Éclaté en
`src/components/nutrition/` : `recipe-types.ts` (pur, testé — `Recipe`, `parseIngredientsText`/
`ingredientsToText`, `parseInstructionSteps`), `recipe-form-fields.tsx` (champs de formulaire
partagés), `recipe-card.tsx` (tuile grille), `recipe-add-dialog.tsx` (CrudDialogShell/useCrudSubmit,
enfin aligné sur le patron CRUD standard — ne l'était pas avant), `recipe-detail-dialog.tsx` (détail +
édition en place).

**Plus de photo stock aléatoire** (`picsum.photos/seed/{id}`, jamais une vraie photo du plat) —
`recipe-card.tsx`/`recipe-detail-dialog.tsx` affichent un badge icône (`CookingPot`) + les macros à la
place. Auto-critique assumée : une photo décorative qui ne représente jamais le vrai plat n'aide pas
un sportif qui compare des recettes par macros, et occupait ~256px de hauteur précieuse sur mobile
avant même d'atteindre le contenu utile.

**En-tête plein-écran mobile, dialogue centré desktop** (`recipe-detail-dialog.tsx`, une seule classe
responsive `CONTENT_CLASS` plutôt que deux composants) — fini les boutons Fermer/Modifier en
`position: absolute` superposés à un titre qui peut faire 4 lignes (l'origine exacte du bug rapporté :
overlay + titre long = chevauchement garanti quelle que soit la longueur). Le nouveau bandeau
Fermer/Titre/Modifier vit en flux normal (`flex items-center gap-2`), le titre tronque avec une
ellipse (`flex-1 min-w-0 truncate`) — impossible à faire chevaucher un bouton, quelle que soit la
longueur du titre.

**⚠️ Piège CSS Grid rencontré en construisant ce header** — attrapé seulement via screenshot Playwright
avant livraison (le titre semblait tronqué correctement à l'œil sur desktop, mais débordait
silencieusement du viewport sur mobile) : `DialogContent` (`ui/dialog.tsx`) est `display: grid` par
défaut. Sans un `min-w-0` explicite sur l'enfant direct (le `<div className="flex flex-col h-full">`
qui contient tout le contenu du dialogue), une grid track dimensionne sa colonne implicite sur la
largeur *max-content* de son contenu — ici le titre non tronqué — et déborde visuellement du
conteneur (390px) au lieu de forcer `truncate` à s'appliquer. Exactement la même famille de piège que
le classique `min-width: auto` des enfants flex (déjà documenté ailleurs dans ce fichier pour d'autres
composants), un niveau au-dessus : la troncature `min-w-0`/`truncate` posée sur le titre lui-même ne
suffit pas si un ANCÊTRE grid/flex intermédiaire n'a pas aussi son propre `min-w-0`. À surveiller pour
tout futur header composé à l'intérieur d'un `DialogContent`.

**Ingrédients en checklist, Préparation en étapes numérotées** — plutôt qu'une liste à puces et un
bloc de texte brut (`whitespace-pre-wrap`) : `parseInstructionSteps()` découpe le texte libre en
étapes (une par ligne si déjà saisi ainsi — le cas courant — sinon numérotation inline `"1. ... 2.
..."` détectée par regex, sinon le texte entier devient une seule étape). Les coches de la checklist
sont un état local UI seulement (pas persisté) — un outil de "mise en place" pendant la cuisson, pas
une donnée à sauvegarder. Choix pensé pour l'usage réel : mains occupées/sales en cuisine, scanner des
étapes numérotées et cocher des ingrédients est plus rapide que relire un paragraphe.

**Bug latent corrigé au passage** : les deux chemins de création de recette (`recipe-add-dialog.tsx`
et l'upsert de `import-meal-plan-dialog.tsx`) n'écrivaient jamais de champ `userId` sur le document —
or `firestore.rules` (`match /recipes/{recipeId}`) exige `hasValidOwnerField(userId)` (donc un champ
`userId` égal à l'utilisateur courant) pour autoriser un `create`. Une nouvelle recette échouait donc
silencieusement (toast d'erreur de permission) sur un compte n'ayant jamais eu ce champ. Les recettes
existantes (créées avant ce correctif, sans `userId`) restent lisibles/modifiables/supprimables sans
migration — les règles de `update`/`delete` ne comparent le champ que s'il existe déjà des deux côtés.

`DialogContent` (`ui/dialog.tsx`) accepte désormais un prop optionnel `hideDefaultClose` (défaut
`false`, donc rétrocompatible avec tous les autres dialogues de l'app) — pour un dialogue qui construit
son propre bandeau d'en-tête avec son propre bouton de fermeture (comme celui-ci), au lieu du X en
`position: absolute` du composant partagé, qui dupliquerait ou entrerait en collision avec lui.

**Ajouter une recette du livre au journal du jour, en un tap** (`recipe-quick-log.tsx`) — retour
utilisateur : "Sur la page aujourd'hui je devrais pouvoir Sélectionner une recette du livre de recette
pour qu'elle soit ajoutée à la consommation du jour. Ce n'est pas le cas aujourd'hui." Cette capacité
existait déjà (le Select "Depuis une recette" dans `LogMealDialog`/"Ajouter un repas"), mais enterrée
dans un formulaire générique où l'utilisateur ne l'a pas retrouvée — pas un bug, un problème de
découvrabilité. `RecipeQuickLog` ajoute une bande de recettes en scroll horizontal directement sur
l'onglet Aujourd'hui (entre les tuiles macros et Journal du Jour, masquée si le livre est vide) :
tap une recette → `setDoc` immédiat dans `mealLogs` avec ses macros, aucun dialogue. Le type de repas
est déduit de l'heure courante (`inferMealType()` dans `nutrition-types.ts`, pur/testé — matin→petit-
déj, midi→déjeuner, après-midi→collation, soir/nuit→dîner) plutôt que demandé à chaque tap ; une
inférence incorrecte se corrige comme n'importe quelle entrée du Journal du Jour (supprimer + re-
ajouter via le sélecteur de `LogMealDialog`, qui reste le chemin pour choisir consciemment le type de
repas ou faire une saisie libre).

## Fueling vs Workload — page détail + correctif puissance moyenne

**`FuelingWidget` renvoie vers `/nutrition/fueling`** (`src/app/nutrition/fueling/page.tsx`) — retour
utilisateur : "Vérifie les données de cette tuile, et donne accès à plus de détails en cliquant
dessus." Même convention que `KJBudgetWidget`/`GovernorWidget` (`<Link>` enveloppant toute la carte,
chevron inclus, page détail qui réaffiche le widget live — sans son propre lien pour ne pas boucler
sur soi-même — suivi d'une explication du calcul fidèle à `fueling-types.ts`).

**⚠️ Vrai bug trouvé en vérifiant les données** (pas juste un problème d'affichage) : `bestAverageWatts()`
(`src/lib/intervals-api.ts`), utilisée pour tout calcul "travail mécanique réel" (kJ ≈ kcal) —
`fueling-types.ts` (`sessionEnergyBurnedKcal`, "Brûlé" sur cette tuile) ET `load-types.ts`
(`sessionKJ`, le Budget kJ de la semaine sur Cyclisme) — préférait `icu_weighted_avg_watts` (la
puissance *normalisée*, calculée par Intervals.icu en pondérant plus lourdement les efforts intenses)
à `icu_average_watts` (la vraie moyenne arithmétique). Or la puissance normalisée est par construction
toujours ≥ la puissance moyenne sur une sortie à intensité variable (fractionné, bosses, group ride) —
donc "Brûlé" ET le Budget kJ réalisé étaient tous les deux systématiquement gonflés sur ce type de
sortie, alors que ces deux widgets existent précisément pour représenter "un travail mécanique réel,
pas un TSS pondéré arbitrairement" (voir Budget kJ plus haut) — le bug allait directement à l'encontre
de leur raison d'être. Confirmé par un second symptôme indépendant dans `use-ride-analysis.ts` : le
Variability Index (`normalizedWatts / avgWatts`) y était calculé en divisant la puissance normalisée
par... la puissance normalisée (puisque `bestAverageWatts` renvoyait déjà la normalisée), donc écrasé
vers ~1.0 quel que soit le vrai pacing de la sortie. Corrigé en inversant l'ordre de préférence
(`icu_average_watts` → `average_watts` → `icu_weighted_avg_watts` → `weighted_average_watts`, la
normalisée ne servant plus que de dernier recours quand aucune vraie moyenne n'est disponible) — un
seul correctif, partagé par les trois consommateurs (`fueling-types.ts`, `load-types.ts`,
`use-ride-analysis.ts`) puisqu'ils passent tous par ce même helper.

**Métabolisme de base (BMR) séparé du "brûlé sport"** — retour utilisateur, sur cette même tuile :
"Il faudrait d'une façon différenciée ajouter le métabolisme de base et séparer les calories brûlées
au sport." Avant ce correctif, "Brûlé" ne comptait QUE l'énergie des activités du jour — jamais le
métabolisme de base — donc l'Écart affiché n'était pas un vrai bilan énergétique quotidien (voir la
note "⚠️" déjà présente dans la page détail à l'époque). `computeBMR()` (`fueling-types.ts`, pur/testé)
calcule l'estimation via la formule de Mifflin-St Jeor (référence actuelle, plus fiable que
Harris-Benedict) à partir du poids (Intervals.icu) + taille/âge/sexe — trois champs qu'Intervals.icu
ne fournit pas, saisis manuellement via `BiometricsCard`/`use-biometrics.ts`
(`users/{uid}/settings/biometrics`, même patron que `settings/powerCurve` mais sans volet auto : rien
à fusionner puisqu'aucune source externe ne les fournit). `FuelingWidget`/la page détail affichent
désormais 4 chiffres distincts — **Sport** (activités du jour), **Métabolisme** ("à configurer" tant
que taille/âge/sexe manquent, jamais une estimation par défaut inventée), **Mangé**, **Écart** — et
l'Écart se base sur Mangé − (Sport + Métabolisme) une fois le métabolisme configuré, dégradé sur
Mangé − Sport seul sinon (comportement identique à avant ce correctif, donc non-cassant pour qui n'a
pas encore renseigné son profil biométrique). Le métabolisme est une estimation pour la journée
entière (24h de repos), jamais proratisée à l'heure actuelle — contrairement à "Sport", qui ne
reflète que les activités déjà enregistrées au moment de la consultation.

## Bibliothèque du coach

Retour utilisateur : "j'aimerais pouvoir completer le coaching avec des documents solide, des etudes,
des articles realisé par des coachs, des entraineurs et des scientifique." Nouvel onglet
**Bibliothèque** dans Coach (`coach-library-tab.tsx`, 7ᵉ sous-onglet après Mémoire coach) — l'athlète y
ajoute des sources (`users/{uid}/coachLibrary`, `AddLibraryEntryDialog`, patron CrudDialogShell/
useCrudSubmit standard) : titre, auteur(s), type (Étude scientifique/Article/Livre/Note de coach),
lien optionnel, tags, un **résumé** (obligatoire — c'est lui que le coach IA lit) et un **texte
intégral** optionnel (collé ou importé depuis un PDF).

**Seul le résumé part dans les prompts, jamais le texte intégral** — décision prise dès la
conception plutôt que corrigée après coup, sur le même principe que `trimChatHistoryForPrompt`
(coach-chat-types.ts) : le texte intégral d'une étude peut faire des dizaines de pages, l'injecter
dans chaque appel IA coach ferait exploser le coût/latence bien avant d'atteindre la dizaine de
sources. `buildLibraryContextBlock()` (`library-types.ts`, pur/testé) compose une ligne compacte par
source (titre, auteurs, type, résumé tronqué à 600 caractères, tags) sous un nouveau bloc "BASE DE
CONNAISSANCES" ajouté à `buildCoachContext()` (`coach-context.ts`) — le même bloc de contexte déjà
partagé par tous les flows coach (blessures/objectifs/style de vie/faits retenus/gouverneur/budget
kJ, voir plus haut). Le texte intégral reste consultable (repliable) dans l'onglet Bibliothèque
lui-même, pour l'athlète qui veut relire la source — jamais transmis à Claude automatiquement.

**Tous les flows coach existants bénéficient de la bibliothèque sans changement de leur propre
code** — `references: LibraryEntryLike[]` est un champ optionnel de `CoachContextInput`, et les 6
hooks qui appellent déjà `buildCoachContext` (`use-daily-workout.ts`, `use-coach-chat.ts`,
`use-training-plan.ts` ×2, `recovery-insight-panel.tsx`, `use-ride-analysis.ts`) ont chacun été mis à
jour pour appeler `useCoachLibrary()` à côté de `useCoachMemory()` et passer `references:
library.entries` — la Proposition du jour, le Plan, Stella, l'analyse de récupération et l'analyse de
sortie peuvent donc toutes citer une source ajoutée par l'athlète quand elle est pertinente au sujet.
Le prompt instruit explicitement le modèle de ne jamais inventer une source qui ne s'applique pas.

**Import PDF côté serveur** (`/api/library/extract-pdf`, `pdf-parse@1.1.1`) — retour utilisateur :
"les deux selon le document" (résumé rédigé à la main OU texte complet collé/importé), donc les deux
chemins alimentent le même champ `fullText`. Extraction côté serveur plutôt que client
(`pdfjs-dist` + worker/canvas dans le navigateur est une source connue de galères de build avec
Next.js/webpack) — un simple `POST multipart/form-data` vers une Route Handler qui tourne
`pdf-parse` sur le buffer et renvoie le texte brut. Plafonné à 15 Mo (vérifié côté client ET côté
serveur — un contrôle client seul n'est jamais une vraie garantie).

**⚠️ Piège `pdf-parse` rencontré en buildant cette route, seulement visible via `next build`** :
importer le paquet normalement (`import pdfParse from 'pdf-parse'`) faisait échouer le build
entier avec `ENOENT ... ./test/data/05-versions-space.pdf` — le propre `index.js` du paquet lance un
auto-test (`if (!module.parent) { ...lit un PDF d'exemple... }`) censé ne s'exécuter que si le module
est lancé directement (`node index.js`), pas importé. Mais dans un bundle de Route Handler Next.js,
chaque route est son propre point d'entrée webpack, sans chaîne CJS `parent` traditionnelle — donc
`module.parent` y est toujours faux, et l'auto-test se déclenche à chaque fois. `tsc --noEmit`/le dev
server ne montrent rien (comme les deux pièges `'use server'`/`allowedOrigins` déjà documentés plus
haut) : seul `next build` l'attrape, en essayant de collecter les données de la page. Corrigé en
important directement l'implémentation interne (`pdf-parse/lib/pdf-parse.js`, qui n'a pas cet
auto-test) plutôt que le point d'entrée du paquet — nécessite sa propre déclaration de types
(`src/types/pdf-parse-lib.d.ts`, `@types/pdf-parse` ne couvre que le point d'entrée public).

**Sécurité** : `/api/library/extract-pdf` n'est pas authentifiée, même posture assumée que les
proxies `/api/intervals/*` (voir section sécurité plus haut) — cette app n'a nulle part de Firebase
Admin SDK côté serveur pour vérifier un token. Cette route ne lit ni n'écrit jamais Firestore (aucune
donnée utilisateur en jeu), donc le risque se limite à un abus de CPU/bande passante, borné par la
limite de 15 Mo.

## Flows IA (Claude)

Les flows sont dans `src/ai/flows/` et s'appellent côté client via des Server Actions Next.js
(fonctions `'use server'` important directement, pas d'abstraction Genkit). Chaque flow appelle
`@anthropic-ai/sdk` via le client partagé `src/ai/anthropic.ts` (modèle `claude-haiku-4-5`,
suffisant et peu coûteux pour ces usages perso). Le helper `generateJson(schema, { system, messages })`
demande une réponse JSON pure à Claude et la valide avec Zod — pattern uniforme utilisé par 6 des
7 flows (tous sauf `coachChat`, texte brut) plutôt que `output_config.format`.

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

`buildCoachContext` (`src/components/cycling/coach-context.ts`) — le bloc de contexte partagé par tous
les flows coach (blessures/objectifs/style de vie/faits retenus/gouverneur/budget kJ) — inclut désormais
`today` en premier champ obligatoire, rendu en tête du contexte (`AUJOURD'HUI : ...`) et utilisé pour
annoter chaque objectif de son délai (`dans N jours`/`il y a N jours`/`aujourd'hui`). Absent jusqu'ici :
aucun flow n'avait de référence fiable à la date du jour pour un raisonnement relatif ("dans combien de
temps ?"), Stella y compris — retour utilisateur. Tout appelant passe `today: format(new Date(), 'yyyy-MM-dd')`.

`fetchWeatherForecast`/`degreesToCompass` (`src/ai/weather.ts`) sont le fetch météo
réel (Open-Meteo, sans clé API) partagé par `cyclingOutfitRecommendation` et `dailyWorkoutRecommendation`
— dans les deux cas un pré-fetch déterministe fait par le flow lui-même, jamais une décision (ni même
un tool use optionnel) laissée au modèle. `cyclingOutfitRecommendation` utilisait à l'origine le tool
use de Claude pour la météo (`get_weather_forecast`, `tool_choice` par défaut donc pas garanti d'être
appelé) — retour utilisateur : ça pouvait laisser le modèle deviner une météo plausible plutôt que la
vraie, et l'onglet Météo & Tenue l'affichait alors comme "estimation basée sur des données historiques"
alors que le fetch réel, quand il avait bien lieu, donnait déjà une vraie prévision. Réécrit pour suivre
le même principe que `dailyWorkoutRecommendation` : le fetch est inconditionnel, avant même d'appeler
Claude, qui ne fait plus que rédiger un court bulletin à partir des chiffres réels fournis (jamais
inventés) et choisir la tenue.

### Flow existant : `cyclingOutfitRecommendation`
- Input : `{ location, dateTime, durationHours, clothingInventory[] }`
- Output : `{ predictedWeather (dont windDirectionCompass), recommendation, recommendedItems[] }`
- Usage : `src/components/coach/weather-outfit-tab.tsx` (sous-onglet "Météo & Tenue" de Coach — ex-page `/weather`, qui redirige maintenant vers `/coach`)
- `predictedWeather.temperatureCelsius`/`windSpeedKmh`/`conditions` viennent du fetch réel, pas de Claude
  — le flow échoue (`FlowResult` en erreur) plutôt que de continuer si `fetchWeatherForecast` échoue
  (lieu introuvable, API indisponible), au lieu de laisser l'UI afficher une météo inventée.

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
- Input : `{ date, availableMinutes, sportType?, training?, recentSessions[], planWeek?, plannedSession?, recovery?, coachContext?, ride? }`
  — `recovery` (sleepHours/sleepQuality/hrv/readiness) vient de la même série fusionnée auto-sync Intervals.icu +
  saisie manuelle que Vie & Santé (`useLifestyleData`) : une mauvaise nuit doit réduire l'intensité proposée
  même si la charge d'entraînement suggérerait autre chose — la récupération prime en cas de tension.
  `ride` (`{location, departureDateTime}`, optionnel, saisi dans l'onglet) déclenche un fetch météo réel
  (`fetchWeatherForecast` dans `src/ai/weather.ts`, partagé avec `cyclingOutfitRecommendation`) — échoue en
  silence (pas de section météo dans le prompt) plutôt que de casser toute la génération si le lieu n'est pas
  géocodable. `plannedSession` (`{title, sportType, durationMinutes, structuredWorkout}`, optionnel — voir
  "Plan d'entraînement — figé par jour" plus haut) : la séance CONCRÈTE que le plan a déjà datée pour
  aujourd'hui, quand une existe — le flow doit alors l'ajuster plutôt que d'en composer une nouvelle.
- Output : `{ title, sportType, durationMinutes, intensityLabel, rationale, structuredWorkout, warnings[],
  adjustedFromPlan, planAdjustmentNote, windAdvice, predictedWeather, weatherAlert }` — `adjustedFromPlan`
  (bool) et `planAdjustmentNote` (string ou null, "Aucun ajustement nécessaire" si la séance planifiée a été
  gardée telle quelle) reflètent si `plannedSession` était fourni ; `structuredWorkout` est le script texte du "workout builder"
  Intervals.icu que le site parse lui-même : en-têtes de section (optionnellement suffixés `Nx` pour une
  répétition) suivis de lignes `- <durée> <cible%>`. Le format inline `Nx (étape / étape)` n'est PAS reconnu
  par le parseur — voir le prompt du flow. `windAdvice` (string ou null) : conseil de direction générale au
  départ pour avoir le vent dans le dos au retour, rempli seulement quand `ride` est fourni ET que le vent
  prévu dépasse 15 km/h (seuil codé en dur, pas laissé à l'appréciation du modèle) — sinon `null`, jamais un
  conseil inventé sans signal réel.
- **`predictedWeather`/`weatherAlert` + bascule home trainer** — retour utilisateur : "s'assurer que la météo
  fonctionne de la même façon que dans météo et tenue, de plus si le temps est vraiment dégradée... l'IA
  pourrait proposer une alternative adaptée pour home trainer". Avant ce correctif, ce flow utilisait déjà la
  météo réelle en interne (pour `windAdvice`) mais ne l'exposait jamais en sortie structurée — contrairement à
  `cyclingOutfitRecommendation` dont `predictedWeather` est un vrai objet `{temperatureCelsius, windSpeedKmh,
  windDirectionCompass, conditions}`. `predictedWeather` (même forme, nullable — absent quand aucun `ride`
  n'a été fourni ou que le fetch a échoué) est maintenant inliné en JSON littéral dans le prompt (même
  technique que `cyclingOutfitRecommendation` pour `predictedWeather` : le modèle ne fait que le recopier,
  jamais générer ces chiffres) et affiché comme un bandeau compact (température/vent/conditions) dans
  `daily-workout-tab.tsx`, sous la même donnée réelle que Météo & Tenue plutôt que buriée dans une phrase de
  `rationale`. `isSevereWeather()` (`src/ai/weather.ts`, pur/testé) — vent ≥ `SEVERE_WIND_THRESHOLD_KMH`
  (40 km/h) OU code météo Open-Meteo de pluie/neige forte ou orage (`weatherCode`, ajouté à `WeatherForecast`
  pour ne pas dépendre du texte `conditions`, qui peut changer) — décide de façon déterministe si la sortie
  est trop dégradée, jamais laissé à l'appréciation du modèle (même principe que le seuil de `windAdvice`) :
  le flow lit ce verdict et, si vrai, instruit explicitement le modèle de proposer une séance équivalente en
  `sportType: "VirtualRide"` plutôt qu'une sortie extérieure, remplit `weatherAlert` (string ou null) avec la
  justification citant les vrais chiffres, et force `windAdvice` à `null` (pas de sens pour une séance
  indoor). `weatherAlert` s'affiche dans un bandeau distinct (couleur destructive) des warnings jaunes
  génériques, pour rester visible comme le changement structurel qu'il est plutôt qu'un simple point
  d'attention.
- Usage : `src/components/cycling/daily-workout-tab.tsx` (sous-onglet "Aujourd'hui" de Coach — onglet
  par défaut ; Proposition du jour y a fusionné, voir "Page Coach restructurée" et "Aujourd'hui et
  Plan redéfusionnés" plus haut)
- Réutilise `buildCoachContext` (blessures/objectifs/style de vie/faits retenus/gouverneur/budget kJ) comme
  `recoveryInsight`, plus le CTL/ATL/TSB courant et les séances des 7 derniers jours (`summarizeRecentSessions`
  dans `daily-workout-types.ts`). L'utilisateur peut éditer le titre/durée/script avant envoi. Poussée sur le
  calendrier Intervals.icu via `IntervalsService.createPlannedWorkout()` → `POST /api/intervals/events`
  (`upsertOnUid=true` : ré-envoyer la même journée met à jour l'événement au lieu de le dupliquer) — avec
  `dailyWorkoutExternalId` par défaut, ou `planSessionExternalId` (le MÊME externalId que la séance du Plan)
  quand `adjustedFromPlan` est vrai, voir "Plan d'entraînement — figé par jour" plus haut. Stocké dans
  `users/{uid}/workoutProposals/{yyyy-MM-dd}` (y compris `ride`/`planSessionRef`, pour préremplir la
  réouverture de l'onglet et pour que l'envoi réutilise le bon externalId).
- Si un plan d'entraînement actif existe (voir `trainingPlanGeneration` ci-dessous), reçoit en plus
  `planWeek` (phase/focus/volume cible de la semaine en cours, via `currentPlanWeek` dans
  `training-plan-types.ts`) et, si le plan a daté une séance CYCLING précise pour aujourd'hui,
  `plannedSession` (voir ci-dessus) — une séance MUSCULATION planifiée aujourd'hui court-circuite
  entièrement ce flow côté UI plutôt que de lui être transmise (cycling-only, voir plus haut).

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

### Flow existant : `rideAnalysis`
- Input : `{ activity (nom/type/date/distance/durée/watts moyens+normalisés/VI/FC/cadence/dénivelé/
  charge/intensité/RPE/feel), powerZones?, hrZones?, split?, athlete? (ftp/ctl/atl/tsb), coachContext? }`
  — retour utilisateur : "Crois-tu possible que ... on puisse demander une analyse complète de la
  sortie basée sur les différentes data d'intervals ?". `getActivity()`/`getActivityStreams()`
  existaient déjà sur `IntervalsService` (`src/lib/intervals-api.ts`) mais n'étaient utilisés nulle
  part — ce flow est leur premier vrai consommateur, via la nouvelle route
  `/api/intervals/activities/[id]` (mêmes en-têtes `x-intervals-athlete-id`/`x-intervals-api-key`
  que le reste des routes proxy). Les streams bruts (watts/FC/cadence, un point par seconde) sont
  beaucoup trop volumineux et peu exploitables tels quels pour un prompt — `ride-analysis-types.ts`
  (`src/components/coach/`, pur, pas `'use server'` — voir l'avertissement ci-dessous) les réduit
  côté client en quelques chiffres réels avant l'appel : puissance normalisée (algorithme de Coggan,
  moyenne glissante 30s puis moyenne quadratique⁴ puis racine⁴), répartition du temps par zone de
  puissance (7 zones Coggan, % de la FTP) et par zone de FC (5 zones, % de la FC max *de cette
  sortie* — l'app n'expose pas encore de FC max physiologique séparée), et une analyse de pacing
  (négative/positive split, 1ère vs 2e moitié de la sortie).
  `getActivityStreams()` échoue de façon non-fatale pour certaines sorties synchronisées depuis
  Strava — confirmé en prod, Intervals.icu lui-même ne parvient pas toujours à relire le détail
  seconde par seconde depuis l'API Strava ("Cannot read Strava activity API", une limite côté
  Intervals.icu, pas un problème de forme de requête côté app). La route `/api/intervals/activities/
  [id]` dégrade alors vers `streams: null` plutôt que de faire échouer toute la requête — l'analyse
  tourne quand même sur les données globales déjà récupérées via `getActivity()` (puissance
  moyenne, charge, durée, RPE...), simplement sans le détail par zones/pacing, et `use-ride-
  analysis.ts` prévient l'utilisateur d'un toast informatif (pas une erreur) plutôt que de faire
  échouer toute l'analyse.
- Output : `{ headline, summary, strengths[], improvementAreas[], effortContext, recommendation }`
- Usage : `RideAnalysisDialog`/`RideAnalysisTrigger` (`src/components/coach/ride-analysis-dialog.tsx`),
  un bouton par ligne dans le Journal d'activités (`rides-journal-tab.tsx`, onglet "Sorties" de
  Coach) — glue dans `use-ride-analysis.ts`. Stocké dans `users/{uid}/rideAnalyses/{activityId}`
  (un doc par sortie, écrasé au clic "Régénérer"), donc consulté sans re-générer une fois produit.
- **Volontairement pas exposé comme outil Stella** (contrairement à `update_goal`/`add_goal`/
  `add_remembered_fact`/`update_injury_status`) — même principe que pour la génération de séance/plan
  dans le chat (voir `coachChat` ci-dessous) : dupliquer un chemin de génération avec son propre
  format en dehors de l'onglet dédié introduirait une deuxième façon de produire la même chose,
  potentiellement incohérente. Si l'utilisateur demande une analyse de sortie à Stella, la réponse
  attendue est de renvoyer vers Sorties plutôt que de générer une analyse dans le chat.

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
- Input : `{ messages[] (role user/assistant, historique complet dont le nouveau message), coachContext?,
  training?, planWeek?, recovery?, availableGoals? (id + champs, pour cibler update_goal),
  availableInjuries? (id + champs, pour cibler update_injury_status), pendingToolRound? (voir plus bas) }`
- Output : `FlowResult<CoachChatOutput>` où `CoachChatOutput` est soit `{ type: 'text', text }`, soit
  `{ type: 'tool_use', assistantContent, calls[] }` — **seul flow de l'app qui ne répond pas en JSON pour
  sa branche texte** (`generateJson` ne s'applique pas à une conversation libre ; appelle directement
  `anthropic.messages.create`), mais avec `tools` déclarés comme n'importe quel flow à tool use.
- Usage : `src/components/cycling/stella-chat-tab.tsx` (sous-onglet "Stella" de Coach), glue dans
  `use-coach-chat.ts`.
- Persona conversationnelle réutilisant le même `buildCoachContext` + CTL/ATL/TSB + semaine de plan en
  cours que les autres flows coach — pas une mémoire séparée. Reste volontairement consultative pour tout
  ce qui est précision-critique : le prompt système interdit à Stella de générer elle-même une séance
  structurée ou un plan (elle renvoie vers les onglets dédiés) pour ne pas dupliquer un chemin de
  génération avec un format à respecter en dehors du flow prévu pour ça.
- **Peut en revanche réellement écrire dans la mémoire coach** via 4 tools (`update_goal`, `add_goal`,
  `add_remembered_fact`, `update_injury_status`) — retour utilisateur : Stella devait pouvoir appliquer ce
  qu'on lui demande ("mets à jour mon objectif", "note que...") plutôt que seulement en discuter. Aucun
  outil de suppression n'est exposé (une blessure/un objectif supprimé par erreur via une phrase ambiguë
  serait pénible à récupérer) — ça reste une action de l'onglet Mémoire coach. Le flow lui-même ne peut PAS
  écrire dans Firestore (aucun client Firestore authentifié côté serveur, voir Authentification) : un appel
  d'outil revient donc au client comme `{type:'tool_use', ...}` plutôt que d'être exécuté ici ;
  `executeToolCall()` dans `use-coach-chat.ts` fait l'écriture réelle (mêmes patterns setDoc/updateDoc/
  arrayUnion que `coach-memory-tab.tsx`), puis rappelle `coachChat` avec `pendingToolRound` (le tour
  assistant échoué tel quel + le résultat de l'outil) pour obtenir la confirmation en langage naturel —
  boucle plafonnée à 4 tours. Un toast confirme chaque écriture réussie en plus de la réponse de Stella.
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
- Après connexion (email/password et Google, login et inscription) : redirect vers `/cycling` —
  retour utilisateur : l'app doit toujours ouvrir sur Cyclisme, la page données. Anciennement
  `/home-management`, changé aux 4 points d'entrée (`login/page.tsx` ×2, `register/page.tsx` ×2).
- **Mot de passe oublié** (`login/page.tsx`) : le lien "Oublié ?" pointait vers un `href="#"` mort —
  remplacé par `sendPasswordResetEmail()` (Firebase Auth) sur le champ email déjà saisi. Message de
  confirmation volontairement identique que l'adresse existe ou non (comme le message d'erreur
  générique "Email ou mot de passe incorrect" déjà en place sur l'échec de connexion) — ce formulaire
  ne doit jamais confirmer à un visiteur qu'une adresse donnée a un compte sur l'app.
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

### Sécurité & protection des données — audit

Retour utilisateur : "assurer... de la sécurité et de la protection des données". `firestore.rules`
suit un modèle "path-based ownership" strict (tout sous `/users/{userId}/...`, `isOwner()` compare
`request.auth.uid` au segment de path, aucune règle `list`/`get` publique, refus implicite par
défaut) — relu intégralement, sain. Deux trouvailles concrètes corrigées :

**⚠️ `deleteAllUserData()`/l'export personnel oubliaient près de la moitié des collections réelles**
(`src/lib/account-deletion.ts`, `TOP_LEVEL_COLLECTIONS` — réexporté tel quel par
`data-export-types.ts` comme unique source de vérité pour les deux usages, donc un seul tableau à
corriger). La liste avait dérivé de la vraie structure Firestore au fil des ajouts de collections :
manquaient `settings`, `coachMemory`, `chains`/`waxHistory`, `coachInjuries`, `coachGoals`,
`sessionFeedback`, `rideAnalyses`, `mealPlans`/`meals`, `mealLogs`, `hydrationLogs` — dont plusieurs
contiennent des données personnelles sensibles (blessures, notes de style de vie, taille/âge/sexe
dans `settings/biometrics`). "Supprimer mon compte" laissait donc cette moitié des données
orpheline dans Firestore plutôt que de l'effacer, et l'export personnel (RGPD-style) ne les incluait
pas non plus. Bug structurel additionnel trouvé au passage : `components` (matériel installé sur un
vélo) était listé comme sous-collection de `bikes/{bikeId}`, alors que c'est — per le commentaire de
`firestore.rules` lui-même — une collection top-level à plat (`users/{uid}/components` avec un champ
`bikeId`) ; la suppression balayait donc un chemin où rien n'avait jamais rien écrit. `SETTINGS_DOCS`
(liste à la main de 3 docs `settings/*` sur les 7 réels) a été remplacé par un balayage générique de
toute la collection `settings` — un `getDocs()` sur la collection trouve n'importe quel id de
document existant, fixe ou non ; ce mécanisme ne peut plus dériver silencieusement à chaque nouveau
doc `settings/*` ajouté ailleurs (exactement comme ça s'est produit ici). Un test de non-régression
(`data-export-types.test.ts`) recroise désormais `TOP_LEVEL_COLLECTIONS` contre la liste complète
attendue depuis `firestore.rules`.

**Route de debug oubliée en production** : `/api/intervals/debug` (dump brut des réponses
Intervals.icu — athlète, wellness, historique complet, courbe de puissance — pour diagnostiquer les
bugs déjà documentés plus haut dans ce fichier) n'avait jamais été supprimée après usage, contrairement
à `/api/debug/anthropic`/`/debug-headers` (retirées une fois leur diagnostic confirmé, comme documenté
ailleurs dans ce fichier). Aucun appelant dans le code — supprimée. Sévérité limitée (elle exige déjà
les identifiants Intervals.icu de l'appelant, comme les routes légitimes) mais surface d'attaque et
incohérence avec la pratique du projet, sans aucune raison de la garder.

**⚠️ Risque architectural identifié, non corrigé consciemment** : les routes `/api/intervals/*`
(proxy vers Intervals.icu) ne vérifient qu'un header `x-intervals-athlete-id`/`x-intervals-api-key`
fourni par l'appelant — aucune vérification d'un token Firebase Auth. N'importe qui peut donc
appeler ces routes directement (sans être un utilisateur connecté de l'app) s'il possède déjà des
identifiants Intervals.icu valides — pour n'importe quel athlète, pas nécessairement un utilisateur
de LifeCycle. Ça n'expose aucune donnée Firestore d'un utilisateur LifeCycle (les règles Firestore
restent intactes et sont le vrai périmètre de protection des données de cette app) et ça n'élève pas
l'accès de quelqu'un qui possède déjà ces identifiants (il pourrait interroger Intervals.icu
directement de toute façon) — mais ça permet d'utiliser le backend de l'app comme relais ouvert vers
l'API Intervals.icu pour des identifiants tiers, un risque d'abus de ressources/coût plutôt qu'une
brèche de données. Corriger proprement demanderait le Firebase Admin SDK côté serveur pour vérifier
un ID token — une architecture que cette app évite délibérément partout ailleurs (voir plus haut,
"Authentification" : Firestore n'est lu que côté client, aucun accès Admin côté serveur). Non
implémenté cette nuit : un changement de cette ampleur, fait sans pouvoir le tester contre un vrai
projet Firebase, risquait de casser l'intégration Intervals.icu entière sans supervision pour le
corriger — jugé pire que documenter le risque honnêtement pour une décision consciente plus tard.

## Landing page (`src/app/page.tsx`)

Retour utilisateur : "revoir le site pour mettre en avant toutes les fonctions de l'application,
avec des screenshoots exemple etc." La grille de 6 icônes génériques (Performance/Fueling/Maison/
Météo AI/Santé/Finances, `desc` en une phrase abstraite, aucun visuel) est remplacée par une vitrine
module par module — 5 sections alternées gauche/droite (`modules: ShowcaseModule[]`, une par item de
`navItems` : Cyclisme, Coach IA, Nutrition, Garage, Maison), chacune avec un titre orienté bénéfice,
3 points concrets ancrés dans de vraies fonctionnalités (pas de marketing vague) et un vrai aperçu
visuel de l'écran correspondant.

**Captures dans `public/screenshots/*.png`** — pas des captures d'un vrai compte utilisateur (aucun
compte de démo n'existe), mais des mockups composés à partir des **vrais composants** de l'app
(`RingGauge`, `RecipeCard`) stylés avec les vraies classes du design system (`lc-card`, tokens de
couleur, `font-data`) et des données d'exemple plausibles — jamais présentés nulle part comme
appartenant à un utilisateur réel. Générées via une page temporaire `src/app/preview-recipe/page.tsx`
(supprimée après capture Playwright — voir la technique de screenshot ailleurs dans ce fichier pour
la doc du binaire `headless_shell` à utiliser), affichant 5 panneaux `id="shot-*"` capturés
individuellement (`page.$(selector).screenshot()`) plutôt qu'un screenshot pleine page, pour un
recadrage propre par module. Si ces visuels doivent être régénérés un jour (nouveau module, refonte
visuelle), recréer une page jetable du même type plutôt que de committer un compte de démo réel.

Rendues via `next/image` (`width`/`imageH` = dimensions intrinsèques réelles du PNG, pas de valeur
arbitraire — Next.js s'en sert pour réserver l'espace et éviter un layout shift). Alternance
gauche/droite obtenue avec `[direction:rtl]`/`[direction:ltr]` sur la grid (pas de réordonnancement
`order-*` : le DOM garde l'ordre texte-puis-image partout, seul l'effet visuel alterne).

Section CTA finale : ajout d'une ligne de réassurance data-protection (`Lock` icon, "chiffrées en
transit, isolées par compte, exportables et supprimables à tout moment") — directement lié à l'audit
sécurité ci-dessus (export/suppression de compte existent réellement, voir Réglages), pas une
promesse en l'air.

## Commandes

```bash
npm run dev          # Serveur Next.js dev (port 9002, Turbopack)
npm run build        # Build production
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test          # Vitest (tests unitaires)
```

## Règles de développement

1. **Langue** : code en anglais. UI historiquement en français en dur — chantier multilangue en cours
   (voir section "Internationalisation (i18n)" plus haut) : tout nouveau texte UI dans une page/un
   composant déjà migré doit passer par `useTranslations()`, pas être écrit en dur ; un texte dans une
   page pas encore migrée peut rester en français en dur pour l'instant (cohérent avec le reste de
   cette page), à extraire quand elle sera migrée
2. **"use client"** : obligatoire sur toutes les pages et composants avec hooks
3. **Imports Firebase** : toujours depuis `@/firebase` (pas directement firebase/*)
4. **Mutations** : utiliser le pattern errorEmitter pour les erreurs Firestore
5. **Nouveau module** : page dans `src/app/<route>/page.tsx` (return enveloppé dans `AuthGuard`,
   voir Authentification ci-dessus) + entrée dans `navItems` de sidebar.tsx
6. **Dates** : utiliser `date-fns` avec `import { fr } from 'date-fns/locale'`
7. **Images externes** : `picsum.photos` autorisé dans next.config.ts
