# Passages prévus et caméras multiples — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à la carte une section « Passages prévus » (calendrier HA dédié, désarmement au début, réarmement à la fin via un blueprint) et remplacer la caméra unique par une liste de caméras, chacune avec son mode privé.

**Architecture:** La carte reste un seul fichier JS sans dépendance. Les passages sont des événements d'un calendrier local HA, lus et écrits par la carte via les services `calendar.*`. Le désarmement et le réarmement sont faits par une automatisation HA (blueprint du dépôt), qui mémorise le mode dans `input_text.alarme_mode_avant_passage`.

**Tech Stack:** JavaScript ES modules (sans build), Home Assistant (calendar, alarm_control_panel, input_text, blueprints YAML), Local Calendar.

**Spec:** [docs/superpowers/specs/2026-11-13-passages-cameras-design.md](../specs/2026-11-13-passages-cameras-design.md)

## Global Constraints

- Aucune dépendance externe ni étape de build : un seul fichier `customizable-alarm-card.js`.
- Textes en anglais et en français (`STRINGS`), la langue suit Home Assistant.
- Calendrier dédié : `calendar` local nommé « Alarme ». Aucun autre calendrier n'est modifié.
- Helper mémoire : `input_text.alarme_mode_avant_passage` (exact).
- Une action de la carte ne demande pas de compte administrateur : seulement `calendar.*` et `alarm_control_panel.*`.
- La carte ne crée ni ne modifie d'automatisation.
- Tout doit rester lisible à 375 px de large, sans défilement horizontal.
- Mode de réarmement autorisé : `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`.

## Review Focus

1. **Événement sans heure de fin** (évènement « journée entière » ou mal saisi) : la carte ne doit pas planter ; l'affichage reste lisible. Test T3-4.
2. **Calendrier indisponible ou entité absente** : la section affiche un message d'erreur, pas de liste vide trompeuse ni exception. Test T4-3.
3. **Caméra référencée absente** : une caméra manquante affiche « ? » sans casser les autres. Test T1-3.
4. **Alarme armée au début, puis changée à la main pendant le passage** : l'automatisation ne réarme pas. Test T5-2 (vérification manuelle décrite).
5. **Redémarrage de HA pendant un passage** : le helper garde le mode, la fin réarme. Test T7-3.

## File Structure

- Modify: `customizable-alarm-card.js` — toute la logique carte (caméras, passages, éditeur).
- Create: `blueprints/automation/alarm_planned_visit.yaml` — automatisation réutilisable.
- Modify: `README.md`, `README.fr.md` — options et installation.
- Test harness (hors dépôt) : `C:\Users\mdalion\AppData\Local\Temp\claude\C--Users-mdalion-Documents-Dev-perso-alarme-card\0d32886b-4137-4c5d-b6e9-5557846d1067\scratchpad\demo.html` (page de démonstration existante, avec un faux `hass`). Chaque tâche de carte la met à jour puis la vérifie dans le navigateur de l'aperçu.

---

## Tâches

### Task 1: Liste de caméras (normalisation et affichage)

**Files:**
- Modify: `customizable-alarm-card.js` (`setConfig`, `_relevantEntities`, `_renderCamera`, `_updateCameraImage`, `getCardSize`, `STYLES` section caméra)

**Interfaces:**
- Consumes: rien.
- Produces: `normalizeCameras(config) -> Array<{entity: string, name?: string, privacy_entity?: string}>` (fonction de module). Accepte `cameras` (liste) ; si absent, transforme `camera_entity` / `camera_name` / `privacy_entity` en une liste d'une caméra. `this._cameras` contient le résultat après `setConfig`.

- [ ] **Step 1: Vérifier le comportement de référence**

Ouvrir la page de démonstration avec la config actuelle (`camera_entity` + `privacy_entity`). Expected : un seul aperçu, flouté quand `switch.tapo_c610_privacy` est `on`.

- [ ] **Step 2: Ajouter `normalizeCameras`**

Signature : `function normalizeCameras(config)`. Si `config.cameras` est un tableau, le renvoyer en gardant seulement les entrées ayant `entity`. Sinon, si `config.camera_entity` est défini, renvoyer `[{entity: camera_entity, name: camera_name, privacy_entity}]`, sinon `[]`.

- [ ] **Step 3: Brancher la liste dans la carte**

- `setConfig` : `this._cameras = normalizeCameras(this._config)`.
- `_relevantEntities` : remplacer `c.camera_entity` et `c.privacy_entity` par les `entity` et `privacy_entity` de `this._cameras`.
- `_renderCamera` devient `_renderCameras` : pour chaque caméra, un bloc `.camera` (classe `private` si son `privacy_entity` vaut `on`). Une caméra absente affiche `?` dans le libellé et n'affiche pas d'image.
- Conteneur `.cameras` : une caméra = pleine largeur ; plusieurs = `grid-template-columns: repeat(2, minmax(0,1fr))`, et une colonne sous 520 px (même `@container` que les modes).
- `_updateCameraImage` : parcourir chaque `.camera img` avec `data-entity`.
- `getCardSize` : compter 4 par caméra.

