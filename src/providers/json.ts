// JSON coercion helpers.
//
// The wire format for structured output is portable across "OpenAI-compatible"
// providers; enforcement is not. So: ask for the strictest mode the profile
// claims to support, then ALWAYS run the tolerant parser on whatever comes back.

import type { JsonSchema, TranslateResult } from "../types.js";

/**
 * Pull a JSON object out of a model response that may be wrapped in prose,
 * markdown fences, or both.
 */
export function extractJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();

  // ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // fall through to brace matching
  }

  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Validate and normalise a translation result. Returns null if unusable — the
 * caller must then fall through rather than blank the user's message.
 */
export function normaliseResult(obj: unknown): TranslateResult | null {
  if (!obj || typeof obj !== "object") return null;

  const rec = obj as Record<string, unknown>;
  if (typeof rec.german !== "string" || !rec.german.trim()) return null;

  return {
    german: rec.german.trim(),
    back_translation_fa:
      typeof rec.back_translation_fa === "string" ? rec.back_translation_fa.trim() : "",
    notes: Array.isArray(rec.notes)
      ? rec.notes
          .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
          .map((n) => n.trim())
      : [],
  };
}

/** Some providers (Groq) reject a schema unless every property is in `required`. */
export function withAllPropsRequired(schema: JsonSchema): JsonSchema {
  if (schema?.type !== "object" || !schema.properties) return schema;
  return { ...schema, required: Object.keys(schema.properties) };
}

/**
 * Gemini's response_schema uses uppercase type names and rejects
 * `additionalProperties`.
 */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties") continue;

    if (k === "type" && typeof v === "string") {
      out.type = v.toUpperCase();
    } else if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(
        Object.entries(v as Record<string, JsonSchema>).map(([pk, pv]) => [pk, toGeminiSchema(pv)]),
      );
    } else if (k === "items") {
      out.items = toGeminiSchema(v as JsonSchema);
    } else {
      out[k] = v;
    }
  }

  return out as unknown as JsonSchema;
}
