import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define() {}, whenDefined: async () => {} };

const { toVisits, formatHaDateTime } = await import("../customizable-alarm-card.js");

test("events become visits sorted by start, with end null when missing", () => {
  const visits = toVisits([
    { summary: "Ménage", start: "2026-11-14T10:00:00", end: "2026-11-14T12:00:00", uid: "b" },
    { summary: "Artisan", start: "2026-11-13T09:00:00", uid: "a" },
  ]);
  assert.deepEqual(
    visits.map((v) => [v.summary, v.uid, v.end]),
    [
      ["Artisan", "a", null],
      ["Ménage", "b", new Date("2026-11-14T12:00:00")],
    ],
  );
  assert.ok(visits[0].start instanceof Date);
});

test("at most five visits are kept", () => {
  const events = Array.from({ length: 7 }, (_, i) => ({ summary: `v${i}`, start: `2026-11-0${i + 1}T08:00:00` }));
  assert.equal(toVisits(events).length, 5);
});

test("formatHaDateTime gives the YYYY-MM-DD HH:MM:SS form used by calendar services", () => {
  assert.equal(formatHaDateTime(new Date(2026, 10, 13, 9, 5, 0)), "2026-11-13 09:05:00");
});