- [ ] **Step 4: Vérifier dans l'aperçu**

Config de test : deux caméras (`camera.tapo_c610_sd_stream_direct` avec privacy `switch.tapo_c610_privacy`, et une absente `camera.inexistante`). Expected : deux blocs en grille, le second affiche `?`, le premier est flouté quand l'interrupteur est `on`, et aucune erreur dans la console.

- [ ] **Step 5: Vérifier la rétrocompatibilité**

Config à une caméra avec `camera_entity` seul. Expected : rendu identique à la version précédente.

- [ ] **Step 6: Commit**

```bash
git add customizable-alarm-card.js
git commit -m "Affiche plusieurs caméras avec mode privé individuel"
```

### Task 2: Éditeur — liste « Caméras »

**Files:**
- Modify: `customizable-alarm-card.js` (`CAMERA_SCHEMA`, `_render`, `_renderList`, `_addItem`, `_updateModeHead`/`_updateInfoHead` → une fonction générique de tête de ligne, `LABELS`, `STRINGS`, `_clean`)

**Interfaces:**
- Consumes: `normalizeCameras` (Task 1).
- Produces: la clé de configuration `cameras` gérée par l'éditeur comme `modes` et `info`.

- [ ] **Step 1: Ajouter les libellés**

Clés `STRINGS` en/fr : `section_cameras`, `add_camera`, `hint_cameras`, `camera_entity`, `camera_name`, `camera_privacy`, `camera_default_name`. Réutiliser `label_camera_*` existants quand c'est possible.

- [ ] **Step 2: Remplacer la section caméra unique**

Dans `_render`, la section `section_camera` ouvre une liste `#cameras` (même structure que `#info`), avec un bouton `add_camera`. `_addItem("cameras")` ajoute `{entity: ""}`.

- [ ] **Step 3: Schéma d'une caméra**

`CAMERA_ITEM_SCHEMA` : `entity` (domaine `camera`, requis), `name` (texte), `privacy_entity` (domaine `switch`, `input_boolean`). Les ligne « tête » affichent le nom ou l'entité, et l'entité en sous-titre.

- [ ] **Step 4: Migration à l'ouverture de l'éditeur**

Si la config n'a pas `cameras` mais a `camera_entity`, `setConfig` de l'éditeur renvoie à `config-changed` une config avec `cameras` (un élément) et sans les clés `camera_*`/`privacy_entity` anciennes. Ne le faire qu'une fois, sans modifier les autres clés.

- [ ] **Step 5: Vérifier dans l'aperçu**

Ajouter une caméra depuis l'éditeur, renseigner son entité et son interrupteur, les déplacer et les supprimer. Expected : `window.lastCfg.cameras` reflète chaque action et la carte se met à jour.

- [ ] **Step 6: Commit**

```bash
git add customizable-alarm-card.js
git commit -m "Ajoute la liste de caméras à l'éditeur visuel"
```

### Task 3: Données des passages (lecture, création, suppression)

**Files:**
- Modify: `customizable-alarm-card.js` (méthodes `_loadVisits`, `_createVisit`, `_deleteVisit` de `CustomizableAlarmCard`)

**Interfaces:**
- Consumes: `this._hass`, `this._config.visits_calendar`.
- Produces:
  - `_loadVisits() -> Promise<{ok: true, visits: Array<{uid?: string, summary: string, start: Date, end: Date|null}>} | {ok: false, error: string}>`, fenêtre de 30 jours à partir de maintenant, trié par `start`, limité à 5.
  - `_createVisit({summary: string, start: string, end: string}) -> Promise<void>`, `start`/`end` au format `YYYY-MM-DD HH:MM:SS`.
  - `_deleteVisit(uid: string) -> Promise<void>`.

- [ ] **Step 1: Vérifier les services disponibles dans HA**

Appeler `ha_list_services` pour `calendar` (lecture seule). Expected : `get_events`, `create_event` présents. Si `delete_event` est absent, le bouton de suppression n'est pas implémenté (voir Task 4) et le signaler à l'utilisateur.

- [ ] **Step 2: Implémenter `_loadVisits`**

Utiliser `this._hass.callWS({type: "call_service", domain: "calendar", service: "get_events", target: {entity_id}, service_data: {start_date_time, end_date_time}, return_response: true})`. Lire `response.response[entity_id].events`. Un événement sans `end` a `end: null`.

- [ ] **Step 3: Implémenter `_createVisit` et `_deleteVisit`**

