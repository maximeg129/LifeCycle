# Plan d'action priorisé — LifeCycle Pro

*Phase 2 : suite de `AUDIT.md`, validé. Ce document est encore un livrable de planification — aucune implémentation n'a démarré. Chaque section se termine par ce qu'il faudrait valider avant d'attaquer le code.*

---

## Comment lire ce plan

Quatre familles, dans l'ordre où je recommande de les traiter :

1. **Quick wins** — un ou deux fichiers, aucun risque de régression, à faire en continu sans discussion.
2. **Refonte structurelle** — touche plusieurs modules à la fois, doit être planifiée en amont pour ne pas re-fragmenter le produit une deuxième fois.
3. **Fusionner / supprimer / clarifier** — des décisions produit, pas des tickets techniques. Je donne ma recommandation mais ce sont tes appels.
4. **Avant ouverture publique** — le chantier le plus lourd, à ne lancer que si l'ouverture à d'autres utilisateurs est une vraie intention, pas juste un vestige de `/pricing`.

---

## 1. Quick wins (faible effort, impact UX/qualité élevé)

| # | Action | Fichier(s) | Pourquoi maintenant |
|---|---|---|---|
| 1.1 | Supprimer `firebase-error-listener.tsx` (doublon mort, jamais importé) | `src/components/firebase-error-listener.tsx` | Zéro risque, nettoie la confusion pour quiconque cherchera "error listener" plus tard |
| 1.2 | Recaler CLAUDE.md sur la réalité : couleur primaire réelle (`211 100% 50%`), thème par défaut réel (clair), la scission Maison/Botanica | `CLAUDE.md` | La doc qui ment activement est pire que pas de doc — chaque session future (moi y compris) part sur de fausses hypothèses |
| 1.3 | Appliquer le header canonique (`text-sm font-medium text-primary uppercase...`) aux 3 pages qui ne le respectent pas | `src/app/botanica/page.tsx`, `src/app/home-management/page.tsx`, `src/app/weather/page.tsx` | Change 3-4 lignes par page, corrige immédiatement la cohérence visuelle la plus visible |
| 1.4 | Standardiser les rayons de bordure : choisir une petite échelle (ex. `rounded-lg` interactif / `rounded-2xl` carte / `rounded-3xl` modale plein écran) et l'appliquer aux nouveaux composants au fil de l'eau | `globals.css` + convention documentée | Pas une réécriture globale d'un coup (trop risqué), mais fixer la règle stoppe l'inflation de valeurs arbitraires dès maintenant |
| 1.5 | Retirer les couleurs Tailwind brutes hors-token les plus visibles (`text-gray-500`, `bg-green-500`/`bg-blue-500` en dur dans Botanica) au profit des tokens (`text-muted-foreground`, `text-primary`) | `src/app/botanica/page.tsx`, `src/app/pricing/page.tsx` | Rend le thème clair/sombre réellement cohérent sur ces pages — actuellement ces couleurs ne changent pas avec le thème |
| 1.6 | Décider du sort de `/pricing` à court terme (voir section 3) — a minima, la sortir de toute navigation publique si elle reste en l'état | `src/app/pricing/page.tsx` | C'est la page la plus dommageable pour la crédibilité si quelqu'un d'externe tombe dessus aujourd'hui |

**Effort total estimé** : une session courte. Aucune de ces actions ne touche à la logique métier ni aux données Firestore.

---

## 2. Refonte structurelle nécessaire

Ces chantiers demandent une vraie décision d'architecture avant le premier commit, parce que les refaire une deuxième fois coûterait cher.

### 2.1 — Une vraie couche de composants "produit" entre shadcn/ui et les pages
Aujourd'hui : shadcn/ui (bon) → directement les pages (divergence). Il manque la couche intermédiaire :
- `<PageHeader category="..." title="...">` — impose le patron canonique, rend la non-conformité impossible plutôt qu'à surveiller
- `<Card variant="stat" | "list" | "action">` construit sur `.apple-card`, qui remplace les 3 langages actuels
- `<EmptyState icon title description cta?>` partagé, pour les 12 endroits qui réinventent leur propre "aucune donnée"
- Généraliser `MetricCard` (déjà pensé pour ça) aux 4+ widgets qui gèrent des données optionnelles sans lui : `power-curve-card`, `governor-widget`, `tire-pressure-card`, `recovery-insight-panel`

