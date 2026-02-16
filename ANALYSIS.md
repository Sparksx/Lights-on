# Analyse du projet Light - Propositions d'ameliorations

Analyse complete du jeu Light (PWA clicker/incremental) : gameplay, game design, UI/UX et performance.

---

## 1. Gameplay & Game Design

### 1.1 Absence de revenus hors-ligne (offline earnings)

**Fichier** : `game.js:4225-4243` (initGame) et `game.js:4111-4139` (load)

**Probleme** : Quand le joueur ferme le jeu et revient, il ne gagne rien pendant son absence. Pour un jeu idle/incremental, c'est une fonctionnalite fondamentale. Le joueur qui a investi dans des upgrades passifs s'attend a accumuler des lumens meme hors-ligne.

**Proposition** : Sauvegarder un timestamp dans `save()`. Au `load()`, calculer le temps ecoule et crediter `lumensPerSecond * elapsedSeconds` (eventuellement plafonne ou avec un rendement reduit, par ex. 50% du taux reel). Afficher un ecran "Pendant votre absence, vous avez gagne X lm" au retour.

---

### 1.2 Aucun jalon ni achievement intermediaire

**Fichier** : `game.js:2861-2869` (checkMilestones)

**Probleme** : La seule milestone est le deblocage du panneau d'upgrades a 50 lumens. Ensuite, la progression jusqu'a 1 trillion se fait sans aucun retour intermediaire. La barre de progres en bas est trop fine et discrete pour creer un sentiment d'accomplissement.

**Proposition** : Ajouter des milestones visuelles a des seuils cles (1K, 10K, 100K, 1M, 10M, 100M, 1B, 100B...) avec une notification visuelle sur le canvas (texte anime qui apparait puis disparait). Potentiellement debloquer des effets visuels cosmetiques a certains paliers.

---

### 1.3 Pas de systeme de prestige / New Game+

**Fichier** : `game.js:3057-3080` (triggerVictory, restart)

**Probleme** : Apres la victoire, le seul choix est "Recommencer" qui efface tout. Le joueur n'a aucune raison de rejouer. Un systeme de prestige est standard dans les jeux incrementaux pour la rejouabilite.

**Proposition** : Ajouter un mecanisme de prestige : apres la victoire (ou volontairement en mid-game), le joueur peut "reset" mais conserve un multiplicateur permanent base sur les lumens totaux atteints. A chaque prestige, la progression est plus rapide, avec potentiellement de nouveaux upgrades ou effets visuels debloques exclusivement via le prestige.

---

### 1.4 Le systeme de combo est invisible pour le joueur

**Fichier** : `game.js:1998-2062` (combo system)

**Probleme** : Le systeme de combo (x1.5 a x5) est une bonne mecanique, mais aucun element d'UI persistant n'indique le combo actuel. Le joueur ne sait pas qu'il existe un multiplicateur, ni combien de clics il faut pour l'atteindre. Le `combo-text` halo est un indicateur ephemere mais il n'est jamais ajoute (aucun appel a creer un halo de type `combo-text` n'existe dans le code).

**Proposition** :
- Afficher un compteur de combo permanent sur le canvas (en haut a gauche par ex.) quand le multiplicateur est > 1
- Afficher le multiplicateur courant (x1.5, x2, x3, x5) avec une animation
- Ajouter un timer visuel montrant le temps restant avant la perte du combo (`COMBO_DECAY = 2000ms`)
- Activer le halo `combo-text` qui existe deja dans le renderer mais n'est jamais utilise

---

### 1.5 Pas d'affichage du revenu passif (lm/s)

**Fichier** : `game.js:2871-2875` (updateUI)

**Probleme** : Le `lumensPerSecond` est calcule et utilise en interne, mais jamais affiche au joueur. C'est une information fondamentale pour un jeu idle : savoir combien on gagne par seconde guide les decisions d'achat.

**Proposition** : Ajouter le taux `/s` a cote du compteur de lumens dans le header du panneau, et/ou l'afficher de maniere permanente sur le canvas principal. Format : `+X.X lm/s`.

---

### 1.6 Les upgrades "burst" ne scalent pas assez en fin de jeu

**Fichier** : `game.js:3121-3151` (spawnLightBurst)

**Probleme** : Le bonus des orbes collectibles est base sur `state.totalLumens * (0.03 + cometCount * 0.005)`. En fin de jeu, les revenus passifs eclipsent completement les orbes. Un joueur avec 100B lm/s n'a aucune raison de cliquer sur un orbe qui donne 0.5% de ses gains totaux.

