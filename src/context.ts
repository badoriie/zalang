// Resolves which configured site-context entry, if any, applies to a given
// hostname. Pulled out of background.ts so the parent-domain walk can be
// unit tested without touching chrome.storage.

// Chat widgets on these hosts are shared by many unrelated companies
// (yourcompany.zendesk.com, another-company.zendesk.com, ...), as is generic
// multi-tenant app/static hosting (yourcompany.vercel.app). A user naturally
// configures the specific subdomain they see, which still matches exactly —
// this only stops resolution from walking further up to the bare platform
// domain, which would leak one company's context into another's.
const SHARED_WIDGET_SUFFIXES = new Set([
  "zendesk.com",
  "intercom.io",
  "freshchat.com",
  "freshworks.com",
  "freshdesk.com",
  "livechatinc.com",
  "livechat.com",
  "drift.com",
  "tawk.to",
  "crisp.chat",
  "salesforce.com",
  "force.com",
  "my.site.com",
  "service-now.com",
  "userlike.com",
  "tidio.com",
  "jivosite.com",
  "smartsupp.com",
  "zopim.com",
  "atlassian.net",
  "github.io",
  "pages.dev",
  "vercel.app",
  "netlify.app",
  "web.app",
  "firebaseapp.com",
  "appspot.com",
  "azurewebsites.net",
  "herokuapp.com",
  "workers.dev",
]);

// Second-level suffixes that are themselves public — co.uk, com.au — not a
// specific company's domain. Not a full Public Suffix List: bundling one
// means carrying a large, frequently-changing data file at runtime, which
// this project avoids (see CLAUDE.md, "no runtime dependencies"). Just the
// common ones a user talking to international companies is likely to hit.
// Without this, a context configured for "co.uk" would apply to every UK
// company's site.
const PUBLIC_SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "me.uk",
  "ltd.uk",
  "plc.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.za",
  "com.br",
  "com.tr",
  "com.mx",
  "com.cn",
  "com.sg",
  "co.jp",
  "ne.jp",
  "or.jp",
  "co.in",
  "co.il",
  "co.kr",
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
    if (
      i > 0 &&
      (SHARED_WIDGET_SUFFIXES.has(candidate) || PUBLIC_SECOND_LEVEL_SUFFIXES.has(candidate))
    ) {
      continue;
    }
    if (store[candidate] !== undefined) return store[candidate];
  }
  return "";
}
