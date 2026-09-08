// Adapter for the Gemini generateContent API.

import type { CompletionRequest, Profile } from "../types.js";
import { toGeminiSchema } from "./json.js";

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
}

interface ModelsResponse {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
}

function base(profile: Profile): string {
  return (profile.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
}

export async function complete(req: CompletionRequest, profile: Profile): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.3,
    maxOutputTokens: req.maxTokens ?? 1024,
  };

  if (profile.jsonMode === "schema" && req.schema) {
    generationConfig.response_mime_type = "application/json";
    generationConfig.response_schema = toGeminiSchema(req.schema);
  } else if (profile.jsonMode === "object") {
    generationConfig.response_mime_type = "application/json";
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    systemInstruction: { parts: [{ text: req.system }] },
    generationConfig,
  };

  const url =
    `${base(profile)}/v1beta/models/${encodeURIComponent(profile.model)}:generateContent` +
    `?key=${encodeURIComponent(profile.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!res.ok) {
    throw new Error(`${profile.name}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as GenerateResponse;

  if (data.promptFeedback?.blockReason) {
    throw new Error(`${profile.name}: blocked (${data.promptFeedback.blockReason})`);
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
    .filter(Boolean)
    .join("");

  if (!text) throw new Error(`${profile.name}: empty response`);
  return text;
}

export async function listModels(profile: Profile): Promise<string[]> {
  const res = await fetch(
    `${base(profile)}/v1beta/models?key=${encodeURIComponent(profile.apiKey)}&pageSize=200`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as ModelsResponse;

  return (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => String(m.name).replace(/^models\//, ""))
    .sort();
}