`_createVisit` : `this._hass.callService("calendar", "create_event", {entity_id, summary, start_date_time, end_date_time})`. `_deleteVisit` : `calendar.delete_event` avec `uid` (uniquement si Step 1 l'a confirmé).

- [ ] **Step 4: Vérifier avec le faux `hass` de l'aperçu**

Ajouter dans la page de démonstration un `callWS` qui renvoie deux événements dont un sans `end`. Expected : `_loadVisits` renvoie `ok: true`, deux visites, tri correct, et `end: null` pour celui sans fin. Ajouter aussi un cas où `callWS` rejette : `ok: false` avec un message.

- [ ] **Step 5: Commit**

```bash
git add customizable-alarm-card.js
git commit -m "Lit, crée et supprime les passages du calendrier"
```

### Task 4: Section « Passages prévus » dans la carte

**Files:**
- Modify: `customizable-alarm-card.js` (`_render`, nouvelle `_renderVisits`, styles `.visits`, `.visit`, `.visit-form`, gestion des clics `add-visit`, `del-visit`, `visit-save`, `visit-cancel`)

**Interfaces:**
- Consumes: `_loadVisits`, `_createVisit`, `_deleteVisit` (Task 3).
- Produces: `this._visits` (dernier résultat de `_loadVisits`), `this._visitForm` (`null` ou `{start: string, end: string, summary: string}`).

- [ ] **Step 1: Afficher la section seulement si configurée**

Si `config.visits_calendar` est absent, `_renderVisits` renvoie `""`.

- [ ] **Step 2: Charger les passages**

Appeler `_loadVisits` à la première connexion, après `setConfig` si le calendrier a changé, après `_createVisit`/`_deleteVisit`, et toutes les 5 minutes (timer nettoyé dans `disconnectedCallback`).

- [ ] **Step 3: Rendu**

- Erreur : message `visits_error` dans un encadré, pas de liste.
- Liste vide : `visits_empty`.
- Chaque passage : titre, date courte, heures début–fin (`—` si `end` est `null`). Le passage en cours (début ≤ maintenant ≤ fin) porte la classe `now`.
- Bouton « Ajouter » ouvre le formulaire : titre (défaut `visit_default_name`), date, heure de début, heure de fin, « Enregistrer » et « Annuler ». Le formulaire est un bloc inline, pas une surimpression.
- Bouton supprimer par passage : confirmation en deux taps (même principe que `confirm` des modes). Affiché seulement si Task 3 Step 1 a confirmé `delete_event`.

- [ ] **Step 4: Vérifier dans l'aperçu**

Cas à tester : calendrier vide, erreur de chargement, un passage sans fin, un passage en cours. Expected : chaque cas affiche le bon message, aucune exception dans la console, et le formulaire crée un passage (`window.log` contient `calendar.create_event` avec les bons champs).

- [ ] **Step 5: Vérifier à 375 px**

Expected : pas de défilement horizontal, le formulaire tient sur une colonne.

- [ ] **Step 6: Commit**

```bash
git add customizable-alarm-card.js
git commit -m "Affiche et gère les passages prévus dans la carte"
```

### Task 5: Options de la carte pour les passages et l'éditeur

**Files:**
- Modify: `customizable-alarm-card.js` (`LABELS`, `GENERAL_SCHEMA`, `getStubConfig` si utile)

**Interfaces:**
- Consumes: `visits_calendar` (lu par Task 4).
- Produces: option `visits_calendar` dans l'éditeur.

- [ ] **Step 1: Ajouter le champ**

Dans `GENERAL_SCHEMA`, ajouter `{name: "visits_calendar", selector: {entity: {domain: "calendar"}}}`. Libellé `label_visits_calendar` en/fr : « Calendrier des passages » / « Visits calendar ».

- [ ] **Step 2: Vérifier**

Choisir un calendrier dans l'éditeur. Expected : `window.lastCfg.visits_calendar` est renseigné et la section apparaît.

- [ ] **Step 3: Commit**

```bash
git add customizable-alarm-card.js
git commit -m "Ajoute l'option du calendrier des passages"
```

### Task 6: Blueprint d'automatisation

**Files:**
- Create: `blueprints/automation/alarm_planned_visit.yaml`

**Interfaces:**
- Consumes: `input_text.alarme_mode_avant_passage` (créé à la Task 7), calendrier « Alarme », entité alarme.
- Produces: blueprint avec les entrées `alarm_entity` (`alarm_control_panel`), `visits_calendar` (`calendar`), `memory_helper` (`input_text`).

- [ ] **Step 1: Écrire le blueprint**

Métadonnées : `name`, `description`, `domain: automation`, `source_url` pointant vers le fichier du dépôt sur GitHub, `min_version: 2026.1.0`.

Déclencheurs : `calendar` événement `start` (id `start`), `calendar` événement `end` (id `end`), tous deux avec `offset: "0:00:00"` et `entity_id: !input visits_calendar`.

Mode : `queued`, `max: 5`.

Action pour `start` :
1. Si `alarm_control_panel` est dans un état `armed_*` (`states[alarm].state.startswith('armed')`) : `input_text.set_value` sur le helper avec l'état actuel, puis `alarm_control_panel.alarm_disarm` sur l'alarme.
2. Sinon : `input_text.set_value` sur le helper avec `""`.

Action pour `end` :
1. Si le helper est vide ou `unknown`/`unavailable` : ne rien faire.
2. Si l'alarme n'est pas `disarmed` : ne rien faire (action manuelle conservée).
3. Sinon `choose` sur la valeur du helper : `armed_home` → `alarm_arm_home`, `armed_away` → `alarm_arm_away`, `armed_night` → `alarm_arm_night`, `armed_vacation` → `alarm_arm_vacation`, `armed_custom_bypass` → `alarm_arm_custom_bypass`, chacun sur `entity_id: !input alarm_entity`.
4. Dans tous les cas (sauf la branche « ne rien faire » du point 1), `input_text.set_value` vide le helper.

- [ ] **Step 2: Vérifier la syntaxe**

Expected : le fichier se charge sans erreur YAML (`python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <chemin>` avec `python -I`). Les entrées ont des sélecteurs typés.

- [ ] **Step 3: Commit**

```bash
git add blueprints/automation/alarm_planned_visit.yaml
git commit -m "Ajoute le blueprint de désarmement et réarmement pour un passage"
```

### Task 7: Déploiement dans Home Assistant

**Files:** aucun fichier du dépôt ; actions sur l'instance HA.

**Interfaces:**
- Consumes: Tasks 1–6 livrées et poussées.
- Produces: calendrier « Alarme », helper `input_text.alarme_mode_avant_passage`, automatisation créée depuis le blueprint, ressource HA mise à jour, carte configurée.

- [ ] **Step 1: Demander l'accord de l'utilisateur**

Créer un calendrier local, un helper et une automatisation sont des modifications de configuration. Lister les actions exactes et attendre un « oui » avant de les lancer.

- [ ] **Step 2: Créer le calendrier et le helper**

Calendrier : intégration Local Calendar, nom « Alarme ». Helper : `input_text`, nom `alarme_mode_avant_passage`, longueur max 255.

- [ ] **Step 3: Tester la reprise après redémarrage**

Mettre le helper à `armed_night` à la main, redémarrer HA (accord requis). Expected : la valeur est conservée après redémarrage.

- [ ] **Step 4: Importer le blueprint et créer l'automatisation**

Importer le blueprint depuis le dépôt. Créer une automatisation à partir de lui, avec le calendrier « Alarme », l'alarme Somfy, le helper.

- [ ] **Step 5: Mettre à jour la ressource et la carte**

Remplacer le contenu de la ressource (même identifiant `46ff38b7eb56427ca47790244af84ac5`) par la version poussée. Ajouter `visits_calendar`, la liste `cameras` et une deuxième caméra si l'utilisateur en choisit une.

- [ ] **Step 6: Tester un passage réel**

Créer un passage dans 2 minutes, vérifier : désarmement au début, réarmement dans le bon mode à la fin, et aucun réarmement si l'alarme a été armée à la main pendant le passage.

- [ ] **Step 7: Commit de la documentation**

Voir Task 8.

### Task 8: README (français et anglais)

**Files:**
- Modify: `README.md`, `README.fr.md`

**Interfaces:**
- Consumes: options `cameras`, `visits_calendar` (Tasks 1–5), blueprint (Task 6).

- [ ] **Step 1: Ajouter les options**

Dans le tableau « Options » : `cameras` (liste de `entity`, `name`, `privacy_entity`), `visits_calendar`. Marquer `camera_entity`, `camera_name`, `privacy_entity` comme « kept for compatibility ».

- [ ] **Step 2: Ajouter une section « Planned visits »**

Décrire : calendrier « Alarme », helper, blueprint à importer (lien vers le fichier), comportement (désarmement au début, réarmement dans le mode d'avant à la fin, rien si l'alarme était déjà désarmée, rien si armée à la main pendant le passage).

- [ ] **Step 3: Vérifier**

Expected : les deux README listent les mêmes options et la même section.

- [ ] **Step 4: Commit**

```bash
git add README.md README.fr.md
git commit -m "Documente les passages prévus et les caméras multiples"
```

---

## Ordre et dépendances

Tasks 1 → 2 (caméras), Task 3 → 4 → 5 (passages), Task 6 (blueprint, indépendant), Task 7 (déploiement, après tout le reste), Task 8 (documentation, après Tasks 1–6).

Une seule personne doit écrire `customizable-alarm-card.js` à la fois : Tasks 1–5 se font dans l'ordre.
