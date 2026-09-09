// Profile registry, routing and the fallback chain.
// Nothing outside this directory knows which backend is in use.

import type { Adapter, AnnotatedResult, CompletionRequest, Profile } from "../types.js";
import * as openaiCompat from "./openai-compat.js";
import * as anthropic from "./anthropic.js";
import * as gemini from "./gemini.js";
import { extractJson, normaliseResult, stripUntrustedTags } from "./json.js";

const ADAPTERS: Record<string, Adapter> = {
  "openai-compat": openaiCompat,
  anthropic,
  gemini,
};

export function adapterFor(profile: Pick<Profile, "shape">): Adapter {
  const adapter = ADAPTERS[profile?.shape];
  if (!adapter) throw new Error(`Unknown provider shape: ${profile?.shape}`);
  return adapter;
}

/** Turn a base URL into an origin match pattern for chrome.permissions. */
export function originPattern(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Endpoint must use http:// or https://");
  }
  return `${url.protocol}//${url.host}/*`;
}

/**
 * Some adapters (Gemini) put the key in the query string, and a custom or
 * misconfigured endpoint can echo the request URI back in an error body —
 * an Express default 404 page does exactly this. Errors cross the
 * worker→content boundary into the visible overlay, so strip the key before
 * they leave this module, not just before logging.
 */
export function redact(message: string, profile: Profile): string {
  let out = message;
  if (profile.apiKey) out = out.split(profile.apiKey).join("[REDACTED]");
  return out.replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]");
}

async function hasPermission(profile: Profile): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [originPattern(profile.baseUrl)] });
  } catch {
    return false;
  }
}

export async function getProfiles(): Promise<Profile[]> {
  const { profiles = [] } = await chrome.storage.local.get("profiles");
  return profiles as Profile[];
}

export async function getActiveProfiles(): Promise<Profile[]> {
  return (await getProfiles()).filter((p) => p.enabled && p.baseUrl && p.model);
}

/**
 * Run one profile and return a parsed, validated result.
 * Retries once with a repair instruction if the response isn't usable JSON.
 */
async function runProfile(profile: Profile, req: CompletionRequest): Promise<AnnotatedResult> {
  const adapter = adapterFor(profile);
  const raw = await adapter.complete(req, profile);

  const parsed = normaliseResult(extractJson(raw));
  if (parsed) return { ...parsed, _profile: profile.name };

  const repaired = await adapter.complete(
    {
      ...req,
      user:
        `${req.user}\n\n---\nYour previous reply was not valid JSON. ` +
        `Reply with ONLY a JSON object, no prose and no markdown fences, ` +
        `with exactly these keys: german, back_translation_fa, notes.`,
    },
    profile,
  );

  const retried = normaliseResult(extractJson(repaired));
  if (retried) return { ...retried, _profile: profile.name };

  // Last resort: never lose the user's message. Treat the whole reply as the
  // German text and drop the back-translation rather than failing outright.
  // This bypasses normaliseResult, so it needs its own untrusted-tag strip.
  const fallbackText = stripUntrustedTags((repaired || raw || "").trim());
  if (!fallbackText) throw new Error(`${profile.name}: unusable response`);

  return {
    german: fallbackText,
    back_translation_fa: "",
    notes: ["⚠️ Provider did not return structured JSON — back-translation unavailable."],
    _profile: profile.name,
    _degraded: true,
  };
}

/**
 * Try each enabled profile in order. Falls through on rate limits, network
 * errors and malformed responses.
 */
export async function complete(req: CompletionRequest): Promise<AnnotatedResult> {
  const profiles = await getActiveProfiles();

  if (!profiles.length) {
    throw new Error("No provider configured. Open zalang settings to add one.");
  }

  const errors: string[] = [];

  for (const profile of profiles) {
    if (!(await hasPermission(profile))) {
      errors.push(`${profile.name}: permission not granted — re-save it in settings`);
      continue;
    }

    const started = performance.now();

    try {
      const result = await runProfile(profile, req);
      result._ms = Math.round(performance.now() - started);
      console.debug(`[zalang] ${profile.name} ${result._ms}ms`);
      return result;
    } catch (err) {
      const message = redact(err instanceof Error ? err.message : String(err), profile);
      console.warn(`[zalang] ${profile.name} failed:`, message);
      errors.push(message);
    }
  }

  throw new Error(errors.join(" | "));
}
