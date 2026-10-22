import assert from "node:assert/strict";
import { test } from "node:test";
import { ZodError } from "zod";
import { parseSettings } from "../src/settings";
import { DEFAULT_SETTINGS } from "../src/types";

test("fresh installations receive independent default settings", () => {
  for (const input of [null, undefined, {}]) {
    const settings = parseSettings(input);
    assert.deepEqual(settings, DEFAULT_SETTINGS);
    assert.notEqual(settings, DEFAULT_SETTINGS);
  }
});

test("saved settings preserve every supported value", () => {
  const saved = {
    language: "en",
    headerTitle: "",
    showParent: false,
    showFolders: false,
    showFiles: false,
    showSiblings: true,
    showBodyIndex: false,
    enableCreate: false,
    sectionLayout: "wrap",
    maxVisibleItems: 1,
    collapsed: true,
  };
  assert.deepEqual(parseSettings(saved), saved);
});

test("absent fields receive defaults while explicit values remain intact", () => {
  assert.deepEqual(parseSettings({ showParent: false, maxVisibleItems: 12 }), {
    ...DEFAULT_SETTINGS,
    showParent: false,
    maxVisibleItems: 12,
  });
});

test("invalid settings fail immediately without coercion", () => {
  const invalidInputs: unknown[] = [
    [], true, 0, "settings",
    { language: "fr" },
    { headerTitle: 42 },
    { sectionLayout: "grid" },
    ...["showParent", "showFolders", "showFiles", "showSiblings", "showBodyIndex", "enableCreate", "collapsed"]
      .flatMap((key) => ["false", 0, null].map((value) => ({ [key]: value }))),
    ...[0, -1, 1.5, NaN, Infinity, "6", null]
      .map((maxVisibleItems) => ({ maxVisibleItems })),
  ];
  for (const input of invalidInputs) {
    assert.throws(() => parseSettings(input), ZodError);
  }
});

test("loading settings does not mutate persisted data or default settings", () => {
  const input = Object.freeze({ headerTitle: "Navigation" });
  const defaultsBefore = { ...DEFAULT_SETTINGS };
  const settings = parseSettings(input);
  settings.headerTitle = "Changed";
  assert.deepEqual(input, { headerTitle: "Navigation" });
  assert.deepEqual(DEFAULT_SETTINGS, defaultsBefore);
});
