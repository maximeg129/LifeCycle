# Questions ouvertes — refonte coach cyclisme

Questions qu'aucune des deux sources d'autorité (`01_Base_Scientifique_Cyclisme.md`, `02_Specification_Coach_LifeHub.md`) ne tranche, et que je n'invente pas de réponse à. Voir `docs/AUDIT_CYCLING.md` pour le contexte de chacune.

---

## Q1 — Cloud Functions callable vs Server Actions Next.js existantes

Le prompt de cadrage demande une "Cloud Function callable Firebase" pour `invokeCoach`. Ce projet n'a jamais eu de Cloud Functions (`functions/` n'existe pas, aucune dépendance `firebase-functions`/`firebase-admin`) — il utilise depuis le début des Server Actions Next.js (`'use server'`), déployées sur Firebase App Hosting. Les deux mécanismes exécutent côté serveur, aucun des deux n'expose la clé API ni le prompt système au client — la propriété de sécurité demandée est déjà acquise avec l'architecture actuelle.

**Deux options :**
- **(A) Nouvelles Cloud Functions callable.** Nouveau dossier `functions/`, SDK `firebase-functions`/`firebase-admin`, déploiement et facturation séparés. Correspond littéralement à la demande, mais introduit une infrastructure entièrement nouvelle dans un projet qui n'en a jamais eu besoin jusqu'ici.
- **(B) Garder les Server Actions / une Route Handler dédiée** comme mécanisme d'exécution serveur, avec `buildSystemPrompt.ts`/`promptVersion.ts`/`invokeCoach.ts` vivant dans `src/ai/coach/` (au lieu de `functions/src/coach/`) mais avec exactement les mêmes garanties : un seul point d'entrée, prompt versionné/journalisé, clé API jamais côté client.

Je recommande (B) — même résultat de sécurité, zéro nouvelle infrastructure à faire fonctionner correctement du premier coup en production. Mais c'est votre choix : le plan Blaze est de toute façon déjà requis par App Hosting (voir audit §7), donc ce n'est plus un facteur de décision.

**Votre réponse : (B).** Server Actions Next.js existantes, pas de nouvelles Cloud Functions. `buildSystemPrompt.ts`/`promptVersion.ts`/`invokeCoach.ts` vivront dans `src/ai/coach/` (fichiers `'use server'`), pas dans un dossier `functions/`.

---

## Q2 — Périmètre exact de "un seul point d'entrée"

`invokeCoach` doit-il être l'unique chemin pour **tous** les appels au modèle de l'app (y compris `cyclingOutfitRecommendation` météo/tenue et `identifyPlant` reconnaissance de plante — hors sujet cyclisme/entraînement), ou seulement pour les flows qui prennent une décision d'entraînement (`dailyWorkoutRecommendation`, `trainingPlanGeneration`, `planWeekSessions`, `coachChat`, `rideAnalysis`, `recoveryInsight`) ?

Les 10 principes non négociables et les affirmations interdites (section 8) ne concernent que l'entraînement/la récupération — les imposer au flow météo ou plantes n'aurait pas de sens. Mon hypothèse de travail, sauf avis contraire : le périmètre "coach" couvre les 6 flows d'entraînement/récupération listés ci-dessus, `cyclingOutfitRecommendation` et `identifyPlant` restent hors périmètre et gardent leur fonctionnement actuel.

**Votre réponse : confirmé.** Seulement les flows sujet cyclisme/entraînement (`dailyWorkoutRecommendation`, `trainingPlanGeneration`, `planWeekSessions`, `coachChat`, `rideAnalysis`, `recoveryInsight`) passent par `invokeCoach`. `cyclingOutfitRecommendation` (météo/tenue) et `identifyPlant` restent hors périmètre, inchangés.

---

## Q3 — Fenêtre de baseline HRV/sommeil/bien-être : 21 jours (existant) vs ≥ 4 semaines (spec)

Le gouverneur actuel (`governor-types.ts`) compare une fenêtre récente de 7 jours à une baseline de 21 jours immédiatement précédente. Le principe 2 de la spec demande une baseline "établie sur ≥ 4 semaines" (28 jours), sans donner de chiffre exact au-delà de ce plancher, et aucun `Rxx` du document scientifique ne fixe une valeur précise non plus (R25 dit "moyennage approprié" sans trancher un nombre de jours).

