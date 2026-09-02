# Audit UX — Coach & Plan d'entraînement

*Retour utilisateur : "je suis toujours pas convaincue de la présentation et de l'organisation du
coach avec le plan d'entraînement... nous devrions peut-être effectuer un audit ainsi qu'une review
des best practices ainsi que des applications compétitrices (genre Join ou Frive)."*

Diagnostic uniquement — aucun code modifié pour produire ce document. Distinct de `AUDIT.md`/
`PLAN.md` (racine du repo) : ces deux fichiers datent d'une phase antérieure du projet (avant la
refonte design "Performance Lab", avant le hub Coach, avant même le module Cyclisme actuel — ils
mentionnent encore Botanica comme module séparé et une page `/pricing`, tous deux disparus depuis).
Je ne les ai pas mis à jour ni prolongés : ce document est volontairement scopé au Coach et à jour
par rapport au code réel.

---

## 1. Ce qui existe aujourd'hui (vérifié dans le code, pas dans CLAUDE.md)

`src/app/coach/page.tsx` — un seul onglet actif à la fois, 6 destinations de poids visuel
identique dans la `TabsList` :

| Onglet | Contenu | Fréquence d'usage attendue |
|---|---|---|
| **Plan** (par défaut) | `DailyWorkoutTab` (séance du jour, ajustée depuis le plan) empilé au-dessus de `TrainingPlanTab` (plan périodisé complet), séparés par un simple filet horizontal | Quotidienne |
| **Journal** | Historique fusionné vélo + muscu (30 derniers jours) | Régulière (après une sortie) |
| **Météo & Tenue** | Prévision + recommandation de tenue | Occasionnelle (avant une sortie) |
| **Stella** | Chat IA conversationnel | Variable |
| **Mémoire coach** | Blessures, objectifs, style de vie, faits retenus | Rare (configuration) |
| **Bibliothèque** | Sources ajoutées par l'athlète (études, articles) | Rare (configuration) |

