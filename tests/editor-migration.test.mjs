import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define() {}, whenDefined: async () => {} };

const { migrateLegacyCamera } = await import("../customizable-alarm-card.js");

test("legacy camera options become a cameras list and the old keys are removed", () => {
  const migrated = migrateLegacyCamera({
    entity: "alarm_control_panel.a",
    camera_entity: "camera.one",
    camera_name: "Porte",
    privacy_entity: "switch.p",
    columns: 3,
  });
  assert.deepEqual(migrated, {
    entity: "alarm_control_panel.a",
    columns: 3,
    cameras: [{ entity: "camera.one", name: "Porte", privacy_entity: "switch.p" }],
  });
});

test("a config that already has cameras is returned unchanged", () => {
  const config = { entity: "alarm_control_panel.a", cameras: [{ entity: "camera.one" }] };
  assert.deepEqual(migrateLegacyCamera(config), config);
});

test("a config without any camera is returned unchanged", () => {
  const config = { entity: "alarm_control_panel.a" };
  assert.deepEqual(migrateLegacyCamera(config), config);
});
