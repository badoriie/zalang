import { test } from "node:test";
import assert from "node:assert/strict";

import { redact } from "../src/providers/index.js";
import type { Profile } from "../src/types.js";

const profile: Profile = {
  id: "p1",
  preset: "gemini",
  name: "Gemini",
  shape: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com",
  model: "gemini-flash",
  apiKey: "AIzaSyTestSecretKeyValue",
  jsonMode: "schema",
  quirks: {},
  enabled: true,
};

test("redact strips a literal occurrence of the profile's API key", () => {
  const message = `HTTP 404 — Cannot POST /v1beta/models/x:generateContent?key=${profile.apiKey}`;
  assert.doesNotMatch(redact(message, profile), /AIzaSyTestSecretKeyValue/);
  assert.match(redact(message, profile), /\[REDACTED\]/);
});

test("redact strips a key= query parameter even if it doesn't match apiKey exactly", () => {
  const message = "HTTP 404 — Cannot POST /path?key=someOtherEncodedValue&pageSize=200";
  assert.doesNotMatch(redact(message, profile), /someOtherEncodedValue/);
});

test("redact leaves an ordinary error message untouched", () => {
  const message = "HTTP 500 — internal server error";
  assert.equal(redact(message, profile), message);
});

test("redact is a no-op when the profile has no API key", () => {
  const noKeyProfile = { ...profile, apiKey: "" };
  const message = "HTTP 404 — not found";
  assert.equal(redact(message, noKeyProfile), message);
});
