export type ProviderShape = "openai-compat" | "anthropic" | "gemini";

/** How hard we can push a provider to return JSON. Support is not portable. */
export type JsonMode = "schema" | "object" | "none";

export interface ProviderQuirks {
  /** Groq rejects a schema unless every property is listed in `required`. */
  allPropsRequired?: boolean;
  /** OpenRouter: only route to upstreams that honour `response_format`. */
  requireParameters?: boolean;
  /** Current Claude models reject `temperature`; older pinned ones accept it. */
  allowsTemperature?: boolean;
}

export interface Profile {
  id: string;
  preset: string;
  name: string;
  shape: ProviderShape;
  baseUrl: string;
  model: string;
  apiKey: string;
  jsonMode: JsonMode;
  quirks: ProviderQuirks;
  enabled: boolean;
  /** Override for non-standard auth on a custom endpoint. */
  authHeader?: string;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface CompletionRequest {
  system: string;
  user: string;
  schema: JsonSchema | null;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface TranslateResult {
  german: string;
  back_translation_fa: string;
  notes: string[];
}

/** A result plus the diagnostics the overlay shows. */
export interface AnnotatedResult extends TranslateResult {
  _profile?: string;
  _ms?: number;
  /** Provider returned unparseable JSON; German is raw and there is no back-translation. */
  _degraded?: boolean;
}

export interface Adapter {
  complete(req: CompletionRequest, profile: Profile): Promise<string>;
  listModels(profile: Profile): Promise<string[]>;
}

export type Refinement = "shorter" | "formal" | "detail" | "regenerate";

export type Message =
  | { type: "ping" }
  | { type: "openOptions" }
  | { type: "translate"; text: string; domain: string; refine?: Refinement | null }
  | { type: "explain"; text: string; domain: string };

export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

export interface Hotkey {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface Hotkeys {
  translate: Hotkey;
  explain: Hotkey;
}

export interface HotkeySettings extends Hotkeys {
  /** Swallow a bare Enter in any editable so it can never submit the chat form by accident. */
  blockEnter: boolean;
}