Fait notable, absent de la nav principale : les données de fraîcheur/forme (CTL/ATL/TSB, sommeil,
HRV, readiness — le panneau "Aujourd'hui" à 3 anneaux) vivent sur **une page différente**
(`/cycling`, Vue d'ensemble), pas sur Coach. Pour répondre à "suis-je assez frais pour pousser
aujourd'hui, et que dois-je faire ?", l'athlète visite donc deux destinations de nav distinctes.

Ce n'est pas un oubli — CLAUDE.md documente une longue série de décisions déjà prises et déjà
livrées dans cette direction précise ("Cyclisme redevient purement la page données", "Coach =
planifier/faire/relire une sortie"). Je le note ici comme **tension à trancher consciemment**, pas
comme un bug : ce document va justement questionner si cette séparation tient face à ce que font
les concurrents.

---

## 2. Ce que font les concurrents — recherche réelle, sourcée

Recherche faite via recherche web (les sites `join.cc`/`frive.app`/`apps.apple.com` sont bloqués par
le proxy réseau de ce sandbox — même limitation déjà documentée ailleurs pour `intervals.icu` — donc
ceci s'appuie sur des extraits de recherche indexés, pas une inspection pixel par pixel de chaque
écran. Assez pour une comparaison structurelle sérieuse, pas pour juger la mise en page au pixel
près.)

**Join** ([join.cc](https://join.cc/), coach IA cyclisme, 4.7/5 sur 2.7k avis) — l'écran d'accueil a
été explicitement repensé pour regrouper sur UN SEUL écran : Readiness (ajustable au tap), la séance
du jour, la semaine, et la progression. Une carte "Pending Feedback" surface proactivement les
activités sans RPE et les séances planifiées non confirmées des 7 derniers jours, actionnables en un
tap. Point de friction connu (revue Cyclist + rapport produit tiers) : la navigation devient
confuse dès qu'on cherche une donnée ou un réglage précis en dehors de cet écran d'accueil — Join
gagne sur le geste quotidien, perd sur la profondeur.
Sources : [join.cc/cycling-tips](https://join.cc/cycling-tips/join-home-screen-just-got-a-major-upgrade), [Cyclist review](https://www.cyclist.co.uk/reviews/join-cycling-training-app-review)

**Frive** ([frive.app](https://frive.app/), coaching adaptatif, positionnement plus analytique) —
plan qui se met à jour quotidiennement selon forme/fatigue/disponibilité ; profilage physiologique
poussé (VO2max, puissance critique, profil grimpeur/sprinteur/rouleur) ; chaque sortie est décodée
pour expliquer QUELS systèmes énergétiques ont été travaillés, pas juste "bien joué". Fonctionnalité
de pacing course. Positionnement plus proche de ce que fait déjà `rideAnalysis` dans LifeCycle
(analyse post-sortie) que de sa structure de nav.
Source : [mwm.ai/apps/frive](https://mwm.ai/apps/frive/6473547551)

**TrainerRoad** (référence historique du secteur, pas citée par toi mais incontournable comme point
de comparaison mature) — 4 destinations de nav : Calendrier / Séances / Plans / Appareils, plus un
écran "Career" par défaut qui montre en un coup d'œil : prochaine séance + niveaux de progression +
aperçu du plan + FTP/poids/ratio puissance-poids. Le Calendrier épingle en haut un graphique Training
Stress prévu (gris) vs réalisé (vert) — le plan et le réalisé sont sur LE MÊME graphique, jamais deux
écrans séparés.
Source : [TrainerRoad support — Calendar](https://support.trainerroad.com/hc/en-us/articles/360015831912-TrainerRoad-s-Calendar-What-It-Is-And-How-to-Use-it)

**Motif commun aux trois** : une hiérarchie claire entre écrans à usage QUOTIDIEN (aujourd'hui/
readiness, toujours en façade) et écrans à usage OCCASIONNEL/CONFIGURATION (réglages, profil,
appareils — jamais au même niveau de nav que "aujourd'hui"). Aucun des trois n'expose 6 destinations
de poids égal pour ce périmètre fonctionnel.

---

## 3. Comparaison directe — où LifeCycle s'aligne, où elle diverge

**Déjà aligné (à ne pas casser) :**
- Le bouton flottant Stella (mobile) sort déjà le chat du flux principal plutôt que d'en faire un
  écran de poids égal — exactement l'instinct "coach chat = secondaire" des concurrents.
- `adjustedFromPlan`/`plannedSession` (Proposition du jour qui ajuste le plan plutôt que d'inventer
  dans le vide) est conceptuellement ce que fait Join ("Home puts... today's workout... front and
  center") — le contenu est bon, c'est l'emplacement qui diverge (voir point 1 ci-dessous).
- `rideAnalysis` (analyse post-sortie par système énergétique) couvre déjà ce que Frive met en avant
  comme différenciateur — pas un manque à combler, un point où LifeCycle est déjà compétitive.

**Diverge, à trancher consciemment :**

1. **"Aujourd'hui" est coupé en deux destinations de nav.** Les 3 concurrents traitent
   readiness+séance du jour comme UN SEUL écran d'accueil. LifeCycle les sépare : les anneaux
   Forme/Récupération/Sommeil sur `/cycling`, la séance ajustée sur `/coach`. Le geste quotidien
   ("suis-je frais, que dois-je faire") demande donc deux visites de nav là où les 3 concurrents
   n'en demandent qu'une. *Ce n'est pas un oubli de ce projet — c'est une décision déjà prise et
   documentée plusieurs fois dans CLAUDE.md, dans l'autre sens.* Trancher : soit assumer la
   séparation (Cyclisme = données, Coach = action, une philosophie différente et défendable), soit
   la remettre en question maintenant que 3 concurrents convergent sur le pattern inverse.

2. **Aucun signal proactif "à traiter".** Join surface activement RPE manquants + séances à
   confirmer. LifeCycle a l'équivalent des données (`QuickFeedbackButton`, badges Réalisée/Manquée)
   mais seulement de façon PASSIVE — l'athlète doit remarquer une icône non remplie. Rien
   n'agrège "voici 3 choses à faire" nulle part dans l'app.

3. **Pas de vue "semaine : prévu vs réalisé" en un graphique.** Le Calendrier TrainerRoad épingle
   prévu/réalisé sur le même graphique. LifeCycle a l'équivalent en DEUX affichages séparés : les
   badges par séance (onglet Plan) et la courbe PMC (Cyclisme, CTL/ATL/TSB) — jamais une vue
   compacte "cette semaine, prévu vs fait" au même endroit.

4. **6 onglets de poids égal, dont 2 purement configuration.** Mémoire coach et Bibliothèque n'ont
   d'équivalent dans AUCUN des 3 concurrents examinés (une vraie spécificité LifeCycle, pas un
   manque) — mais les traiter au même niveau de nav qu'un usage quotidien (Plan, Journal) contredit
   le motif commun des 3 apps ("config" toujours démoté). Aucun concurrent n'a d'équivalent direct à
   comparer ici, donc c'est un jugement produit propre à LifeCycle, pas un rattrapage de retard.

---

## 4. Recommandations — à discuter, rien de construit

Classées par ce qu'elles remettraient en cause :

**A. Fusionner "Aujourd'hui" en un seul écran** (readiness + séance du jour) — le changement le
plus fidèle au motif des 3 concurrents, mais celui qui défait le plus de décisions déjà prises et
documentées dans ce projet. Deux façons de le faire sans tout réécrire :
   - Ramener le panneau à 3 anneaux (Forme/Récupération/Sommeil) de Cyclisme en haut de l'onglet
     Plan de Coach, au-dessus de `DailyWorkoutTab` — Cyclisme garde son rôle de page données
     complètes (PMC, budget kJ, gouverneur...), Coach devient le vrai "Aujourd'hui" complet.
   - Ou l'inverse : ramener `DailyWorkoutTab` sur Cyclisme, qui redeviendrait la page d'accueil
     réelle de l'app.
   *Nécessite ton arbitrage — les deux sont défendables, aucune n'est gratuite en réécriture.*

**B. Un bandeau "à traiter" léger** — RPE manquants + séances planifiées non confirmées, en haut de
l'onglet Plan (pas un nouvel écran). Calculable depuis des données déjà en place
(`sessionFeedback`, `matchSessionCompletion`) — un vrai quick win si retenu, contrairement à A.

**C. Vue compacte "semaine : prévu vs réalisé"** sur l'onglet Plan — un petit graphique barres
empilées (planifié en fond, réalisé en avant) plutôt que les deux affichages séparés actuels.
Ampleur moyenne : logique déjà présente (`matchSessionCompletion`, `sessionKJ`), "juste" un nouveau
composant de visualisation.

**D. Démoter Mémoire coach / Bibliothèque** hors de la rangée d'onglets principale — par exemple
accessibles depuis un menu "⋯" ou depuis Stella elle-même ("Stella se souvient de..." → lien),
plutôt que deux onglets de poids égal à Plan/Journal. Réduit 6 onglets à 4, sans rien supprimer.

---

## 5. Complément UI/visuel — retour utilisateur : "là tu me parles de structure mais le côté UI est à revoir également"

Les sections précédentes portaient sur l'architecture de l'information (quels écrans, quels onglets).
Celle-ci porte sur le rendu visuel lui-même — inspection du code des deux composants les plus
consultés de Coach (`daily-workout-tab.tsx`, `training-plan-tab.tsx`), pas une capture d'écran réelle
(voir la limite déjà documentée : le serveur de dev de ce sandbox échoue sur toute page à cause d'un
bug de décodage `favicon.ico` préexistant, sans rapport avec ce diagnostic).

**Constat principal : Coach n'utilise quasiment jamais `.lc-card`, la carte canonique du design
system "Performance Lab".** `globals.css` définit `.lc-card` comme `rounded-[18px] border
border-border/60`, une ombre douce à deux niveaux, et un lift au survol (`hover:-translate-y-[1px]`)
— c'est ce que les tuiles Vue d'ensemble, les widgets Budget/Gouverneur et toutes les pages détail
construites cette session utilisent. `daily-workout-tab.tsx`/`training-plan-tab.tsx` utilisent à la
place, de façon répétée, deux combinaisons ad hoc :
- `bg-card/60 border-primary/20 border-2` — le `Card` shadcn par défaut (`rounded-lg`, `shadow-sm`,
  aucun lift) avec une bordure épaisse teintée primaire par-dessus. Utilisé au moins 3 fois dans le
  parcours "Plan" : la carte séance muscu (`StrengthSessionCard`, ligne 48), la carte proposition IA
  générée (`daily-workout-tab.tsx:394`), et la carte résumé du plan actif (`training-plan-tab.tsx:247`).
- `bg-card/40 border-border` — le formulaire de disponibilité (`daily-workout-tab.tsx:214`), le
  Journal (`rides-journal-tab.tsx:97`).

Résultat concret : en scrollant l'onglet Plan, l'athlète croise 3-4 cartes à bordure épaisse teintée
primaire d'affilée (séance muscu OU proposition IA, puis plus bas le résumé du plan actif) — **la
même intensité visuelle appliquée à plusieurs blocs différents ne hiérarchise plus rien**. Rien ne
distingue visuellement "voici ce qu'il faut faire maintenant" de "voici un résumé pour information".
C'est exactement le même symptôme que `AUDIT.md` avait déjà documenté ailleurs dans l'app il y a
plusieurs mois ("trois langages de carte différents pour le même concept") — Coach a été construit
après ce constat, avec son propre système ad hoc, sans jamais adopter `.lc-card`.

**Autres observations, plus mineures :**
- Trois `Collapsible` imbriqués dans la carte de proposition IA (rationale / raisonnement / script
  structuré) — cohérent avec "donner accès au détail sans l'imposer", mais ajoute de la profondeur
  d'interaction à un écran dont le rôle principal (façon Join) est justement le coup d'œil rapide.
- Aucune des deux pages n'utilise le halo `ring-2 ring-primary/50` maintenant établi ailleurs pour
  signaler "l'élément actif/à traiter en ce moment" (utilisé ce mois-ci dans le suivi en direct
  muscu pour l'exercice courant) — un vocabulaire déjà inventé dans l'app, pas repris ici alors que
  "quelle est LA chose à faire maintenant" est exactement la question que cet écran doit répondre en
  un coup d'œil.

**Recommandation, non construite** : migrer `StrengthSessionCard`, la carte de proposition IA
générée, et la carte résumé du plan actif vers `.lc-card`, et réserver la bordure primaire épaisse à
UN SEUL élément par écran — la séance concrète du jour, la seule chose qui justifie vraiment
l'emphase visuelle maximale sur cet onglet. Le formulaire de disponibilité et le résumé du plan actif
redeviennent des `.lc-card` neutres, hiérarchiquement secondaires. Ampleur : moyenne — pas une
réécriture, un remplacement de classes sur ~4-5 blocs, mais qui mérite d'être fait en une fois plutôt
que fragmenté (risque de rendre les deux fichiers encore plus incohérents entre eux si fait à moitié).

## 6. Ce qui a été construit suite à cet audit

- **§4.B — Bandeau "à traiter"** (`pending-feedback-banner.tsx`) : sorties Intervals.icu des 7
  derniers jours sans RPE (ni sur Intervals.icu lui-même, ni en local), affichées en haut de l'onglet
  Plan avec action inline (réutilise `QuickFeedbackButton`, aucune nouvelle saisie créée). Scope
  volontairement limité au vélo — une séance muscu capture déjà son RPE au moment de la logger, il
  n'existe pas de geste rétroactif pour la muscu aujourd'hui, l'inclure aurait pointé vers une action
  qui n'existe pas.
- **§4.D — Démotion Mémoire coach/Bibliothèque** : sorties de la `TabsList` principale (passée de 6 à
  4 déclencheurs visibles), regroupées dans un menu "Plus" (`DropdownMenu`). Les deux restent de
  vrais onglets (même valeur, même `TabsContent`, deep-link `?tab=memory`/`?tab=library` inchangé) —
  seul leur déclencheur change de forme. Le bouton "Plus" s'illumine (même traitement `data-[state=
  active]` que les onglets) quand l'un des deux est actif, pour ne pas perdre le repère "où suis-je".

Non construit : §4.A (fusion "Aujourd'hui") et §4.C (vue prévu/réalisé) restent en attente
d'arbitrage — voir section 4 ci-dessus.

## 7. Ce que cet audit ne tranche pas

B et D sont construits (section 6). A reste structurel et mérite d'être décidé consciemment avant
d'y toucher, vu le nombre de décisions déjà prises dans l'autre sens et documentées dans CLAUDE.md ;
C reste une amélioration d'ampleur moyenne, non urgente. Le remplacement de cartes recommandé en
section 5 (`.lc-card` sur les 4-5 blocs identifiés) n'est pas construit non plus — même statut que C,
en attente de ton feu vert. Je n'ai pas non plus pu inspecter les apps concurrentes écran par écran
(accès direct bloqué) — la comparaison ci-dessus est fiable sur la structure et les motifs, pas sur
des détails de mise en page au pixel près.