Faut-il aligner la fenêtre existante sur 28 jours minimum (changement mineur, cohérent avec le texte de la spec), ou est-ce que 21 jours reste acceptable en l'absence d'un `Rxx` qui donne un chiffre exact ?

**Votre réponse : aligner sur 28 jours.** `splitRecentBaseline()` (`governor-types.ts`, `baselineDays = 21` par défaut) passera à 28 — à faire dans la PR qui touche le gouverneur/l'arbitrage de séance (PR 10, `sessionArbiter.ts`), pas en Phase 0.

**Fait (PR 10) :** `splitRecentBaseline()`/`windowedTrendSignal()` (`governor-types.ts`) utilisent désormais `GOVERNOR_BASELINE_WINDOW.value.baselineDays` (`evidence/constants.ts`, déjà 28 depuis la PR 1) comme valeur par défaut, au lieu du littéral `21` — le gouverneur en production (`use-governor.ts`, qui appelle `windowedTrendSignal` sans fenêtre explicite) suit donc maintenant réellement 28 jours, pas seulement la constante déclarée. Un seul littéral `21` restait dans `governor-types.test.ts` (un appel EXPLICITE `splitRecentBaseline(series, ref, 7, 21)`, testant le mécanisme de découpage en général, pas la convention 28 jours de l'app) — laissé tel quel, plus un nouveau test dédié qui vérifie le défaut à 28 jours sans argument explicite.

---

## Q4 — Avenir de `users/{uid}/coachLibrary` (bibliothèque coach existante)

Une fonctionnalité "Bibliothèque du coach" a été construite plus tôt cette session (avant ce prompt de refonte) : l'athlète y ajoute librement des études/articles/notes de coach (Firestore, par utilisateur), dont le résumé est injecté dans le contexte de chaque flow IA. C'est un mécanisme différent de la base de 35 références demandée ici : `coachLibrary` est éditable par l'utilisateur au fil de l'eau et vit en base de données, alors que `references.ts`/`rules.ts`/`constants.ts` doivent être **versionnés dans le code**, non modifiables sans revue de code, seule source de vérité.

Trois options :
- **(a)** Les deux coexistent : `coachLibrary` reste un complément personnel libre (l'athlète peut ajouter SA propre lecture), la base des 35 références reste la source de vérité non négociable pour les règles opérationnelles. `buildLibraryContextBlock()` continue d'alimenter le contexte comme aujourd'hui, séparément de `buildSystemPrompt`.
- **(b)** `coachLibrary` est retirée/désactivée pour éviter toute confusion entre "source ajoutée librement" et "source qui fait autorité".
- **(c)** `coachLibrary` est réorientée : elle ne sert plus qu'à afficher les 35 références (lecture seule, plus de CRUD utilisateur), fusionnée avec `references.ts`.

Je penche pour (a) — les deux répondent à des besoins différents et le mandat de ce prompt (les 35 références font autorité pour les *règles opérationnelles*) n'exclut pas qu'un athlète garde ses propres lectures à côté. Mais à confirmer.

**Votre réponse : (c).** `coachLibrary` est réorientée en lecture seule : elle n'affiche plus que les 35 références de `references.ts`, plus de CRUD utilisateur libre. Implication concrète : `add-library-entry-dialog.tsx` (formulaire + import PDF, construit plus tôt cette session) et l'écriture Firestore `users/{uid}/coachLibrary` associée deviennent obsolètes une fois la Phase 5 (UI) livrée — `coach-library-tab.tsx` sera reconstruit pour lire `REFERENCES`/`RULES` depuis le code plutôt que Firestore. À traiter explicitement dans la PR 11 (UI), pas avant — l'audit ne supprime rien tant que le remplacement n'est pas prêt.

---

## Q5 — Bornes %FTP du modèle 3 zones (distribution, R18)

`zones.ts` (PR 2) doit implémenter le double modèle de zones demandé section 3.4 : 3 zones pour la distribution d'intensité (R18, Seiler) en plus des 7 zones de prescription (R16, Coggan, déjà sourcées et déjà utilisées dans l'app). Problème : R18 définit ses 3 zones par seuil de lactate sanguin (~2mM), une mesure qu'aucune donnée power-only (Wahoo/Intervals.icu) ne peut reproduire directement — le document ne donne aucune borne %FTP pour ce modèle 3 zones.

Plutôt que d'inventer une nouvelle borne %FTP pour approximer ce seuil lactate (exactement le genre de constante non sourcée que ce projet s'interdit), la première version de `zones.ts` regroupait les 7 zones Coggan déjà sourcées (R16) : zone1 = Coggan 1-2, zone2 = Coggan 3-4, zone3 = Coggan 5-7.

