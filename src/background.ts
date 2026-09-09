// Service worker. Owns API keys and runs every provider call — content scripts
// never see a key, and their fetches would be bound by the page origin anyway.

import { complete } from "./providers/index.js";
import { resolveSiteContext } from "./context.js";
import { migrateHotkeys } from "./hotkeys.js";
import {
  TRANSLATE_SCHEMA,
  composeSystemPrompt,
  explainSystemPrompt,
  REFINEMENTS,
} from "./prompts.js";
import type { AnnotatedResult, Message, Refinement } from "./types.js";

const HISTORY_TURNS = 6;

// ---------------------------------------------------------------- site config

async function getSiteContext(domain: string): Promise<string> {
  const { siteContexts = {} } = await chrome.storage.local.get("siteContexts");
  return resolveSiteContext(domain, siteContexts as Record<string, string>);
}

async function getHistory(domain: string): Promise<string[]> {
  const { history = {} } = await chrome.storage.session.get("history");
  return (history as Record<string, string[]>)[domain] ?? [];
}

async function pushHistory(domain: string, line: string): Promise<void> {
  const { history = {} } = await chrome.storage.session.get("history");
  const store = history as Record<string, string[]>;
  const next = [...(store[domain] ?? []), line].slice(-HISTORY_TURNS);
  await chrome.storage.session.set({ history: { ...store, [domain]: next } });
}

// ------------------------------------------------------------------- handlers

async function handleTranslate(msg: {
  text: string;
  domain: string;
  refine?: Refinement | null;
}): Promise<AnnotatedResult> {
  const [siteContext, history] = await Promise.all([
    getSiteContext(msg.domain),
    getHistory(msg.domain),
  ]);

  const user = msg.refine
    ? `${msg.text}\n\n---\nREVISION INSTRUCTION: ${REFINEMENTS[msg.refine] ?? msg.refine}`
    : msg.text;

  const result = await complete({
    system: composeSystemPrompt({ siteContext, history }),
    user,
    schema: TRANSLATE_SCHEMA,
    maxTokens: 1024,
    temperature: 0.3,
  });

  if (!msg.refine) await pushHistory(msg.domain, `Ich: ${result.german}`);
  return result;
}

async function handleExplain(msg: { text: string; domain: string }): Promise<AnnotatedResult> {
  const siteContext = await getSiteContext(msg.domain);

  const result = await complete({
    system: explainSystemPrompt({ siteContext }),
    user: msg.text,
    schema: TRANSLATE_SCHEMA,
    maxTokens: 1024,
    temperature: 0.2,
  });

  await pushHistory(msg.domain, `Berater: ${msg.text.slice(0, 300)}`);
  return result;
}

// -------------------------------------------------------------------- routing

async function route(msg: Message): Promise<unknown> {
  switch (msg.type) {
    // Cheap no-op the content script fires on focus, so the worker is already
    // warm by the time the user finishes typing. MV3 workers idle out after
    // ~30s and the cold start is real perceived latency.
    case "ping":
      return { ok: true };
    case "openOptions":
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    case "translate":
      return handleTranslate(msg);
    case "explain":
      return handleExplain(msg);
    default:
      throw new Error(`Unknown message type`);
  }
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (!msg?.type) return false;

  route(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );

  return true; // keep the channel open for the async response
});

// --------------------------------------------------------------- context menu

const MENU_ID = "zalang-explain";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "zalang: توضیح بده (explain this German)",
    contexts: ["selection"],
  });
  // Runs on every install and update — not just the next time options opens —
  // so an existing user's custom hotkeys and blockEnter setting survive an
  // update even if they never revisit settings afterward.
  void migrateHotkeys();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  chrome.tabs.sendMessage(
    tab.id,
    { type: "explain-selection", text: info.selectionText },
    { frameId: info.frameId },
  );
});

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

// "Block plain Enter" is meant as a temporary posture for the length of one
// chat, not a permanent change to how Enter behaves on every site — auto-off
// on browser restart bounds how long forgetting to switch it back can last.
chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.sync.get("hotkeys").then(({ hotkeys }) => {
    const current = hotkeys as { blockEnter?: boolean } | undefined;
    if (current?.blockEnter) {
      void chrome.storage.sync.set({ hotkeys: { ...current, blockEnter: false } });
    }
  });
});
