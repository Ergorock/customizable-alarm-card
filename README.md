# Customizable Alarm Card

*[Version française](README.fr.md)*

Lovelace card to control an `alarm_control_panel` alarm, with a full visual editor.

- **Status banner** colored by state (disarmed, night, away, arming, triggered…), with a pulse animation while armed and flashing when triggered. Shows “since 15:36 · by Ha”.
- **Information chips**: batteries (icon and alert by level), switches toggled with a tap (camera privacy mode…), any sensor.
- **Illustrated mode tiles** (background image + color gradient), “Active” badge on the current mode, spinner while arming, optional confirmation by double tap.
  Each mode runs a scene, a script or a button, or controls the alarm directly (with a keypad if the alarm needs a code).
- Optional **camera preview**, blurred while privacy mode is on.
- **Visual editor**: General / Modes / Information / Camera / Appearance sections, add, remove and reorder modes and chips, colors by state.
- Interface in English and French (follows the Home Assistant language).

## Installation

### HACS (custom repository)

1. HACS → ⋮ menu → *Custom repositories* → add `https://github.com/Ergorock/customizable-alarm-card`, category **Dashboard**.
2. Install **Customizable Alarm Card**, then reload your browser.

### Manual

1. Copy `customizable-alarm-card.js` to `config/www/customizable-alarm-card.js`.
2. *Settings → Dashboards → ⋮ → Resources*: add `/local/customizable-alarm-card.js?v=1.0.0` (type *JavaScript module*).

After updating the file, increment `?v=` in the resource URL to clear the cache.

## Example configuration

```yaml
type: custom:customizable-alarm-card
entity: alarm_control_panel.somfy_home_alarm_house
name: House alarm
history_entity: text.somfy_home_alarm_house_history
camera_entity: camera.tapo_c610_sd_stream_direct
privacy_entity: switch.tapo_c610_privacy
columns: 3
tile_height: 160
modes:
  - name: Disarm
    label: Disarming
    state: disarmed
    entity: scene.alarm_off
    image: /local/images/open.png
    icon: mdi:shield-off-outline
    color: [60, 170, 80]
  - name: Night alarm
    label: Partial arming
    state: armed_night
    entity: scene.alarm_on
    image: /local/images/closed.png
    icon: mdi:weather-night
    color: [220, 100, 0]
  - name: Away mode
    label: Full arming
    state: armed_away
    entity: scene.alarm_away
    image: /local/images/closed.png
    icon: mdi:shield-lock
    color: [180, 20, 20]
info:
  - entity: sensor.alarm_battery
    name: Lowest battery
  - entity: switch.tapo_c610_privacy
    name: Privacy mode
  - entity: sensor.tapo_c610_battery
    name: Camera
```

## Options

| Option | Description | Default |
|---|---|---|
| `entity` | `alarm_control_panel` entity (required) | |
| `name` | Banner title | `Alarm` |
| `history_entity` | Entity whose `user` attribute is used to show “by …” | |
| `show_last_change` | Shows “since … by …” | `true` |
| `camera_entity` | Camera shown under the banner | |
| `camera_name` | Name shown on the preview | entity name |
| `camera_refresh` | Image refresh interval (s) | `10` |
| `privacy_entity` | Switch that blurs the preview when `on` | |
| `columns` | Number of tile columns (2 max below 520 px wide) | `3` |
| `tile_height` | Tile height (px) | `150` |
| `glass` | Frosted glass background | `true` |
| `state_colors` | Color per state, e.g. `armed_night: [220, 75, 75]` or `"#dc4b4b"` | |
| `modes` | List of tiles (see below) | |
| `info` | List of chips: `entity`, `name`, `icon`, `low_threshold` (batteries) | |

**Mode**: `name`, `label` (subtitle), `state` (alarm state that makes the tile “Active”), `entity` (scene / script / button to run; empty = direct `alarm_control_panel.alarm_*` call), `icon`, `image`, `color`, `confirm` (asks for a second tap).
