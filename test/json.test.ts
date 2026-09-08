import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractJson,
  normaliseResult,
  toGeminiSchema,
  withAllPropsRequired,
} from "../src/providers/json.js";
import type { JsonSchema } from "../src/types.js";

const R = { german: "Guten Tag", back_translation_fa: "روز بخیر", notes: [] };
const JSON_R = '{"german":"Guten Tag","back_translation_fa":"روز بخیر","notes":[]}';

test("extractJson handles the shapes providers actually return", async (t) => {
  await t.test("bare json", () => assert.deepEqual(extractJson(JSON_R), R));

  await t.test("```json fence", () =>
    assert.deepEqual(extractJson("```json\n" + JSON_R + "\n```"), R),
  );

  await t.test("bare ``` fence", () =>
    assert.deepEqual(extractJson("```\n" + JSON_R + "\n```"), R),
  );

  await t.test("prose either side", () =>
    assert.deepEqual(extractJson(`Sure! Here you go:\n${JSON_R}\nHope that helps.`), R),
  );

  await t.test("leading whitespace", () => assert.deepEqual(extractJson(`\n\n  ${JSON_R}`), R));
});

test("extractJson does not terminate early on braces inside strings", async (t) => {
  await t.test("brace in a value", () =>
    assert.deepEqual(
      extractJson('{"german":"Kosten {brutto} 20€","back_translation_fa":"x","notes":[]}'),
      { german: "Kosten {brutto} 20€", back_translation_fa: "x", notes: [] },
    ),
  );

  await t.test("escaped quote in a value", () =>
    assert.deepEqual(
      extractJson('{"german":"Er sagte \\"ja\\"","back_translation_fa":"x","notes":[]}'),
      { german: 'Er sagte "ja"', back_translation_fa: "x", notes: [] },
    ),
  );

  await t.test("nested objects", () =>
    assert.deepEqual(
      extractJson('{"german":"a","back_translation_fa":"b","notes":[],"m":{"x":{"y":1}}}'),
      { german: "a", back_translation_fa: "b", notes: [], m: { x: { y: 1 } } },
    ),
  );
});

test("extractJson returns null when there is nothing usable", async (t) => {
  await t.test("no json", () => assert.equal(extractJson("I cannot help with that."), null));
  await t.test("truncated", () => assert.equal(extractJson('{"german":"Guten Tag","back_'), null));
  await t.test("non-string", () => assert.equal(extractJson(null), null));
});

test("normaliseResult guards what reaches the user's chat box", async (t) => {
  await t.test("passes a valid result", () => assert.deepEqual(normaliseResult(R), R));

  await t.test("trims and fills defaults", () =>
    assert.deepEqual(normaliseResult({ german: "  Hallo  " }), {
      german: "Hallo",
      back_translation_fa: "",
      notes: [],
    }),
  );

  await t.test("drops non-string and empty notes", () =>
    assert.deepEqual(normaliseResult({ german: "a", notes: ["x", 3, null, "  y  ", ""] }), {
      german: "a",
      back_translation_fa: "",
      notes: ["x", "y"],
    }),
  );

  await t.test("coerces a non-array notes field", () =>
    assert.deepEqual(normaliseResult({ german: "a", notes: "oops" }), {
      german: "a",
      back_translation_fa: "",
      notes: [],
    }),
  );

  // Without german there is nothing to write, so the caller must fall through to
  // the next provider rather than blanking the user's message.
  await t.test("rejects whitespace-only german", () =>
    assert.equal(normaliseResult({ german: "   ", notes: [] }), null),
  );
  await t.test("rejects missing german", () => assert.equal(normaliseResult({ notes: [] }), null));
  await t.test("rejects null", () => assert.equal(normaliseResult(null), null));
});

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    german: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["german"],
  additionalProperties: false,
};

test("toGeminiSchema uppercases types and strips additionalProperties", () => {
  assert.deepEqual(toGeminiSchema(SCHEMA), {
    type: "OBJECT",
    properties: {
      german: { type: "STRING" },
      notes: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["german"],
  });
});

test("withAllPropsRequired satisfies Groq's stricter validation", async (t) => {
  await t.test("lists every property", () =>
    assert.deepEqual(withAllPropsRequired(SCHEMA).required, ["german", "notes"]),
  );
  await t.test("leaves non-object schemas alone", () =>
    assert.deepEqual(withAllPropsRequired({ type: "string" }), { type: "string" }),
  );
});
