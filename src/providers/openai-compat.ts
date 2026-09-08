// Adapter for the OpenAI /v1/chat/completions shape.
// Covers OpenAI, Groq, OpenRouter, Together, DeepSeek, Mistral, xAI, LiteLLM,
// Ollama, LM Studio, vLLM — anything that speaks this dialect.

import type { CompletionRequest, Profile } from "../types.js";
import { withAllPropsRequired } from "./json.js";

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

interface ModelsResponse {
  data?: { id?: string; name?: string }[];
  models?: { id?: string; name?: string }[];
}

function base(profile: Profile): string {
  const b = (profile.baseUrl || "").replace(/\/+$/, "");
  return /\/v1$/.test(b) ? b : `${b}/v1`;
}

function headers(profile: Profile): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };

  if (profile.apiKey) {
    const name = profile.authHeader || "Authorization";
    h[name] = name.toLowerCase() === "authorization" ? `Bearer ${profile.apiKey}` : profile.apiKey;
  }
  return h;
}

export async function complete(req: CompletionRequest, profile: Profile): Promise<string> {
  const body: Record<string, unknown> = {
    model: profile.model,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 1024,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  };

  if (profile.jsonMode === "schema" && req.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "zalang_result",
        strict: true,
        schema: profile.quirks?.allPropsRequired ? withAllPropsRequired(req.schema) : req.schema,
      },
    };
  } else if (profile.jsonMode === "object") {
    body.response_format = { type: "json_object" };
  }

  // OpenRouter: only route to upstreams that actually honour response_format.
  if (profile.quirks?.requireParameters && body.response_format) {
    body.provider = { require_parameters: true };
  }

  const res = await fetch(`${base(profile)}/chat/completions`, {
    method: "POST",
    headers: headers(profile),
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!res.ok) {
    throw new Error(`${profile.name}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as ChatResponse;
  const text = data.choices?.[0]?.message?.content;

  if (typeof text !== "string") {
    throw new Error(`${profile.name}: unexpected response shape`);
  }
  return text;
}

export async function listModels(profile: Profile): Promise<string[]> {
  const res = await fetch(`${base(profile)}/models`, { headers: headers(profile) });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as ModelsResponse;

  return (data.data ?? data.models ?? [])
    .map((m) => m?.id ?? m?.name)
    .filter((m): m is string => typeof m === "string")
    .sort();
}