**Proposition** : Faire scaler le bonus des orbes sur le revenu passif plutot que les lumens totaux, ou ajouter un multiplicateur exponentiel pour les orbes en fin de partie. Alternative : les orbes pourraient donner des bonus temporaires (x2 revenu passif pendant 10s) plutot que des lumens bruts.

---

### 1.7 Aucune synergie entre les upgrades

**Probleme** : Les 24 upgrades sont purement additifs et lineaires. Il n'y a aucune interaction entre eux. Dans les bons jeux incrementaux, les combinaisons d'upgrades creent des synergies qui recompensent la strategie.

**Proposition** : Ajouter des bonus de synergie. Exemples :
- Etoile + Constellation : bonus passif x1.2 quand les deux sont achetes
- Pulsar + Eclair : chaque clic a une chance de declencher un mini-pulsar
- Supernova + Nebuleuse : chaque supernova augmente temporairement le taux de la nebuleuse
- Cela ne necessite pas de changement structurel majeur : un tableau de synergies et un recalcul dans `recalcPassive()`

---

### 1.8 Le mode OFF manque de differences mecaniques

**Probleme** : Le mode OFF a une identite visuelle magnifiquement distincte (effets de vide, fissures, trou noir...) mais la mecanique de jeu est strictement identique. Les couts, valeurs et progression sont les memes.

**Proposition** : Differencier legerement la mecanique entre les modes :
- Mode OFF : progression plus lente mais revenus passifs plus forts (univers qui se degrade lentement)
- Mode ON : progression par clics plus rapide mais passifs plus faibles (effort actif pour maintenir la lumiere)
- Ou : des upgrades exclusifs a chaque mode, ou un upgrade "miroir" qui offre un effet different selon le mode

---

### 1.9 L'introduction est en anglais

**Fichier** : `game.js:4195-4204` (showIntro)

**Probleme** : Les textes de l'intro sont en anglais ("The light is dying...", "Save me...") alors que tout le reste du jeu est en francais. Incoherence linguistique.

**Proposition** : Traduire en francais :
- Mode ON : "La lumiere s'eteint..." / "Sauvez-moi..."
- Mode OFF : "L'obscurite s'efface..." / "Sauvez-moi..."

---

### 1.10 Le bouton Reset n'a aucune confirmation

**Fichier** : `game.js:3074-3080` (resetBtn)

**Probleme** : Un clic sur Reset efface immediatement la sauvegarde et recharge la page. Sur mobile, un appui accidentel peut detruire des heures de progression.

**Proposition** : Ajouter une confirmation (double-clic, ou un prompt "Etes-vous sur ?"). Alternativement, un mecanisme de "hold to reset" (maintenir appuye 3 secondes).

---

## 2. UI / UX

### 2.1 Le panneau d'upgrades est quasi-invisible au debut

