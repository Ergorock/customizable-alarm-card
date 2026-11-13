import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define() {}, whenDefined: async () => {} };

const { normalizeCameras } = await import("../customizable-alarm-card.js");

test("cameras list keeps entries that have an entity", () => {
  const cameras = normalizeCameras({
    cameras: [{ entity: "camera.a", name: "A" }, { name: "no entity" }],
  });
  assert.deepEqual(cameras, [{ entity: "camera.a", name: "A" }]);
});

test("legacy camera_entity becomes a one-item list", () => {
  const cameras = normalizeCameras({
    camera_entity: "camera.a",
    camera_name: "A",
    privacy_entity: "switch.p",
  });
  assert.deepEqual(cameras, [{ entity: "camera.a", name: "A", privacy_entity: "switch.p" }]);
});

test("no camera gives an empty list", () => {
  assert.deepEqual(normalizeCameras({}), []);
});
