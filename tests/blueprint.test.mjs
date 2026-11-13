import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("../blueprints/automation/alarm_planned_visit.yaml", import.meta.url), "utf8");

test("blueprint declares its three inputs with typed selectors", () => {
  for (const name of ["alarm_entity", "visits_calendar", "memory_helper"]) {
    assert.ok(text.includes(`    ${name}:\n      name: `), name);
  }
  for (const domain of ["alarm_control_panel", "calendar", "input_text"]) {
    assert.ok(text.includes(`          domain: ${domain}`), domain);
  }
});

test("calendar triggers start and end carry the ids the actions branch on", () => {
  assert.match(text, /trigger: calendar\n\s+event: start[\s\S]*?id: start/);
  assert.match(text, /trigger: calendar\n\s+event: end[\s\S]*?id: end/);
});

test("all five armed modes are restored by a dedicated service", () => {
  for (const svc of ["alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_arm_vacation", "alarm_arm_custom_bypass"]) {
    assert.ok(text.includes(`alarm_control_panel.${svc}`), svc);
  }
});

test("the memory is cleared at the end whatever happened", () => {
  assert.ok(text.trimEnd().endsWith('value: ""'));
});

test("runs queued, at most five at a time", () => {
  assert.match(text, /^mode: queued$/m);
  assert.match(text, /^max: 5$/m);
});
