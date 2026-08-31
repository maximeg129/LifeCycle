# Audit — module cyclisme/coach vs. base scientifique

**Date :** 31 août 2026
**Sources d'autorité :** `01_Base_Scientifique_Cyclisme.md` (35 références `Rxx`), `02_Specification_Coach_LifeHub.md`.
**Périmètre inspecté :** `src/components/cycling/`, `src/ai/flows/*.ts`, `src/lib/intervals-api.ts`, `src/components/lifestyle/`, `src/components/nutrition/fueling-types.ts`, `src/components/coach/`, `firestore.rules`, `apphosting.yaml`, `package.json`, `docs/blueprint.md`, `docs/backend.json`.
**Méthode :** lecture directe du code (pas de recherche par mots-clés seule) pour chaque module cité dans la spécification, plus `grep` exhaustif pour les vérifications ponctuelles demandées.

---

## 0. Constat en tête — vérification exposant Riegel 1,06 (demandée explicitement)

**Absent du code.** `grep -rn "1\.06\|1,06"` sur tout `src/` ne retourne que deux faux positifs sans rapport (des coordonnées de tracé SVG du logo Google dans `login/page.tsx`/`register/page.tsx`). Aucune occurrence dans le domaine cyclisme.

Le fichier `src/components/cycling/riegel-types.ts` n'utilise d'ailleurs **aucune constante fixe** : `fitPowerDurationCurve()` calibre un exposant `e` propre à l'athlète par régression log-log sur ses 3 records personnels (court/moyen/long), puis expose `enduranceIndex = 1 - e`. C'est structurellement l'approche que R13 recommande (calibration individuelle plutôt que constante universelle), pas l'erreur R12 documentée.

**Mais deux garde-fous de la spécification manquent sur ce module existant, à corriger malgré l'absence du bug principal :**
- Aucune vérification de la plage de validité 3,5–230 min (R12) — `computeTTE()` accepte n'importe quelle puissance cible sans avertir si le résultat sort de cette plage.
- Aucun avertissement affiché à l'utilisateur quand l'ajustement est fait sur seulement 2 records au lieu de 3 (le code l'accepte silencieusement dès que `valid.length >= 2`).

**Un autre problème de fond, du même ordre de gravité que l'aurait été le 1,06, existe ailleurs et est actuellement en production — voir §1 ci-dessous.**

---

## 1. Violations actives des principes 1 et 8 déjà en production

Ce ne sont pas des lacunes (fonctionnalité manquante) mais des **comportements shippés qui contredisent frontalement** un principe non négociable ou une affirmation explicitement interdite. À traiter avec la même priorité que le point 0.

### 1.1 — LED de tendance HRV jour/veille (violation directe de R25 + section 8)

`src/components/lifestyle/lifestyle-types.ts`, fonction `vitalTrend()` :
```ts
export function vitalTrend(current, previous, direction: 'lower-better' | 'higher-better'): VitalTrend | null {
  if (current == null || previous == null) return null
  if (current === previous) return 'neutral'
  const improved = direction === 'lower-better' ? current < previous : current > previous
  return improved ? 'good' : 'bad'
}
```
Appelée avec `direction: 'higher-better'` pour le HRV dans `performance-bento.tsx` (`StatChip` de la tuile HRV, comparaison **un seul jour vs le jour précédent**, jamais une moyenne 7 j vs baseline). Le résultat pilote une LED verte/rouge affichée directement à l'utilisateur.

C'est exactement l'affirmation interdite en toutes lettres section 8 : *« Qu'une baisse de HRV signifie fatigue et une hausse fraîcheur »* — et une violation du principe 2 (*« Jamais de décision sur une valeur isolée »*) et du principe 3 (*« Le signe d'une variation de HRV est ambigu... Le HRV ne décide jamais seul »*, R25). Contrairement au point 0, ce n'est pas une absence de bug — c'est une fonctionnalité qui code activement l'erreur.

La FC repos utilise la même fonction (`direction: 'lower-better'`) — R25 ne documente pas la FC repos comme ambiguë de la même façon, donc cette partie-là n'est probablement pas à retirer, seulement la HRV.

### 1.2 — Zones TSB avec labels de confiance ("Optimal", "Risque élevé")

`src/components/cycling/tsb-zones.ts` classe le TSB en 5 bandes avec des libellés affichés tels quels sur la tuile Vue d'ensemble et la page détail : *Transition, Frais, Zone grise, **Optimal**, **Risque élevé***, chacune avec une couleur et une description ("Charge productive — la zone visée pour progresser").

