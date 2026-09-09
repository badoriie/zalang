// Resolves which configured site-context entry, if any, applies to a given
// hostname. Pulled out of background.ts so the parent-domain walk can be
// unit tested without touching chrome.storage.

// Chat widgets on these hosts are shared by many unrelated companies
// (yourcompany.zendesk.com, another-company.zendesk.com, ...). A user
// naturally configures the specific subdomain they see, which still matches
// exactly — this only stops resolution from walking further up to the bare
// platform domain, which would leak one company's context into another's.
const SHARED_WIDGET_SUFFIXES = new Set([
  "zendesk.com",
  "intercom.io",
  "freshchat.com",
  "freshworks.com",
  "livechatinc.com",
  "drift.com",
  "tawk.to",
  "crisp.chat",
  "salesforce.com",
  "force.com",
]);

export function resolveSiteContext(domain: string, store: Record<string, string>): string {
  // The chat widget is very often on a subdomain (chat.example.de) even
  // though the user naturally types the company's root domain in settings —
  // an exact-only lookup left that context silently unused. Walk from the
  // full hostname up toward the root, matching the most specific configured
  // entry, but never strip down to a bare single-label TLD (or one entry
  // would apply to every site under it).
  const labels = domain.split(".");
  for (let i = 0; i < labels.length; i++) {
    if (i > 0 && labels.length - i < 2) break;
    const candidate = labels.slice(i).join(".");
    if (i > 0 && SHARED_WIDGET_SUFFIXES.has(candidate)) continue;
    if (store[candidate] !== undefined) return store[candidate];
  }
  return "";
}