**Ordre recommandé** : `PageHeader` d'abord (le plus mécanique, zéro ambiguïté), puis `EmptyState`, puis la généralisation de `MetricCard`, puis la migration de `Card` en dernier (le plus gros chantier — Cyclisme et Botanica ont chacun des dizaines d'occurrences à migrer).

### 2.2 — Abstraction des dialogues CRUD
8+ dialogues (`add-bike`, `add-chain`, `add-component`, `add-injury`, `add-coach-goal`, `add-expense`, `add-category`, `savings-goal`, `add-goal`...) réimplémentent probablement chacun le trio formulaire/validation Zod/soumission Firestore + gestion d'erreur `errorEmitter`. Un `<CrudDialog<T>>` générique (schéma Zod + champs + collection Firestore en props) réduirait la surface de code et garantirait que le pattern d'erreur Firestore documenté dans CLAUDE.md est appliqué partout, sans exception oubliée.

*À valider avant de commencer* : est-ce que ces dialogues sont vraiment assez similaires pour qu'une abstraction commune reste lisible, ou est-ce que 2-3 formes différentes (formulaire simple / formulaire avec upload photo / formulaire multi-étape) suffisent mieux ? Je recommande un audit rapide des 8 fichiers avant d'écrire l'abstraction, pour ne pas forcer une généralisation qui ne colle pas.

