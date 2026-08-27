# Audit critique — LifeCycle Pro

*Phase 1 : diagnostic. Aucun code modifié pour produire ce document — uniquement lecture, grep, et un build de vérification.*

---

## 1. Vue d'ensemble critique

LifeCycle Pro n'est pas un produit cohérent aujourd'hui — c'est **cinq ou six mini-produits développés en parallèle, chacun avec ses propres conventions**, assemblés sous une sidebar commune. Le module Cyclisme (5 166 lignes de composants, 7 fichiers de test, un vrai système de hooks partagés, un pattern `MetricCard` pour l'honnêteté des données) a reçu un niveau d'investissement et de rigueur très supérieur au reste. Botanica (1 025 lignes dans un seul `page.tsx`, zéro composant partagé, zéro test, couleurs vertes en dur qui ignorent le design system) donne l'impression d'avoir été copié-collé depuis un starter template différent puis à peine adapté. Entre les deux, Finance et Vie & Santé sont dans un état correct mais avec leur propre variante de "carte" et leurs propres motifs d'état vide.

Le vrai problème n'est pas qu'un module soit "moins bon" qu'un autre — c'est qu'**il n'existe pas de système de composants partagé qui aurait empêché cette divergence**. `globals.css` définit `.apple-card` comme la classe de carte canonique, mais Cyclisme l'ignore complètement (0 occurrence) au profit d'un pattern `bg-card/40 border border-border rounded-lg` répété à la main dans une dizaine d'endroits, et Botanica invente carrément sa propre palette (`green-500`, `blue-500` en dur) sans passer par les tokens `--primary`/`--accent`. Trois langages visuels différents pour la même notion de "carte", dans la même application.

Le CLAUDE.md du projet — censé être la source de vérité architecturale — est lui-même en dérive par rapport au code réel : il documente une couleur primaire "Bleu électrique (HSL 230 84% 63%)" qui n'existe plus dans `globals.css` (remplacée depuis par le bleu iOS `211 100% 50%`), un mode sombre "par défaut" alors que le thème par défaut réel est désormais clair (`localStorage` vide = pas de classe `.dark`), et un module unique "Maison & Plantes" alors que le code a depuis scindé ça en deux entrées de nav séparées (`Maison` et `Botanica`) sans que personne ne remette à jour la doc ni ne se demande si cette scission avait du sens produit.

Il y a aussi un résidu direct et non négligeable d'un ancien produit : la page `/pricing` présente une grille tarifaire "Gratuit / Premium" avec des fonctionnalités ("5 membres du foyer", "notifications push", "sans publicité") qui n'existent nulle part dans l'app actuelle, un CTA "Essai gratuit 14 jours" qui ne mène à aucune logique de facturation (zéro trace de Stripe ou d'un quelconque backend de paiement dans tout le repo), et un jeu de couleurs qui n'utilise même pas les tokens du design system (`#1A1A1A`, `text-gray-500` en dur). C'est le genre de page qui, montrée à un nouvel utilisateur, décrédibiliserait immédiatement le reste du produit.

Sur le plan technique pur, le code est globalement propre : zéro `console.log` ou `TODO` oublié, une vraie discipline de tests sur les modules récents (fonctions pures testées, logique Firebase gardée fine), pas de dette de sécurité visible. Le vrai risque n'est pas la qualité du code écrit — c'est l'absence de garde-fous structurels (design system, découpage de bundle, couverture de tests homogène) qui a laissé le produit diverger module par module au fil des sessions de développement.

---

## 2. Redondances et chevauchements entre modules

