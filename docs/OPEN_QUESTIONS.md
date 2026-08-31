# Questions ouvertes — refonte coach cyclisme

Questions qu'aucune des deux sources d'autorité (`01_Base_Scientifique_Cyclisme.md`, `02_Specification_Coach_LifeHub.md`) ne tranche, et que je n'invente pas de réponse à. Voir `docs/AUDIT_CYCLING.md` pour le contexte de chacune.

---

## Q1 — Cloud Functions callable vs Server Actions Next.js existantes

Le prompt de cadrage demande une "Cloud Function callable Firebase" pour `invokeCoach`. Ce projet n'a jamais eu de Cloud Functions (`functions/` n'existe pas, aucune dépendance `firebase-functions`/`firebase-admin`) — il utilise depuis le début des Server Actions Next.js (`'use server'`), déployées sur Firebase App Hosting. Les deux mécanismes exécutent côté serveur, aucun des deux n'expose la clé API ni le prompt système au client — la propriété de sécurité demandée est déjà acquise avec l'architecture actuelle.

**Deux options :**
- **(A) Nouvelles Cloud Functions callable.** Nouveau dossier `functions/`, SDK `firebase-functions`/`firebase-admin`, déploiement et facturation séparés. Correspond littéralement à la demande, mais introduit une infrastructure entièrement nouvelle dans un projet qui n'en a jamais eu besoin jusqu'ici.
- **(B) Garder les Server Actions / une Route Handler dédiée** comme mécanisme d'exécution serveur, avec `buildSystemPrompt.ts`/`promptVersion.ts`/`invokeCoach.ts` vivant dans `src/ai/coach/` (au lieu de `functions/src/coach/`) mais avec exactement les mêmes garanties : un seul point d'entrée, prompt versionné/journalisé, clé API jamais côté client.

Je recommande (B) — même résultat de sécurité, zéro nouvelle infrastructure à faire fonctionner correctement du premier coup en production. Mais c'est votre choix : le plan Blaze est de toute façon déjà requis par App Hosting (voir audit §7), donc ce n'est plus un facteur de décision.

**Votre réponse :**

---

## Q2 — Périmètre exact de "un seul point d'entrée"

`invokeCoach` doit-il être l'unique chemin pour **tous** les appels au modèle de l'app (y compris `cyclingOutfitRecommendation` météo/tenue et `identifyPlant` reconnaissance de plante — hors sujet cyclisme/entraînement), ou seulement pour les flows qui prennent une décision d'entraînement (`dailyWorkoutRecommendation`, `trainingPlanGeneration`, `planWeekSessions`, `coachChat`, `rideAnalysis`, `recoveryInsight`) ?

Les 10 principes non négociables et les affirmations interdites (section 8) ne concernent que l'entraînement/la récupération — les imposer au flow météo ou plantes n'aurait pas de sens. Mon hypothèse de travail, sauf avis contraire : le périmètre "coach" couvre les 6 flows d'entraînement/récupération listés ci-dessus, `cyclingOutfitRecommendation` et `identifyPlant` restent hors périmètre et gardent leur fonctionnement actuel.

**Votre réponse :**

---

## Q3 — Fenêtre de baseline HRV/sommeil/bien-être : 21 jours (existant) vs ≥ 4 semaines (spec)

Le gouverneur actuel (`governor-types.ts`) compare une fenêtre récente de 7 jours à une baseline de 21 jours immédiatement précédente. Le principe 2 de la spec demande une baseline "établie sur ≥ 4 semaines" (28 jours), sans donner de chiffre exact au-delà de ce plancher, et aucun `Rxx` du document scientifique ne fixe une valeur précise non plus (R25 dit "moyennage approprié" sans trancher un nombre de jours).

Faut-il aligner la fenêtre existante sur 28 jours minimum (changement mineur, cohérent avec le texte de la spec), ou est-ce que 21 jours reste acceptable en l'absence d'un `Rxx` qui donne un chiffre exact ?

**Votre réponse :**

---

## Q4 — Avenir de `users/{uid}/coachLibrary` (bibliothèque coach existante)

Une fonctionnalité "Bibliothèque du coach" a été construite plus tôt cette session (avant ce prompt de refonte) : l'athlète y ajoute librement des études/articles/notes de coach (Firestore, par utilisateur), dont le résumé est injecté dans le contexte de chaque flow IA. C'est un mécanisme différent de la base de 35 références demandée ici : `coachLibrary` est éditable par l'utilisateur au fil de l'eau et vit en base de données, alors que `references.ts`/`rules.ts`/`constants.ts` doivent être **versionnés dans le code**, non modifiables sans revue de code, seule source de vérité.

Trois options :
- **(a)** Les deux coexistent : `coachLibrary` reste un complément personnel libre (l'athlète peut ajouter SA propre lecture), la base des 35 références reste la source de vérité non négociable pour les règles opérationnelles. `buildLibraryContextBlock()` continue d'alimenter le contexte comme aujourd'hui, séparément de `buildSystemPrompt`.
- **(b)** `coachLibrary` est retirée/désactivée pour éviter toute confusion entre "source ajoutée librement" et "source qui fait autorité".
- **(c)** `coachLibrary` est réorientée : elle ne sert plus qu'à afficher les 35 références (lecture seule, plus de CRUD utilisateur), fusionnée avec `references.ts`.

Je penche pour (a) — les deux répondent à des besoins différents et le mandat de ce prompt (les 35 références font autorité pour les *règles opérationnelles*) n'exclut pas qu'un athlète garde ses propres lectures à côté. Mais à confirmer.

**Votre réponse :**