Contredit directement section 8 : *« Qu'un TSB donné correspond à un état de forme optimal universel. R03 »*. Le texte de `metric-info.ts` pour TSB est lui plutôt prudent ("Ce n'est pas un chiffre à optimiser en permanence") — la contradiction est spécifiquement dans `tsb-zones.ts`, pas dans l'explication pédagogique.

### 1.3 — CTL affiché comme nombre absolu, sans le disclaimer R03

`performance-bento.tsx` affiche un `MetricTile` "CTL" avec la valeur brute en gros caractères. `metric-info.ts` dit *"C'est le meilleur indicateur du volume/intensité que le corps peut absorber"* sans la réserve R03 : *« Les adaptations successives du modèle ont produit des formes mathématiques à 1, 2 voire 3 paramètres k : la valeur d'un paramètre n'a donc pas de signification univoque »*. Spec section 3.1 : *« À afficher : la trajectoire, pas le nombre absolu »* — actuellement seul le nombre absolu est mis en avant (tuile + page détail avec courbe, mais le nombre reste l'élément visuellement dominant).

---

## 2. Architecture actuelle de l'appel au modèle — écart au "point d'entrée unique"

**Aucun assembleur de prompt partagé n'existe.** Il y a 7 fichiers de flow dans `src/ai/flows/`, chacun construisant sa propre chaîne de system prompt en dur, inline :

| Flow | Construit son prompt comment | Passe par |
|---|---|---|
| `dailyWorkoutRecommendation` | template string inline | `generateJson()` |
| `cyclingOutfitRecommendation` | template string inline | `generateJson()` |
| `recoveryInsight` | template string inline | `generateJson()` |
| `trainingPlanGeneration` | template string inline | `generateJson()` |
| `planWeekSessions` | template string inline | `generateJson()` |
| `rideAnalysis` | template string inline | `generateJson()` |
| `identifyPlant` | template string inline | `generateJson()` |
| `coachChat` (Stella) | template string inline | **appel direct** `anthropic.messages.create()`, pas `generateJson()` |

`generateJson()` (`src/ai/anthropic.ts`) est un utilitaire d'appel + validation JSON (retry de parsing, `FlowResult`), **pas** un assembleur de prompt — il reçoit `system` déjà construit par l'appelant et ne connaît rien de la base scientifique. Il y a donc aujourd'hui **deux points d'entrée distincts vers l'API Anthropic** (`generateJson` et l'appel direct de `coach-chat-flow.ts`), et **sept endroits différents** où le texte du system prompt est écrit à la main — le contraire exact de "un seul point d'entrée" et "aucun chemin de code ne doit permettre d'appeler le modèle sans passer par l'assembleur".

Aucune version de prompt, aucun hash, aucune journalisation de version n'existe. Chaque flow a son propre schéma Zod de sortie ad hoc (`DailyWorkoutRecommendationOutputSchema`, etc.) — pas de contrat unifié `{verdict, summary, recommendation, reasons, uncertainty}`.

**Ce qui fonctionne déjà et va dans le bon sens :** tous ces flows sont des fichiers `'use server'` (Server Actions Next.js) — ils s'exécutent uniquement côté serveur (Cloud Run, via Firebase App Hosting), le client ne reçoit jamais le texte du system prompt ni la clé API (`ANTHROPIC_API_KEY` en secret Firebase, référencée dans `apphosting.yaml`, jamais exposée côté client — confirmé, aucune variable `NEXT_PUBLIC_*` ne la porte). La propriété de sécurité "le client ne peut pas contourner l'assembleur" est donc déjà largement acquise par construction — ce qui manque, c'est la **centralisation** en un seul assembleur versionné, pas l'exécution côté serveur elle-même. Voir §5 pour la question d'architecture Cloud Functions vs Server Actions.

---

## 3. Module par module vs. spécification

