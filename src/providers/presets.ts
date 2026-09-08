// Known providers. `model` is deliberately empty for most of them: model IDs
// churn fast, so the options page fetches the real list via listModels() and the
// user picks. Where a model is pinned here it was verified against current docs.

import type { JsonMode, Profile, ProviderQuirks, ProviderShape } from "../types.js";

export interface Preset {
  label: string;
  shape: ProviderShape;
  baseUrl: string;
  model: string;
  jsonMode: JsonMode;
  needsKey: boolean;
  keyHint?: string;
  quirks?: ProviderQuirks;
}

export const SHAPES: ProviderShape[] = ["openai-compat", "anthropic", "gemini"];

export const PRESETS = {
  custom: {
    label: "Custom (any endpoint)",
    shape: "openai-compat",
    baseUrl: "",
    model: "",
    jsonMode: "object",
    needsKey: true,
  },

  gemini: {
    label: "Google Gemini",
    shape: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    // Verified current fast tier. Note: a Gemini Advanced / Google One AI
    // subscription does NOT grant API access — get a key at aistudio.google.com.
    model: "gemini-3.5-flash-lite",
    jsonMode: "schema",
    needsKey: true,
    keyHint: "aistudio.google.com → Get API key (free tier, no card required)",
  },

  anthropic: {
    label: "Anthropic (Claude)",
    shape: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-haiku-4-5",
    jsonMode: "schema",
    needsKey: true,
    keyHint: "console.anthropic.com → API keys",
  },

  openai: {
    label: "OpenAI",
    shape: "openai-compat",
    baseUrl: "https://api.openai.com",
    model: "",
    jsonMode: "schema",
    needsKey: true,
    keyHint: "platform.openai.com → API keys",
  },

  groq: {
    label: "Groq (lowest latency)",
    shape: "openai-compat",
    baseUrl: "https://api.groq.com/openai",
    model: "",
    jsonMode: "schema",
    needsKey: true,
    keyHint: "console.groq.com → API keys",
    quirks: { allPropsRequired: true },
  },

  openrouter: {
    label: "OpenRouter",
    shape: "openai-compat",
    baseUrl: "https://openrouter.ai/api",
    model: "",
    jsonMode: "schema",
    needsKey: true,
    keyHint: "openrouter.ai → Keys",
    quirks: { requireParameters: true },
  },

  deepseek: {
    label: "DeepSeek",
    shape: "openai-compat",
    baseUrl: "https://api.deepseek.com",
    model: "",
    jsonMode: "object",
    needsKey: true,
  },

  mistral: {
    label: "Mistral",
    shape: "openai-compat",
    baseUrl: "https://api.mistral.ai",
    model: "",
    jsonMode: "object",
    needsKey: true,
  },

  together: {
    label: "Together AI",
    shape: "openai-compat",
    baseUrl: "https://api.together.xyz",
    model: "",
    jsonMode: "schema",
    needsKey: true,
  },

  xai: {
    label: "xAI (Grok)",
    shape: "openai-compat",
    baseUrl: "https://api.x.ai",
    model: "",
    jsonMode: "schema",
    needsKey: true,
  },

  ollama: {
    label: "Ollama (local — nothing leaves your machine)",
    shape: "openai-compat",
    baseUrl: "http://localhost:11434",
    model: "",
    // Ollama's OpenAI-compatible endpoint has historically ignored json_schema
    // in response_format. json_object is the portable choice; the tolerant
    // parser covers the rest.
    jsonMode: "object",
    needsKey: false,
    keyHint: "No key needed. Run: ollama serve",
  },

  lmstudio: {
    label: "LM Studio (local)",
    shape: "openai-compat",
    baseUrl: "http://localhost:1234",
    model: "",
    jsonMode: "object",
    needsKey: false,
    keyHint: "No key needed. Start the local server in LM Studio.",
  },
} as const satisfies Record<string, Preset>;

export type PresetKey = keyof typeof PRESETS;

export function presetToProfile(presetKey: string): Profile {
  const key = (presetKey in PRESETS ? presetKey : "custom") as PresetKey;
  const p: Preset = PRESETS[key];

  return {
    id: crypto.randomUUID(),
    preset: key,
    name: p.label,
    shape: p.shape,
    baseUrl: p.baseUrl,
    model: p.model,
    apiKey: "",
    jsonMode: p.jsonMode,
    quirks: p.quirks ?? {},
    enabled: true,
  };
}