**Votre réponse : résolu autrement, avec de vraies bornes.** Vous avez fourni deux documents supplémentaires (`POWER_ZONES.pdf`, `POLARIZED_TRAINING.pdf`) — voir `evidence/supplementary-sources.ts` (S01, S02). S01 corrobore simplement les bornes 7 zones déjà en place (R16), aucun changement. S02 donne enfin des bornes %FTP réelles pour le modèle 3 zones (attribué à Seiler) — mais se contredisait lui-même entre son tableau (60/80/100) et son texte (50/80/100). Vous avez tranché pour les valeurs du **texte : Zone 1 <80% FTP, Zone 2 80-100%, Zone 3 100%+**. `zones.ts` calcule maintenant directement le temps en zone 3-zones depuis le flux watts avec ces bornes (`computePowerZoneDistribution3`), plus besoin de regrouper les 7 zones. Le regroupement par 7-zones a été retiré.

Point resté à ma discrétion, documenté en commentaire dans `zones.ts` plutôt que retranché à vous : le texte source dit "Zone 1 : 50-79%" sans préciser ce qui se passe en dessous de 50% — le plancher de zone1 est fixé à 0% pour que le temps en zone reste complet (rien silencieusement perdu sous 50%), un choix d'implémentation, pas une valeur sourcée.

---

## Q6 — Coefficient de pondération "kJ au-dessus de la puissance critique" (budget kJ/kg)

`kj.ts` (PR 4) doit implémenter le budget kJ/kg pondéré par l'intensité, section 3.2 : deux règles le demandent explicitement — `kj-budget-unit-is-kj-per-kg-weighted` ("Unité : kJ/kg, jamais kJ bruts, **pondérée par l'intensité**") et `kj-budget-increasing-coefficient-above-cp` ("Le travail réalisé au-dessus de la puissance critique produit une dégradation supérieure pour un kJ accumulé inférieur — appliquer un **coefficient croissant par zone**").

Problème : ni R09 ni R10 (les deux références citées) ne donnent de coefficient numérique ni de formule exacte. Les deux établissent le principe qualitatif — l'intensité du travail antérieur compte plus que son volume brut — mais aucun ne chiffre une pondération par zone. Deuxième obstacle, indépendant : la pondération est définie relativement à la **puissance critique (CP)** de l'athlète, une grandeur que l'app ne calcule pas encore (`criticalPower.ts`, R14/R15, prévu PR 6 — bloqué sur la constante pending de reconstitution W′, R15).