### 3.1 Fitness/Fatigue/Forme (R01–R04)
CTL/ATL sont **entièrement délégués à Intervals.icu** (`icu_ctl`/`icu_atl` lus tels quels via l'API proxy, `src/lib/intervals-api.ts`) ; TSB est recalculé localement en `ctl - atl`. **Aucun modèle impulsion-réponse n'est codé dans cette app** — contrairement à ce que suppose la spec (`impulseResponse.ts`, constantes `τ₁/τ₂/k₁/k₂` étiquetées convention). Les constantes 42j/7j ne sont même pas des paramètres visibles dans le code de LifeCycle : elles vivent dans le calcul propriétaire d'Intervals.icu, hors de portée d'audit. C'est un écart architectural plus large que "mauvaises constantes" : il faudra décider si le module `impulseResponse.ts` recalcule un vrai IR en interne (à partir des séries d'activités déjà disponibles) pour reprendre la main sur les constantes, ou si l'app continue de consommer le nombre d'Intervals.icu en l'étiquetant honnêtement comme tel (pas comme "calculé par LifeCycle").
Violations actives : voir §1.2, §1.3.

### 3.2 Budget kJ hebdomadaire (R09, R10, R11)
`src/components/cycling/load-types.ts` : `sessionKJ()` = `watts_moyens × durée_s / 1000`, agrégé en **kJ bruts hebdomadaires**, jamais en kJ/kg, jamais pondéré par intensité. `computeTargetKJ()` applique une règle `+8 %` (gouverneur vert) / `-12 %` (rouge) / plateau sinon sur une baseline 8 semaines — c'est une heuristique produit sans lien avec les seuils R08/R10/R11 (10/20/30/40 kJ/kg).
**Contradiction directe** avec section 3.2 ("Unité : kJ/kg, jamais kJ bruts, pondérée par l'intensité") et avec l'affirmation interdite section 8 ("Qu'un budget kJ non pondéré reflète la fatigue accumulée. R09"). Ce widget existe et est visible en page Cyclisme (`KJBudgetWidget`) — donc actuellement en production dans son état non conforme.

