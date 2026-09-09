import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSiteContext } from "../src/context.js";

test("resolveSiteContext matches the exact configured hostname", () => {
  const store = { "vodafone.de": "Vertrag 88213" };
  assert.equal(resolveSiteContext("vodafone.de", store), "Vertrag 88213");
});

test("resolveSiteContext falls back to a parent domain for a subdomain", () => {
  const store = { "vodafone.de": "Vertrag 88213" };
  assert.equal(resolveSiteContext("chat.vodafone.de", store), "Vertrag 88213");
  assert.equal(resolveSiteContext("a.b.chat.vodafone.de", store), "Vertrag 88213");
});

test("resolveSiteContext prefers the most specific configured entry", () => {
  const store = { "vodafone.de": "root context", "chat.vodafone.de": "chat-specific context" };
  assert.equal(resolveSiteContext("chat.vodafone.de", store), "chat-specific context");
});

test("resolveSiteContext never matches a bare single-label TLD", () => {
  const store = { de: "should never apply to every .de site" };
  assert.equal(resolveSiteContext("chat.vodafone.de", store), "");
});

test("resolveSiteContext returns empty when nothing configured matches", () => {
  assert.equal(resolveSiteContext("chat.vodafone.de", {}), "");
});

test("resolveSiteContext preserves exact match on single-label hostnames", () => {
  const store = { localhost: "dev context" };
  assert.equal(resolveSiteContext("localhost", store), "dev context");
});

test("resolveSiteContext still matches a specific tenant on a shared widget platform", () => {
  const store = { "acme.zendesk.com": "Acme support context" };
  assert.equal(resolveSiteContext("acme.zendesk.com", store), "Acme support context");
  assert.equal(resolveSiteContext("chat.acme.zendesk.com", store), "Acme support context");
});

test("resolveSiteContext never walks up to a bare shared-widget platform domain", () => {
  const store = { "zendesk.com": "leaked context" };
  assert.equal(resolveSiteContext("other-company.zendesk.com", store), "");
});