Plutôt que d'inventer un coefficient par zone (exactement le genre de constante non sourcée que ce projet s'interdit), `kj.ts` livré en PR 4 expose :
- le budget en **kJ/kg** (déjà une vraie amélioration sur l'unité — remplace les kJ bruts actuellement en production) ;
- une vérification contre les paliers de durabilité déjà sourcés (`KJ_DURABILITY_THRESHOLDS`, R08/R10/R11) — plafonds de référence, pas des cibles.

Mais **pas** la pondération par coefficient croissant au-dessus de CP elle-même — cette partie de la règle reste non implémentée tant que (a) une source chiffre un coefficient exploitable, ou (b) vous tranchez une convention explicite (comme le seuil zone1=0% de Q5, ou le nudge KJ_TARGET_NUDGE) et que criticalPower.ts (PR 6) existe pour fournir la CP elle-même.

**Votre réponse (31 août 2026) :** pas un nouveau coefficient inventé — le "coefficient croissant" n'a pas besoin d'être une constante empirique séparée, il découle **directement de l'équation du modèle CP/W′ déjà sourcé** (R14/R15) :

> `W = (P − CP) × t` — le travail (Joules) prélevé sur la réserve W′ pendant un intervalle à puissance `P > CP` de durée `t`. L'écart `(P − CP)` EST le taux de déplétion : un effort à 350W avec CP=300W consomme 50 J/s, un effort à 500W en consomme 200 J/s — 4x plus vite pour un delta d'intensité qui n'est pourtant que ~x1,4. C'est un multiplicateur croissant non-linéaire, mais il n'a besoin d'aucune constante empirique supplémentaire : il n'utilise que la CP elle-même (déjà le sujet de R14) et la définition de W′ comme réserve finie (R15).

Analyse technique : ce n'est pas une nouvelle affirmation scientifique à sourcer séparément — c'est une reformulation algébrique du modèle hyperbolique puissance-durée deux-paramètres de R14 (`P = W′/t + CP ⟺ W′ = (P−CP)×t`), déjà dans les 35 références. Ça confirme la bonne approche (le delta au-dessus de CP pondère lui-même le kJ, pas une table de coefficients par zone arbitraire) et écarte le risque d'inventer une constante non sourcée. Deux points restent hors de portée immédiate, pas résolus par cette réponse :
1. **Le volet reconstitution** (comment W′ se recharge sous CP, tableau qualitatif fourni — "quasi nul près de CP, rapide en Z1/Z2, maximal à l'arrêt") reste qualitatif ici ; la vraie constante de temps τ chiffrée reste dans R15 (`W_PRIME_RECONSTITUTION_CONSTANT`, toujours pending) — pas nécessaire pour la pondération du budget kJ elle-même (qui ne regarde que la déplétion pendant l'effort), seulement pour le solde W′ balance pendant une sortie (`ride-analysis-4-w-prime-balance`, PR 8+).
2. **La CP elle-même n'est toujours pas calculée** dans l'app — reste `criticalPower.ts` (R14), prévu PR 6. Le volet CP-fit (régression à partir des 3 records de puissance déjà stockés dans `settings/powerCurve`) ne dépend PAS de la constante pending W′ (R15 ne sert qu'à la reconstitution) — livrable dans PR 6 sans attendre R15.

**Plan retenu, à exécuter une fois PR 6 livré (pas dans cette PR) :** `kj.ts` recevra une fonction de pondération qui, pour chaque échantillon de puissance au-dessus de la CP estimée, compte `(P−CP)×t` en plus du kJ/kg ordinaire (poids 1 en dessous de CP) — formalisant "coefficient croissant" par la physique du modèle plutôt qu'un multiplicateur choisi à la main. Comment combiner exactement kJ "ordinaires" (sous CP) et kJ "W′" (au-dessus de CP) en un seul indice composite reste un choix d'implémentation qui sera documenté explicitement (même traitement que KJ_TARGET_NUDGE) au moment de coder cette fonction, pas avant.

---

## Q7 — Deux contrôles de `planValidator.ts` (PR 9) sans seuil chiffré sourcé

`planValidator.ts` (PR 9) implémente les 9 contrôles de la section 4. Sept d'entre eux ont un seuil ou une comparaison directement exploitable depuis le texte déjà sourcé des règles (`evidence/rules.ts`) ou depuis une comparaison de données déjà disponibles (pas de constante à inventer). Deux ne le sont pas :

- **plan-check-4 (monotonie, R21)** : Foster (2001, compagnon 1998) introduit la monotonie (moyenne/écart-type de la charge quotidienne) mais ne fixe aucun seuil "élevé" chiffré dans le document source. `checkMonotony()` accepte donc `monotonyThreshold` comme paramètre **obligatoire, sans valeur par défaut** — l'appelant (le futur `sessionArbiter.ts`/l'UI) doit le fournir consciemment. Un seuil couramment cité dans la littérature grand public (~2,0) existe, mais ce projet s'interdit de l'introduire sans qu'il soit sourcé dans les 35 références ou tranché explicitement par vous.
- **plan-check-5 (volume d'intervalles, R19)** : Tønnessen et al. (2024) est un constat qualitatif (12 entraîneurs norvégiens interrogés, "plus volumineux, plus contrôlés, moins épuisants que les études d'intervention") sans aucun chiffre exploitable, et cette app n'a aucune base de données de "modèles d'entraîneurs de haut niveau" à comparer. `checkIntervalVolume()` renvoie donc toujours `insufficient_data` — ce contrôle reste une appréciation qualitative laissée au modèle (déjà grounded via `buildSystemPrompt`, scope `plan-validation`, PR 8), pas un calcul déterministe.

**Votre réponse : (à venir)** — si vous avez un seuil de monotonie à trancher (une valeur sourcée ou une convention explicite) ou une base de comparaison pour le volume d'intervalles, je les câble ; sinon ces deux contrôles restent dans cet état honnête (paramètre obligatoire sans défaut / toujours insufficient_data).
