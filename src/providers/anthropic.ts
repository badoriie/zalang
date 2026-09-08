// Adapter for the Anthropic Messages API.

import type { CompletionRequest, Profile } from "../types.js";

interface MessagesResponse {
  content?: { type?: string; text?: string }[];
  stop_reason?: string;
  stop_details?: { category?: string };
}

interface ModelsResponse {
  data?: { id?: string }[];
}

function base(profile: Profile): string {
  return (profile.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
}

function headers(profile: Profile): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": profile.apiKey,
    "anthropic-version": "2023-06-01",
    // Required from any browser context. Without it the API rejects the request
    // as a 401 authentication_error that talks about CORS — misleading if you
    // are debugging it as an auth problem. The "dangerous" is literal: it
    // acknowledges the key is embedded client-side.
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

export async function complete(req: CompletionRequest, profile: Profile): Promise<string> {
  const body: Record<string, unknown> = {
    model: profile.model,
    max_tokens: req.maxTokens ?? 1024,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  };

  // Current Claude models reject `temperature` — only send it when the user has
  // pinned an older model that still accepts it.
  if (typeof req.temperature === "number" && profile.quirks?.allowsTemperature) {
    body.temperature = req.temperature;
  }

  // Structured outputs. There is deliberately no assistant-prefill fallback:
  // a last-assistant-turn prefill returns a 400 on current models.
  if (profile.jsonMode === "schema" && req.schema) {
    body.output_config = { format: { type: "json_schema", schema: req.schema } };
  }

  const res = await fetch(`${base(profile)}/v1/messages`, {
    method: "POST",
    headers: headers(profile),
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!res.ok) {
    throw new Error(`${profile.name}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as MessagesResponse;

  // Safety classifiers can decline with HTTP 200 — check before reading content.
  if (data.stop_reason === "refusal") {
    throw new Error(
      `${profile.name}: request was declined (${data.stop_details?.category ?? "refusal"})`,
    );
  }

  const text = (data.content ?? [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  if (!text) throw new Error(`${profile.name}: empty response`);
  return text;
}

export async function listModels(profile: Profile): Promise<string[]> {
  const res = await fetch(`${base(profile)}/v1/models?limit=100`, { headers: headers(profile) });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as ModelsResponse;
  return (data.data ?? []).map((m) => m?.id).filter((id): id is string => typeof id === "string");
}
