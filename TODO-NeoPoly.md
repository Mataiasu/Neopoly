# NeoPoly To-Do

## ✅ Fait récemment

- [x] Correction de l'erreur JS `input is null` dans `assets/game-core.js`
- [x] Stockage serveur des feedbacks via `POST /api/feedback` dans `data/feedback.json`
- [x] Ajout du panneau admin `📬 Feedback joueur`
- [x] Affichage des photos de profil dans le leaderboard quand `avatarImg` existe
- [x] Remplacement des derniers `prompt()` utiles par des modales admin in-game
- [x] Rééquilibrage de la boutique power-ups (prix, limites/tour, disponibilité, cooldowns)
- [x] Retours visuels plus clairs sur les bonus actifs et meilleure UI de ciblage
- [x] Correction de la boucle de rendu console entre `renderPlayers()` et `renderMatchItemsUi()`

---

## 🚀 Phase 1 — Court terme
**Objectif :** stabiliser le jeu, améliorer l'UX et rendre l'admin plus efficace.

### Production / vérifications live
- [~] Redéployer sur Render et vérifier la prod après les derniers pushs
- [~] Vérifier sur le site live le bouton admin `⚙️ Debug`
- [~] Vérifier sur le site live le panneau `📬 Feedback joueur`
- [ ] Confirmer l'absence d'erreurs console au chargement
- [ ] Vérifier l'affichage des avatars photo dans le leaderboard live

### Feedback & administration
- [x] Ajouter une recherche dans `Feedback joueur`
- [x] Ajouter des filtres par type, pseudo et date
- [x] Ajouter un statut `non lu / en cours / traité`
- [x] Ajouter un bouton `archiver / supprimer` pour les feedbacks
- [x] Ajouter un badge de notification admin si nouveau feedback

### UX / qualité de vie
- [x] Améliorer les messages d'erreur réseau et session
- [x] Mieux guider les nouveaux joueurs dans le lobby
- [x] Rendre le profil plus lisible sur mobile
- [x] Mieux organiser le panneau debug admin par sections
- [x] Ajouter un petit historique des dernières parties jouées

### Online / stabilité
- [x] Améliorer la reconnexion automatique en salon online
- [~] Vérifier les cas de reprise après coupure réseau
- [x] Réduire les risques d'actions envoyées en double
- [~] Valider en conditions réelles la synchro multijoueur des power-ups

---

## 📈 Phase 2 — Moyen terme
**Objectif :** améliorer la rétention, la progression et l'aspect social.

### Progression / ranked
- [ ] Ajouter un historique ELO plus détaillé
- [ ] Ajouter un écran de fin de partie ranked plus complet
- [ ] Mieux afficher les divisions et la progression entre paliers
- [ ] Ajouter plus de titres, badges et récompenses visuelles

### Saisons / missions
- [ ] Enrichir les défis du jour
- [ ] Enrichir les missions hebdo
- [ ] Ajouter des objectifs saisonniers plus ambitieux
- [ ] Créer des récompenses saisonnières exclusives

### Profil / social
- [ ] Améliorer le profil public partageable
- [ ] Ajouter un vrai statut amis `en ligne / lobby / en partie`
- [ ] Ajouter des notifications quand un ami se connecte
- [ ] Rendre le chat social plus vivant et mieux modéré

### Boutique / contenu
- [ ] Ajouter de nouveaux cosmétiques (emojis, avatars, effets)
- [ ] Ajouter des rotations d'objets / raretés dans la boutique
- [ ] Ajouter une meilleure prévisualisation avant achat
- [ ] Peaufiner l'UX finale de la boutique power-ups

---

## 🌟 Phase 3 — Grosse mise à jour
**Objectif :** sortir une vraie grosse MAJ marquante pour NeoPoly.

### Refonte majeure gameplay / online
- [ ] Repenser l'expérience ranked pour la rendre plus compétitive
- [ ] Ajouter un ou plusieurs nouveaux modes de jeu marquants
- [ ] Créer des événements temporaires / live
- [ ] Ajouter un meilleur résumé intelligent de fin de partie

### Refonte visuelle / polish
- [ ] Moderniser encore le lobby principal
- [ ] Refaire certaines modales clés avec une UI premium
- [ ] Ajouter plus d'animations contextuelles et de feedback visuel
- [ ] Uniformiser tout le style UI du jeu

### Technique / maintenance
- [ ] Continuer à sortir la logique du gros `test1.html`
- [ ] Mieux séparer les modules UI / online / admin / profil
- [ ] Créer des helpers communs pour réduire les régressions
- [ ] Ajouter plus de vérifications automatiques côté serveur

### Administration avancée
- [ ] Dashboard admin plus complet
- [ ] Outils de modération plus rapides
- [ ] Historique des actions admin
- [ ] Export JSON / CSV des feedbacks et données utiles

---

## 🧩 Addons
- [x] Bouton Addons corrigé
- [x] Addon `powerups` intégré au pack manager, au fallback et à la synchro serveur
- [ ] Peaufiner l'expérience utilisateur du pack manager
- [ ] Ajouter de nouveaux addons à fort impact gameplay
- [ ] Améliorer la présentation visuelle des addons installés

---

## 🎯 Top priorités immédiates
- [ ] Redéploiement Render + vérification prod
- [ ] Filtres + statuts dans `Feedback joueur`
- [ ] Reconnexion online plus robuste
- [ ] Historique des parties
- [ ] Amélioration UX mobile / lobby