### 2.3 — Découpage du module Botanica
1 025 lignes, un seul fichier, zéro test. Extraire vers `src/components/botanica/` en suivant exactement le patron déjà établi ailleurs (types purs testés + hooks Firestore fins + composants d'affichage), et écrire les premiers tests. C'est le module qui rapprochera le plus vite le reste de l'app du niveau de rigueur de Cyclisme.

### 2.4 — Code-splitting du module Cyclisme (performance)
Cyclisme charge 459 kB au premier accès pour 5 onglets. `next/dynamic` sur les onglets PMC / Mémoire coach / Matériel / Chaînes (garder Entraînement, l'onglet par défaut, dans le bundle principal) devrait faire baisser sensiblement le chargement initial sans toucher à la logique. Candidat naturel pour être le premier test du pattern avant de le généraliser à Botanica et Vie & Santé si elles s'alourdissent aussi.

### 2.5 — Base de couverture de tests pour les modules à zéro test
Météo AI, Botanica, Maison, Réglages. Pas besoin de tout couvrir d'un coup — au minimum, appliquer la convention déjà en place ailleurs (extraire la logique métier en fonctions pures testables) à chaque nouveau développement sur ces modules, en commençant par Réglages vu la sensibilité de la logique qu'il contient (suppression de compte, export de données).

---

## 3. Fonctionnalités à fusionner, supprimer ou clarifier

**`/pricing`** — Ma recommandation : **supprimer**, pas juste masquer. Elle ne décrit aucune fonctionnalité réelle de l'app actuelle, n'a aucune logique de paiement derrière, et sa seule fonction aujourd'hui est de donner une fausse impression à qui tombe dessus. Si une vraie intention SaaS/multi-foyer existe, mieux vaut la reconstruire depuis les vraies fonctionnalités du produit actuel plutôt que de laisser vivre une promesse non tenue. *Question pour toi : cette page correspondait-elle à une vraie intention passée qu'il faudrait examiner avant suppression, ou c'est un résidu de template dont on peut se débarrasser sans discussion ?*

**Maison vs Botanica** — Deux options honnêtes, pas de solution "gratuite" :
- **Fusionner** sous un module "Maison" à onglets (Tâches / Plantes), cohérent avec ce que CLAUDE.md documente déjà. Remet Botanica dans le même système de composants que le reste au passage (2.3 le fait de toute façon).
- **Garder séparés**, mais aligner leur design system et ajouter un renvoi croisé léger dans la nav (sous-groupe visuel plutôt que deux items indépendants).
Je recommande la fusion : je n'ai trouvé aucune raison d'usage qui justifie deux destinations de nav séparées pour deux tâches du même domaine ("prendre soin de son foyer"), et ça règle 2.3 et 3.2 dans le même geste.

**`MetricCard`** — Le clarifier dans un sens ou dans l'autre (voir 2.1) plutôt que le laisser à moitié adopté, ce qui est aujourd'hui la pire des deux options : la doc promet un système que le code ne respecte qu'à moitié.

---

## 4. Fonctionnalités à renforcer avant toute ouverture publique

*Cette section suppose qu'ouvrir l'app à d'autres personnes soit une vraie intention. Si ce n'est pas le cas, elle est purement informative — rien à en tirer aujourd'hui.*

- **Confirmer si "ouverture publique" est réellement à l'ordre du jour.** `/pricing` est le seul signal qui le suggère, et c'est un vestige, pas une décision documentée. Le clarifier change radicalement la priorité de tout le reste de cette section.
- **Onboarding minimal** — au moins un état vide guidé sur la première visite de chaque module (pas un tour complet, juste "voici à quoi sert cet écran et comment démarrer" au lieu d'un tableau vide face au jargon Riegel/TSB/kJ).
- **Accessibilité** — non auditée du tout à ce stade (mentionné en limite de l'audit Phase 1). À faire avant d'exposer l'app à des utilisateurs qu'on ne connaît pas personnellement.
- **Couverture de tests sur Réglages en particulier** — suppression de compte et export de données sont les deux opérations où une régression coûte le plus cher en confiance utilisateur.

---

## 5. Ce qui manque pour un usage par quelqu'un d'autre que toi

Liste factuelle de l'écart entre "app personnelle" et "produit multi-utilisateur" — sans présumer que tu veuilles combler cet écart :

- **Aucune notion de rôle/permission** : `firestore.rules` (470 lignes) ne contient que des règles de propriété par `uid`, zéro concept d'admin, d'invitation, ou de partage entre comptes (le "foyer à 5 membres" de `/pricing` n'a aucune traduction technique nulle part).
- **Aucune donnée de démo/seed** : un nouveau compte est un vide total. Pas de jeu de données d'exemple pour comprendre l'app avant d'y injecter ses propres données réelles.
- **Aucune internationalisation** : UI 100% française en dur (conforme à la règle actuelle du projet, mais bloquant si "d'autres utilisateurs" incluent des non-francophones).
- **Clé API Anthropic personnelle unique**, sans quota ni limitation par utilisateur — un seul compte partagé pour toutes les fonctionnalités IA ; ouvrir à plusieurs utilisateurs sans repenser ça expose à une facture incontrôlée.
- **Aucune documentation utilisateur** au-delà du code lui-même — pas de FAQ, pas de guide "comment connecter Intervals.icu", rien qui ne suppose pas déjà de te connaître toi et ton contexte.
- **Dashboard multi-module suppose un profil d'usage unique** (cycliste sérieux + gestion de foyer + finances perso) — un nouvel utilisateur qui ne fait pas de vélo hérite quand même de tout le poids du module Cyclisme dans la nav, sans façon de le masquer.

---

## Ordre d'exécution recommandé

1. Section 1 en bloc (quick wins) — je peux commencer dès validation.
2. 2.1 (`PageHeader` puis `EmptyState`) — mécanique, faible risque, prépare le reste.
3. Décision sur 3.2 (Maison/Botanica) et 3.1 (`/pricing`) — bloquant pour savoir si 2.3 fusionne ou non les deux modules.
4. 2.3 (découpage Botanica) une fois la décision de fusion tranchée.
5. 2.2 (dialogues CRUD) et 2.4 (code-splitting Cyclisme) en parallèle, indépendants du reste.
6. 2.5 et section 4 en continu, pas un sprint dédié.
7. Section 5 seulement si tu confirmes une intention réelle d'ouverture publique — sinon, ce document reste la réponse suffisante à "qu'est-ce qu'il manquerait".

---

*Dis-moi par quoi tu veux commencer — je peux attaquer la section 1 telle quelle, ou si tu préfères trancher d'abord les décisions produit de la section 3 avant de coder quoi que ce soit.*