| Module A | Module B | Nature du chevauchement | Recommandation |
|---|---|---|---|
| **Maison** (`/home-management`) | **Botanica** (`/botanica`) | Le CLAUDE.md documente un seul module "Maison & Plantes" ; le code réel les a scindés en deux entrées de nav distinctes, avec deux langages visuels totalement différents (apple-card léger vs. cartes vertes en dur). Aucune raison produit documentée pour cette scission. | Décider une fois pour toutes : soit les refusionner sous un même module à onglets (cohérent avec la doc), soit assumer la scission et la documenter — mais dans les deux cas, **aligner leur design system**, ce qui n'est pas fait aujourd'hui. |
| **Cyclisme → Fueling widget** | **Nutrition** | `fueling-widget.tsx` (dans `components/nutrition/`) est consommé depuis Cyclisme pour croiser charge d'entraînement et nutrition. C'est une intégration voulue, pas une redondance — mais elle vit dans le dossier `nutrition/` sans qu'aucun signal dans Cyclisme n'indique "ceci vient d'un autre module". | Pas de fusion nécessaire — juste documenter ce point d'intégration dans CLAUDE.md, qui ne le mentionne pas actuellement. |
| **Cyclisme → Governor (signal sommeil/récup)** | **Vie & Santé** | Même remarque : le gouverneur de charge interne lit `healthMetrics` (le domaine de Vie & Santé) directement depuis `use-governor.ts`. Bonne intégration technique, mais aucun renvoi visuel dans Vie & Santé vers Cyclisme ("ces données alimentent aussi votre charge d'entraînement") — l'utilisateur ne peut pas deviner que ses données de sommeil ont un usage ailleurs. | Ajouter un indice visuel léger dans Vie & Santé quand une métrique est consommée ailleurs. |
| **`MetricCard`** (le pattern documenté pour "métrique indisponible") | Widgets qui gèrent aussi des données optionnelles : `power-curve-card.tsx`, `governor-widget.tsx`, `tire-pressure-card.tsx`, `recovery-insight-panel.tsx` | `MetricCard` n'est utilisé que dans **2 fichiers** (`kj-budget-widget.tsx`, `fueling-widget.tsx`) sur au moins 6 endroits qui gèrent des données manquantes/optionnelles. Les autres widgets gèrent l'absence de donnée à leur façon (souvent un simple `return null`, silencieux) plutôt que le message honnête documenté dans CLAUDE.md. | Soit généraliser `MetricCard` à tous les widgets à données optionnelles, soit documenter clairement dans CLAUDE.md que ce n'est qu'un pattern parmi d'autres — actuellement le CLAUDE.md le présente comme LE pattern du design system, ce qui est trompeur. |
| `FirebaseErrorListener.tsx` (PascalCase, utilisé) | `firebase-error-listener.tsx` (kebab-case, orphelin) | Deux fichiers quasi-identiques à la racine de `src/components/`. Le second n'est importé **nulle part** dans le codebase — code mort pur, versions divergentes (l'un lève l'erreur via state+re-render, l'autre via `setTimeout`). | Supprimer `firebase-error-listener.tsx`. Trivial, zéro risque. |

---

## 3. Incohérences UI — exemples précis

**Trois langages de "carte" différents pour le même concept visuel :**
- `.apple-card` (globals.css:75) — utilisé par Finance (10×), Vie & Santé (10×), Nutrition (7×), Réglages (2×)
- Cyclisme — 0 usage de `.apple-card` ; motif répété à la main dans `power-curve-card.tsx`, `governor-widget.tsx`, etc. : `"bg-card/40 border border-border rounded-lg"` / `"rounded-xl"` selon les fichiers (rayons incohérents entre eux)
- Botanica — cartes en couleurs brutes hors-tokens : `"bg-green-500/8 border border-green-500/20 rounded-[20px]"`, `"bg-blue-500/10 rounded-2xl"` (`src/app/botanica/page.tsx`)

**Rayons de bordure non standardisés** : le token `--radius` vaut `0.75rem` (12px), mais le code utilise en parallèle `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-[10px]`, `rounded-[20px]`, `rounded-[24px]`, `rounded-[32px]` selon les fichiers — aucune règle visible sur quand utiliser quoi. La sidebar (`src/components/layout/sidebar.tsx`) a ses propres valeurs (`rounded-[10px]`, `rounded-[8px]`) qui ne correspondent à aucun des deux systèmes ci-dessus.

**Pattern de header de page** (documenté dans CLAUDE.md comme LE patron canonique — `<h2 className="text-sm font-medium text-primary uppercase tracking-wider">`) : respecté par seulement **5 pages sur 11** (`cycling`, `finance`, `lifestyle`, `nutrition`, `settings`). Absent de `botanica`, `home-management`, `weather` — trois modules pourtant listés dans la nav principale.

**Couleur primaire documentée vs. réelle** : CLAUDE.md indique `--primary: HSL 230 84% 63%` (un bleu électrique) ; le `globals.css` réel utilise `211 100% 50%` (bleu système iOS). La doc n'a manifestement pas suivi un changement de direction visuelle.

**Thème par défaut documenté vs. réel** : CLAUDE.md affirme "dark mode par défaut, `<html class='dark'>`" ; le script anti-FOUC dans `layout.tsx` n'ajoute la classe `dark` que si `localStorage.getItem('lifecycle-theme') === 'dark'` — un nouveau visiteur sans préférence stockée atterrit en **mode clair**. Soit la doc ment, soit le comportement réel est un bug de régression par rapport à l'intention d'origine.

**Couleurs Tailwind brutes au lieu des tokens** : `text-gray-500` (pricing page), `bg-green-500`/`bg-blue-500` en dur (botanica), `border-yellow-500/30`, `border-orange-500/20` (cycling) — coexistent avec l'usage correct des tokens (`text-muted-foreground`, `bg-primary`) ailleurs. Aucune règle de lint ne semble empêcher ce mélange.

