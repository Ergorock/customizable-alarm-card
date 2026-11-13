# Passages prévus et caméras multiples — conception

## Intention

Désarmer l'alarme de façon préventive quand quelqu'un doit passer à la maison à une heure connue
(femme de ménage, famille, artisan), en l'indiquant directement depuis la carte, et la réarmer à la fin.
Afficher plusieurs caméras, chacune avec son mode privé, comme la caméra unique d'aujourd'hui.

## Objectifs

- Depuis la carte : lister les prochains passages, en ajouter un (titre, début, fin), en supprimer un.
- Un passage est un événement d'un calendrier HA dédié ; une automatisation HA désarme au début et réarme à la fin,
  même tablette éteinte.
- Plusieurs caméras, chacune avec son interrupteur de mode privé optionnel (aperçu flouté quand il est `on`).

## Non-objectifs

- Pas d'événements récurrents créés depuis la carte (ils restent possibles depuis l'interface Calendrier de HA).
- Pas d'édition d'un passage existant : on supprime et on recrée.
- La carte ne crée ni ne modifie d'automatisation (pas besoin d'un compte administrateur).

## Anti-objectifs

- Un rendez-vous ordinaire d'un agenda personnel ne doit jamais désarmer l'alarme → calendrier dédié.
- Ne jamais écraser une action manuelle : pas de réarmement si l'alarme n'est plus désarmée à la fin du passage.
- Ne jamais désarmer/réarmer une alarme qui était déjà désarmée au début (quelqu'un est à la maison).

## Approches

- **A. Automatisation + helper mémoire (retenue).** Au début : si l'alarme est armée, mémoriser son état dans un
  `input_text`, puis désarmer. À la fin : si le helper contient un mode et que l'alarme est `disarmed`, réarmer dans
  ce mode, puis vider le helper. Résiste à un redémarrage de HA.
- **B. Automatisation qui attend la fin** (`wait_for_trigger`). Rien à créer de plus, mais un redémarrage pendant le
  passage perd l'attente et l'alarme n'est jamais réarmée. Écartée.
- **C. La carte réarme elle-même.** Ne fonctionne que page ouverte. Écartée.

## Ce qui est décidé

### Côté Home Assistant
- Calendrier local dédié « Alarme » (intégration Local Calendar).
- Helper `input_text.alarme_mode_avant_passage`.
- Blueprint `blueprints/automation/alarm_planned_visit.yaml` dans le dépôt, entrées : entité alarme, calendrier,
  helper. Déclencheurs `calendar` début et fin (offset 0). Réarmement via `alarm_control_panel.alarm_arm_<mode>`
  selon l'état mémorisé. Mode `queued`.
- Une automatisation créée depuis ce blueprint dans l'instance de Matthieu.

### Côté carte
- Option `visits_calendar` (entité `calendar`). Section « Passages prévus » affichée seulement si elle est définie.
- Liste des événements des 30 prochains jours (`calendar.get_events` avec réponse), triés, avec titre, date et
  heures ; le passage en cours est mis en évidence.
- Bouton « Ajouter » → formulaire en surimpression : titre (défaut « Passage »), date, heure de début, heure de fin.
  Création via `calendar.create_event`.
- Suppression via `calendar/event/delete` (websocket), avec confirmation par second tap comme les modes.
- Option `cameras` : liste de `{ entity, name, privacy_entity }`. `camera_entity` / `camera_name` /
  `privacy_entity` restent acceptés et sont traités comme une liste d'une caméra. `camera_refresh` reste global.
- Affichage : une caméra = pleine largeur ; plusieurs = grille de 2 colonnes (1 colonne sous 520 px).
- Éditeur : nouvelle liste « Caméras » (même interface que modes et pastilles) et champ calendrier des passages.
- Textes en anglais et français, comme le reste de la carte. README (en et fr) mis à jour.

## Laissé au constructeur (mes choix, modifiables)
- Nombre maximal de passages affichés : 5.
- Rafraîchissement de la liste : à l'ouverture de la carte, après ajout/suppression, et quand l'état du calendrier change.
- La suppression utilise l'`uid` renvoyé par `get_events` ; si le calendrier ne le fournit pas, pas de bouton supprimer.