### 3.3 Indice d'endurance / Riegel (R12, R13, R14)
Voir §0. Le modèle actuel (régression individuelle sur 3 records) est dans l'esprit de R13, mais :
- pas de garde-fou de plage 3,5–230 min ;
- pas de modèle CP/W′ du tout (`criticalPower.ts` n'existe pas) — la spec dit "alternative à privilégier côté vélo", actuellement absente.

### 3.4 Puissance normalisée et zones (R16–R20)
`src/components/coach/ride-analysis-types.ts` implémente correctement l'algorithme de Coggan (`computeNormalizedPower` : moyenne glissante 30 s, puissance 4, moyenne, racine 4) — l'implémentation technique est fidèle. **Mais elle n'est jamais étiquetée "métrique propriétaire non validée par les pairs" dans l'UI** (`ride-analysis-dialog.tsx` l'affiche comme n'importe quelle autre métrique).
Un **seul** modèle de zones existe : 7 zones Coggan (`POWER_ZONES`), utilisé pour l'analyse de sortie. Le modèle 3 zones de distribution (Seiler, R18, pour la cible ~80 % basse intensité) n'existe pas du tout — aucun calcul de distribution d'intensité sur 3 bandes nulle part dans le code.

### 3.5 Gouverneur de charge interne (R05, R21, R22)
`src/components/cycling/governor-types.ts` / `use-governor.ts` : 6 signaux existants (FC repos, tendance HRV, dérive HR/watts en endurance, tendance RPE, ressenti, tendance readiness Vie & Santé), chacun comparé sur une fenêtre **7 j récents vs 21 j de baseline** (`splitRecentBaseline`, seuil ±3 %), agrégés en vote majoritaire simple (vert/orange/rouge, ≥ 2 signaux non nuls requis sinon "insuffisant").
- **Bien :** aucun ACWR nulle part dans le code (`grep` négatif) — conforme à l'interdiction R22 par absence, pas par décision explicite documentée.
- **Écart :** aucun calcul de **session-RPE** en tant que métrique de charge à part entière (`session-RPE = RPE × durée_min`), et **aucune monotonie/strain** (Foster 1998) — le gouverneur lit une tendance RPE mais ne construit ni la charge journalière ni sa dispersion sur 7 j. `load.ts` (session-RPE/monotonie/strain) n'existe pas.
- **Écart mineur :** fenêtre de baseline 21 j vs "≥ 4 semaines" (28 j) demandé au principe 2 — voir `docs/OPEN_QUESTIONS.md`.
- Le gouverneur affiche déjà motif + métrique déclenchante (pas de score opaque) — conforme à l'exigence de sortie.

### 3.6 Readiness et sommeil (R25–R31)
`src/components/lifestyle/lifestyle-types.ts`, `computeReadiness()` : moyenne simple de `sleepQuality`, `100 - stressScore`, `mood × 10` — pondération **égale et non modifiable**, contredit section 3.6 ("Pondération explicite et visible par l'utilisateur"). Priorité donnée au score d'appareil (WHOOP) quand disponible — cohérent avec la spec.
Aucun champ de stade de sommeil (REM/deep) n'est présent dans `IntervalsWellness` ni affiché nulle part — conforme à R30, mais par absence de la donnée elle-même plutôt que par un filtre actif documenté.
**Écart R29 confirmé** : aucune logique ne détecte une restriction de sommeil sur 2 nuits consécutives pour forcer une intensité basse indépendamment du ressenti déclaré — `sessionArbiter.ts` n'existe pas.
**Écart R28** : pas de besoin de sommeil perçu individualisé stocké (paramètre athlète absent), aucun dépistage type ASSQ.
HRV : voir §1.1 pour la violation active de front.

### 3.7 Métabolisme de base et nutrition (R32–R35)
`src/components/nutrition/fueling-types.ts`, `computeBMR()` utilise **Mifflin-St Jeor**, pas Ten-Haaf :
```ts
const base = 10 * weightKg + 6.25 * heightCm - 5 * age
return Math.round(sex === 'male' ? base + 5 : base - 161)
```
C'est une erreur de fond du même ordre que l'aurait été le 1,06 pour Riegel : R32 (revue systématique, méta-analyse) établit explicitement que Ten-Haaf est la seule équation sans hétérogénéité et la plus précise (80,2 % des sujets à ±10 %), et que Harris-Benedict/Mifflin-type sous-estiment fortement chez l'athlète à haut volume. Aucun avertissement affiché à ce sujet actuellement.
Glucides à l'effort (R34), croisement REDs (R35) : aucune fonctionnalité existante, à construire de zéro.

---

## 4. Ce qui est réutilisable tel quel

- **Le modèle Firestore per-user et son pattern CRUD** (`CrudDialogShell`/`useCrudSubmit`, `errorEmitter`/`FirestorePermissionError`) — directement réutilisable pour les paramètres athlète trimestriels (masse maigre, besoin de sommeil perçu, exposant Riegel individuel calibré) qui n'existent pas encore comme collection dédiée.
- **Le pipeline d'ingestion Intervals.icu** (`src/lib/intervals-api.ts`, routes `/api/intervals/*`) — séries puissance/FC 1 Hz, wellness quotidien, activités : la donnée brute nécessaire à `metrics/*.ts` est déjà accessible, il manque la couche de calcul, pas la donnée elle-même. `getActivityStreams()` existe déjà et est utilisé par `rideAnalysis`.
- **`useLifestyleData`/`mergeDailyWellness`** (fusion auto-sync + saisie manuelle) — bonne base pour le futur readiness composite pondérable ; le mécanisme de fusion champ-par-champ (manuel prioritaire) est solide et généralisable.
- **La capture RPE/ressenti existe déjà** (`sessionFeedback`, lu par le gouverneur) — bonne base pour `load.ts` (session-RPE/monotonie/strain), juste besoin d'une nouvelle fonction pure qui les agrège différemment.
- **`computeNormalizedPower()`** (`ride-analysis-types.ts`) implémente déjà correctement l'algorithme de Coggan — à déplacer/réutiliser tel quel dans `domain/cycling/metrics/`, juste besoin de l'étiquetage R16 en UI.
- **La pile de tests/CI existante** (Vitest, `tsc --noEmit`, ESLint, tous déjà bien rodés dans ce projet — 381 tests actuellement) — les nouveaux garde-fous demandés (Phase 1) s'ajoutent à ce pipeline existant, pas besoin de nouvel outillage.
- **La "Bibliothèque du coach"** (`users/{uid}/coachLibrary`, construite plus tôt cette session) — décidé (Q4) : réorientée en lecture seule pour afficher les 35 références de `references.ts`, plus de CRUD utilisateur libre. `add-library-entry-dialog.tsx`/l'import PDF deviennent obsolètes, à retirer en PR 11 (UI) une fois le remplacement prêt, pas avant.

---

## 5. Ce qui n'existe pas du tout et doit être créé de zéro

- `src/domain/cycling/evidence/` (references.ts, rules.ts, constants.ts) — rien de comparable n'existe.
- `src/domain/cycling/metrics/` en entier : `load.ts`, `durability.ts` (le module différenciant — MMP par palier de travail accumulé n'existe **pas du tout**, Riegel/TTE n'est pas un substitut, c'est un modèle différent), `decoupling.ts` (aucun calcul de ratio ΔFC/Δpuissance sur segments existant), `zones.ts` (modèle 3 zones absent), `impulseResponse.ts`, `endurance.ts` (à faire évoluer depuis `riegel-types.ts` existant), `criticalPower.ts`, `metabolism.ts` (à faire évoluer depuis `fueling-types.ts`).
- L'assembleur de prompt server-side unique (`buildSystemPrompt.ts`/`promptVersion.ts`/`invokeCoach.ts` ou équivalent Route Handler — voir §2 et Q1 dans OPEN_QUESTIONS).
- `planValidator.ts` (9 contrôles section 4) — rien d'équivalent, `training-plan-generation-flow.ts` ne valide rien après coup.
- `sessionArbiter.ts` (table à 3 entrées section 5) — le gouverneur actuel produit un statut global vert/orange/rouge, pas une décision structurée croisant explicitement HRV/bien-être/sommeil des 2 dernières nuits comme la table le prescrit.

---

## 6. Note — code hérité "Bike Vault"

`docs/blueprint.md` confirme : *"Gestion du Matériel Vélo: Migration et gestion complète de l'inventaire de vélos et composants... migré depuis le 'bike vault' existant."* Bike Vault est l'ancien nom du module de gestion de **matériel** (vélos/composants/entretien), devenu aujourd'hui le module **Garage** (`src/app/garage/page.tsx`, collections `bikes`/`components`/`chains`/`maintenanceRecords`). Ce n'est **pas** le module d'entraînement/coaching — les paramètres physiologiques de l'athlète (FTP, poids, CTL/ATL/TSB) viennent d'Intervals.icu et de `settings/powerCurve`/`settings/biometrics`, pas de Garage.
Seul point de contact réel avec la présente refonte : le poids de l'athlète (nécessaire pour kJ/kg et Ten-Haaf) vient d'Intervals.icu (`athlete.weight`), pas du module Garage — aucune donnée de Garage n'entre dans un calcul physiologique. Aucune contradiction directe trouvée entre Garage et la spécification coach.
`docs/backend.json` est un schéma JSON généré très tôt dans l'historique du projet (avant la migration Bike Vault → Garage et avant la plupart des modules actuels) — historique uniquement, ne reflète plus la structure Firestore réelle documentée dans `CLAUDE.md`.

---

## 7. Architecture — Cloud Functions vs Server Actions existantes

**Aucun dossier `functions/` n'existe, aucune dépendance `firebase-functions`/`firebase-admin` dans `package.json`.** Ce projet n'a jamais utilisé les Cloud Functions Firebase — il utilise depuis le début les **Server Actions Next.js** (fichiers `'use server'` dans `src/ai/flows/`), déployées sur **Firebase App Hosting** (Cloud Run géré, voir `apphosting.yaml`). C'est documenté comme un choix délibéré dans `CLAUDE.md` : *"cette app évite délibérément [Firebase Admin SDK] partout ailleurs."*

**Sur le plan Blaze/Spark** (votre note pratique) : `apphosting.yaml` existe et ce backend est déjà déployé via Firebase App Hosting — App Hosting est un produit qui **exige déjà le plan Blaze** (il provisionne Cloud Run/Cloud Build/Artifact Registry, tous facturables). Le projet est donc très probablement déjà sur Blaze aujourd'hui, indépendamment de la question Cloud Functions. Je ne peux pas vérifier le plan de facturation exact depuis ce terminal (pas d'accès à la console Firebase) — à confirmer de votre côté, mais l'inférence est forte.

**Décidé (Q1, `docs/OPEN_QUESTIONS.md`) : Server Actions existantes, pas de nouvelles Cloud Functions.** `buildSystemPrompt.ts`/`promptVersion.ts`/`invokeCoach.ts` vivront dans `src/ai/coach/` (fichiers `'use server'`), pas dans un dossier `functions/`. Même propriété de sécurité (prompt et clé API jamais côté client), zéro nouvelle infrastructure à standing up.

---

## 8. Renvoi

Les questions qui ne peuvent pas être tranchées sans votre arbitrage (architecture Cloud Functions, périmètre exact de "single entry point", fenêtre de baseline 21j vs ≥4 semaines, avenir de `coachLibrary`) sont dans `docs/OPEN_QUESTIONS.md`, pas décidées ici.