---

## 4. Points de friction UX — classés par sévérité

**Critique**
- La page `/pricing` promet un produit qui n'existe pas (multi-utilisateur "foyer", notifications push, essai 14 jours) et n'a aucune logique de paiement derrière. Accessible publiquement (pas de garde d'auth), c'est la première chose qu'un visiteur externe peut voir en cliquant un lien "Tarifs" depuis la landing page.
- Aucun onboarding. Un nouvel utilisateur qui s'inscrit atterrit directement sur `/home-management` (redirection post-login documentée dans CLAUDE.md) sans aucune donnée, aucune explication de ce que sont CTL/ATL/TSB, le "gouverneur de charge", ou pourquoi il devrait connecter Intervals.icu. Le jargon cycliste avancé (Riegel, TSB, kJ budget) est présenté sans contexte à quelqu'un qui découvre l'app.

**Élevé**
- Aucun composant `EmptyState` partagé : 12 fichiers gèrent l'absence de données chacun à sa façon (textes différents, mise en page différente). Incohérence garantie à chaque nouvel écran.
- Botanica (1 025 lignes dans un seul fichier) est le module le plus complexe de l'app après Cyclisme en poids de bundle, mais sans aucune décomposition en composants ni aucun test — la maintenabilité future y est nettement plus fragile qu'ailleurs.
- Le module Cyclisme (`/cycling`) charge **459 kB** de JS au premier chargement (vs. 304 kB pour Maison, 328 kB pour Nutrition) parce qu'aucun de ses 5 onglets (Entraînement / PMC / Mémoire coach / Matériel / Chaînes) n'est chargé à la demande — tout part dans un seul bundle même si l'utilisateur ne regarde qu'un onglet.

**Moyen**
- Le champ "Sync" côté Matériel (avant la correction de cette session) illustrait un problème plus général : plusieurs endroits de l'app affichent des dates/chiffres "de dernière synchronisation" sans clarifier si ça veut dire "j'ai vérifié" ou "j'ai trouvé du nouveau" — source de confusion récurrente, pas isolée au seul cas déjà corrigé.
- Densité de dialogues CRUD quasi-identiques non mutualisés : `add-bike-dialog`, `add-chain-dialog`, `add-component-dialog`, `add-injury-dialog`, `add-coach-goal-dialog` (Cyclisme) + `add-expense-dialog`, `add-category-dialog`, `savings-goal-dialog` (Finance) + `add-goal-dialog` (Vie & Santé) — chacun réimplémente probablement la même mécanique de formulaire/validation/soumission Firestore sans wrapper commun.

**Faible**
- Incohérence de vocabulaire mineure : "Réglages" (sidebar) vs "Settings" (routes/dossiers) — cosmétique, sans impact utilisateur direct, mais signale le même manque de relecture d'ensemble que le reste.

---

## 5. Architecture de navigation — 10 modules, ça a-t-il du sens ?

La sidebar actuelle expose : Cyclisme, Nutrition, Météo AI, Maison, Botanica, Vie & Santé, Finances, plus Réglages — **8 destinations**, sans compter les pages publiques (accueil, tarifs, connexion, inscription). Pour un usage strictement personnel (ce que confirme le modèle de données `users/{uid}/...` sans aucune notion de rôle ni de partage), ce n'est pas déraisonnable en soi : c'est un hub personnel, pas un produit qu'on demande à un tiers d'apprendre en une session.

Le problème n'est pas le nombre de modules, c'est **l'absence de hiérarchie entre eux**. Tous les 7 items de nav ont le même poids visuel alors qu'ils n'ont clairement pas la même maturité ni la même fréquence d'usage probable (Cyclisme reçoit manifestement 10× plus d'attention produit que Botanica). Il n'y a aucun regroupement (par ex. un sous-menu "Maison" qui contiendrait Tâches + Plantes), ce qui a probablement motivé la scission en deux items de nav plutôt que la construction d'un vrai système d'onglets/sous-navigation réutilisable.

Si l'app doit un jour s'ouvrir à d'autres utilisateurs (ce que la page `/pricing` orpheline laisse presque supposer avoir été une intention à un moment), la question n'est pas "faut-il regrouper les modules" mais "faut-il même garder tous ces modules dans le même produit" — Finance personnelle et Cyclisme n'ont aucune synergie de données entre eux (aucune requête croisée trouvée), contrairement à Cyclisme ↔ Vie & Santé ou Cyclisme ↔ Nutrition qui, elles, s'enrichissent mutuellement. Un découpage produit en "cœur performance" (Cyclisme + Nutrition + Vie & Santé, qui se parlent déjà) vs. "annexes vie quotidienne" (Maison, Botanica, Finances, qui ne se parlent pas entre elles ni avec le reste) serait plus honnête vis-à-vis de ce que l'app fait réellement bien.

---

## 6. Design system — vrai système ou copier-coller stylé ?

**Verdict : copier-coller stylé, avec un vrai système en gestation qui n'a jamais été appliqué partout.**

Ce qui existe réellement comme fondations : les tokens CSS (`--primary`, `--card`, `--border`, etc.), 30+ composants shadcn/ui dans `src/components/ui/` (Button, Card, Dialog, Select...) correctement utilisés comme primitives de bas niveau partout, et un vrai composant à haute valeur ajoutée (`MetricCard`) pensé pour résoudre un problème produit précis (l'honnêteté sur les données manquantes).

Ce qui manque pour que ce soit un "système" plutôt qu'une boîte à outils : aucune couche intermédiaire entre les primitives shadcn et les pages — pas de `<Card variant="stat">`, pas de composant `<PageHeader>` qui aurait forcé le respect du patron documenté dans CLAUDE.md, pas de `<EmptyState>` partagé, pas de wrapper `<CrudDialog>` pour les 8+ dialogues de formulaire quasi-identiques. Résultat : chaque module a improvisé sa propre version de ces briques manquantes, avec des résultats visuellement incompatibles (cf. section 3). `MetricCard` lui-même, censé être LE pattern du design system pour les données optionnelles, n'est adopté que dans 2 widgets sur au moins 6 candidats évidents.

Le design system n'est donc pas "absent" — il est **partiel et non appliqué**, ce qui est plus difficile à corriger qu'un vrai vide : il faut désormais choisir entre généraliser l'existant (`.apple-card`, `MetricCard`) à tout le code qui l'a contourné, ou accepter que ces patterns changent et migrer tout le monde vers une nouvelle version consolidée.

---

## 7. Performance perçue

- **Aucun découpage de bundle nulle part** (zéro `next/dynamic`, zéro `React.lazy`, zéro `Suspense` applicatif dans tout le repo) — chaque page charge 100% de son code au premier accès, y compris des onglets non consultés.
- **Cyclisme est le point chaud** : 459 kB de premier chargement, le double de la plupart des autres modules, pour une page à 5 onglets chargés d'un bloc. Un découpage par onglet (`next/dynamic` sur PMC/Mémoire coach/Matériel/Chaînes) réduirait immédiatement le coût d'entrée pour quelqu'un qui ne consulte que l'onglet Entraînement.
- Botanica (419 kB) et Vie & Santé (429 kB) sont également lourdes pour des pages conceptuellement plus simples que Cyclisme — signe que la taille du bundle suit la taille du fichier source plus que la complexité réelle de l'UI affichée à l'instant T.
- Densité de hooks de données sur `/cycling` : 6 hooks de fetch distincts déclenchés par page (`useAthlete`, `useActivities`, `useWellness`, `useFitnessChart`, plus les hooks métier `useGovernor`/`useKJBudget`/etc.), en plus du `IntervalsProvider` global qui fetch déjà tout au niveau racine de l'app à la connexion — accumulation d'allers-retours réseau/recalculs qui n'a pas été auditée pour les re-renders inutiles.
- Positif à noter : `IntervalsProvider` (refonte de cette session) a résolu un vrai problème de duplication de fetch — c'est le bon sens de refactor à généraliser ailleurs plutôt qu'un point noir.

---

## 8. Couverture de tests — état des lieux

| Module | Fichiers de test | Constat |
|---|---|---|
| Cyclisme | 7 | Investissement clair, logique métier extraite en fonctions pures et testée |
| Nutrition | 3 | Correct |
| Finance | 1 | Minimal — un seul fichier pour tout un module CRUD |
| Vie & Santé | 1 | Minimal |
| Météo AI | 0 | Aucun test |
| Botanica | 0 | Aucun test, et c'est le module le plus volumineux en lignes de code après Cyclisme |
| Maison (home-management) | 0 | Aucun test |
| Réglages | 0 | Aucun test (suppression de compte, export de données — logique sensible non testée) |

La convention "logique métier en fonctions pures testées, glue React non testée directement" (documentée implicitement dans le code, bien suivie sur Cyclisme) n'a simplement pas été appliquée à la moitié des modules.

---

## 9. Ce que cet audit ne couvre pas encore

Cette phase 1 n'a pas inclus : un test manuel de chaque flux utilisateur dans le navigateur (analyse uniquement statique/code), un audit d'accessibilité (contrastes, navigation clavier, lecteurs d'écran), ni un profilage runtime réel des re-renders React. Si utile, ça peut faire l'objet d'un complément avant la Phase 2.

---

*Prochaine étape : valider ce diagnostic avec toi avant de produire le plan d'action priorisé (Phase 2).*
