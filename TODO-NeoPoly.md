# NeoPoly To-Do

## Fait recemment

- [x] Correction de l'erreur JS `input is null` dans `assets/game-core.js`.
- [x] Stockage serveur des feedbacks via `POST /api/feedback` dans `data/feedback.json`.
- [x] Affichage des photos de profil dans le leaderboard quand `avatarImg` existe.
- [x] Remplacement des derniers dialogues `prompt()` utiles par une modale admin in-game.
- [x] Reequilibrage de la boutique power-ups (prix, limites/tour, disponibilite, cooldowns).
- [x] Retours visuels plus clairs sur les bonus actifs et meilleure UI de ciblage pour `quickBuild` / `sabotage`.
- [x] Push Git effectue sur `main`.

## Priorite actuelle

- [~] Redeployer sur Render et verifier le site en production (push fait, propagation en cours).
- [~] Endpoint feedback de prod joignable (`message_required` confirme sans ecrire de faux test).
- [ ] Verifier sur le site live l'affichage des avatars photo dans le classement.
- [ ] Confirmer l'absence d'erreurs console au chargement.

## Backlog / a faire

- [x] Remplacer les dialogues `prompt()` restants par des modales ou listes in-game coherentes.
- [x] Equilibrer la boutique power-ups: prix, limites par tour, disponibilite, cooldowns.
- [~] Valider en conditions reelles la synchro multijoueur des power-ups pendant une partie active.

## A ameliorer

- [ ] Continuer a sortir la logique addons du gros `test1.html` pour limiter les regressions.
- [x] Ajouter des retours visuels plus clairs sur les power-ups actifs du joueur courant.
- [x] Ajouter une UI de ciblage plus riche pour les actions offensives et de construction.

## Addons

- [x] Bouton Addons: corrige.
- [x] Addon `powerups`: integre au pack manager, au fallback et a la synchro serveur.
- [~] Boutique power-ups: fonctionnelle, reequilibree, reste a peaufiner sur l'UX finie.