**Fichier** : `style.css:163-194` (#upgrade-toggle) et `game.js:2861-2869` (checkMilestones)

**Probleme** : Le bouton d'acces au panneau est un point blanc de 8px qui "respire" subtilement. Un nouveau joueur peut ne jamais le decouvrir. La premiere milestone a 50 lumens le rend visible, mais il n'y a aucun guidage.

**Proposition** :
- Ajouter une animation d'apparition plus visible a la premiere fois (le point grossit, pulse plus fort, ou une fleche/texte discret "^" apparait brievement)
- Ouvrir automatiquement le panneau la premiere fois que le joueur debloque les upgrades

---

### 2.2 Le panneau ne montre qu'un seul upgrade futur

**Fichier** : `game.js:2789-2858` (renderUpgrades)

**Probleme** : La logique `nextShown` fait qu'un seul upgrade non achete est visible a la fois. Le joueur ne peut pas voir ce qui vient apres ni planifier ses achats. Cela reduit la strategic et la motivation ("je vais economiser pour X").

**Proposition** : Montrer 2-3 upgrades futurs debloques (locked mais visibles avec leur cout), ou au minimum montrer tous les upgrades dont le `unlockAt` est atteint. Garder les upgrades lointains caches pour maintenir le mystere.

---

### 2.3 Aucun compteur de lumens en dehors du panneau

**Probleme** : Le compteur de lumens (`#lumen-counter`) est uniquement dans le header du panneau d'upgrades. Quand le panneau est ferme, le joueur ne voit que la barre de progression ultra-fine en bas. Il n'a aucune idee de ses lumens courants.

**Proposition** : Ajouter un compteur discret mais permanent dans un coin de l'ecran (par ex. en bas a gauche), avec le total actuel et le taux `/s`. Cela donnerait un feedback constant sans ouvrir le panneau.

---

### 2.4 Pas de notification de nouvel upgrade disponible

**Probleme** : Quand le joueur atteint le seuil `unlockAt` d'un nouvel upgrade, rien ne se passe visuellement. Il doit ouvrir le panneau pour decouvrir qu'un nouvel item est disponible.

**Proposition** : Ajouter un indicateur visuel sur le bouton d'upgrade toggle (ex: un petit badge/point colore) quand un nouvel upgrade est achetable. Potentiellement une notification canvas ephemere "Nouvel upgrade disponible".

---

### 2.5 Pas d'ecran de statistiques

**Probleme** : Aucune statistique n'est accessible : temps de jeu, nombre de clics, lumens totaux generes, upgrades achetes, combos max, etc. C'est un element standard des jeux incrementaux qui augmente l'engagement.

**Proposition** : Ajouter un onglet "Stats" dans le panneau d'upgrades ou un ecran accessible via un second bouton. Tracker et afficher les metriques principales.

---

### 2.6 Le formatage des nombres utilise des suffixes anglophones

**Fichier** : `game.js:4142-4148` (formatNumber)

**Probleme** : Les suffixes sont K, M, B, T (anglais). En francais, "B" est "Md" (milliard). Pour un jeu entierement en francais, c'est une incoherence.

**Proposition** : Utiliser K, M, Md, T ou les equivalents francais. Alternative : garder K/M/B/T car ils sont devenus universels dans les jeux, mais c'est un choix de design a arbitrer.

---

### 2.7 Le panneau d'upgrades se ferme automatiquement

**Fichier** : `game.js:2763-2766` (buyUpgrade)

**Probleme** : Apres un achat, si aucun autre upgrade n'est abordable, le panneau se ferme automatiquement. Cela peut etre frustrant si le joueur voulait consulter ses upgrades ou voir le prochain objectif.

**Proposition** : Supprimer la fermeture automatique, ou la rendre optionnelle. Le joueur peut fermer le panneau lui-meme.

---

## 3. Performance

### 3.1 Le tableau `halos` peut croitre sans controle

**Fichier** : `game.js:1502` et `game.js:1599-1612` (updateHalos)

**Probleme** : Chaque clic cree 5+ halos (glow + 3 rings + persist). En click rapide, le tableau peut atteindre des centaines d'elements. `splice()` dans la boucle de suppression est O(n) par operation, et les iterations de `drawHalos()` dessinent chaque element individuellement avec des gradients.

**Proposition** :
- Limiter le nombre maximum de halos actifs (ex : 150) et supprimer les plus anciens quand le seuil est atteint
- Utiliser un object pool pour eviter les allocations/deallocations
- Regrouper les halos similaires qui se chevauchent pour reduire les draw calls

---

### 3.2 Gradients recrees a chaque frame

**Fichier** : `game.js:1615-1870` (drawHalos), `game.js:825-970` (drawPulsar), etc.

**Probleme** : Chaque `createRadialGradient` et `createLinearGradient` alloue un nouvel objet canvas a chaque frame pour chaque element visuel. Sur mobile avec 80 etoiles + 50 halos + pulsar + constellations, cela cree des centaines d'allocations par frame.

**Proposition** :
- Pour les etoiles (positions fixes, seul l'alpha change) : pre-render des sprites dans un canvas off-screen et les dessiner avec `drawImage` + `globalAlpha`
- Pour les effets repetitifs : cacher les gradients quand les parametres sont identiques
- Utiliser `ctx.globalAlpha` plutot que de reconstruire des couleurs rgba a chaque fois

---

### 3.3 `regenerateStars()` appele a chaque frame

**Fichier** : `game.js:4153` (gameLoop)

**Probleme** : `regenerateStars()` est appele a chaque frame dans le game loop. Bien qu'il ait un early return quand le nombre n'a pas change, cet appel reste superflu 99.99% du temps.

**Proposition** : Appeler `regenerateStars()` uniquement quand un upgrade `star` ou `constellation` est achete (c'est deja fait dans `buyUpgrade` a la ligne 2758, l'appel dans le game loop est redondant).

---

### 3.4 Pas de culling pour les elements hors ecran

**Probleme** : Les particules du Big Bang, du Black Hole, les bolts et les halos sont dessines meme quand ils sont completement hors ecran (apres explosion/expansion). Le canvas ne clip pas automatiquement ces draws.

**Proposition** : Ajouter une verification de bounds avant de dessiner chaque element : si `x + radius < 0` ou `x - radius > canvas.width` (idem pour Y), skip le draw.

---

### 3.5 Pas de limitation du frame rate

**Probleme** : Le jeu tourne a `requestAnimationFrame` natif, soit potentiellement 120fps sur les ecrans modernes. Pour un jeu clicker, 60fps est plus que suffisant. Sur mobile, le double de frames consomme le double de batterie.

**Proposition** : Ajouter un throttle optionnel via un delta-time check au debut de `gameLoop()`. Si moins de 16ms se sont ecoules, skip le frame. Ou utiliser `requestAnimationFrame` avec un compteur de frames pour ne dessiner qu'un frame sur deux sur les ecrans 120Hz.

---

### 3.6 `splice()` dans les boucles inverses est correct mais lent

**Fichier** : Multiples — `updateHalos`, `updateLightBursts`, `updatePrismRays`, `updateLightningBolts`, `updateConstellations`, `updateAcExplosion`

**Probleme** : `Array.splice(i, 1)` est O(n) car il doit decaler tous les elements apres l'index. Avec des tableaux de 50-200+ elements, et plusieurs splice par frame, cela s'additionne.

**Proposition** : Utiliser la technique du "swap and pop" : deplacer le dernier element a l'index a supprimer puis `pop()`. C'est O(1). L'ordre n'est pas important pour le rendu de ces systemes de particules.

---

### 3.7 Le rendu du Pulsar cree des contextes sauvegardes en boucle

**Fichier** : `game.js:917-970` (drawPulsar, ON mode)

**Probleme** : Pour chaque orbite du pulsar, `ctx.save()` / `ctx.translate()` / `ctx.rotate()` / `ctx.restore()` est appele. Avec 4 orbites, c'est 4 sauvegardes/restaurations de contexte par frame.

**Proposition** : Calculer les positions des etoiles du pulsar mathematiquement (sans transformation de contexte) en utilisant des formules de rotation directes. Cela evite les cout de save/restore du contexte canvas.

---

## 4. Bugs et incoherences mineures

### 4.1 Le halo `combo-text` est implemente mais jamais cree

**Fichier** : `game.js:1653-1661`

Le type `combo-text` est gere dans `drawHalos()` mais aucun code ne cree de halo de ce type. C'est probablement un vestige d'une fonctionnalite prevue mais jamais cablée.

### 4.2 La condition de clear canvas est identique dans les deux branches

**Fichier** : `game.js:4171-4176`

```javascript
if (gameMode === 'off') {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
} else {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
```

Les deux branches font exactement la meme chose. Le commentaire explique l'intention (transparence en mode off) mais le code est un simple duplicata.

### 4.3 `constellationTracedEdges` est maintenu mais jamais lu

**Fichier** : `game.js:526`

La variable `constellationTracedEdges` est declaree, remplie dans `startConstellationDrag`, et videe dans `endConstellationDrag`, mais n'est jamais lue ni utilisee dans la logique de jeu.

---

## 5. Priorites recommandees

### Impact fort / Effort faible
1. Traduire l'intro en francais (bug d'incoherence)
2. Afficher le compteur de lumens + lm/s en permanence
3. Corriger le clear canvas duplique
4. Ajouter une notification d'upgrade disponible
5. Supprimer l'appel redondant a `regenerateStars()` dans le game loop

### Impact fort / Effort moyen
6. Revenus hors-ligne (offline earnings)
7. Jalons/milestones intermediaires avec feedback visuel
8. Montrer le combo actuel dans l'UI
9. Montrer 2-3 upgrades futurs
10. Confirmer le Reset

### Impact fort / Effort eleve
11. Systeme de prestige / New Game+
12. Synergies entre upgrades
13. Optimisation des gradients (sprites pre-rendus)
14. Object pool pour les halos

### Impact moyen / Effort moyen
15. Ecran de statistiques
16. Limiter le nombre de halos simultanes
17. Culling hors-ecran
18. Swap-and-pop pour les splice
19. Bonus temporaires sur les orbes
20. Throttle du framerate sur 120Hz
