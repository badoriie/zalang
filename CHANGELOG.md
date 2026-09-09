# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow the constraint that Chrome
extension manifests only accept plain `MAJOR.MINOR.PATCH` (no semver prerelease suffix), so a beta is
marked by the git tag and GitHub Release, not by the version number itself.

## [Unreleased]

### Security

- Fixed a synthetic-event vulnerability present in v0.1.0-beta.1 and v0.1.0-beta.2: without an
  `isTrusted` check, any web page could dispatch a fake keyboard event to silently trigger
  translate/explain in the background, spending the user's configured API key with no click and no
  visible UI. Guarded on every content-script listener.
- Hotkeys moved from `chrome.storage.local` to `chrome.storage.sync`, so the content script no longer
  subscribes to the storage area API keys live in.
- Recent-message history (which can include the operator's own words) and site context are now
  explicitly delimited as untrusted data in the system prompt, closing a prompt-injection vector.
- API keys are now redacted from provider error messages before they can reach the visible overlay.
- Subdomain site-context matching (new in beta.2) hardened against common ccTLD public suffixes
  (`co.uk`, `com.au`, ...) and several shared hosting/support-widget platforms it previously missed.

## [0.1.0-beta.2] - 2026-09-09

### Added

- Optional "Block plain Enter from sending" setting, so a Farsi message can't be sent by habit before
  it's translated. Off by default.
- "Reset hotkeys to default" button in Settings.

### Fixed

- Conversation context now applies across subdomains — a context configured for `example.de` was
  silently ignored on `chat.example.de`, the hostname a chat widget is far more likely to actually be
  on.

## [0.1.0-beta.1] - 2026-09-09

### Added

- Initial public beta: translate Farsi/Finglish into native, formal German directly inside any chat
  box, with a Farsi back-translation shown before you send.
- Explain flow: select an operator's German reply and get it explained in Farsi.
- Provider-agnostic — OpenAI-compatible endpoints (including local Ollama), Anthropic, and Gemini, with
  automatic fallback across whichever providers are configured.
- Per-site conversation context and short-term history to improve translation accuracy.
- Configurable hotkeys, handled in-page so they work inside iframed chat widgets.

[Unreleased]: https://github.com/badoriie/zalang/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.2]: https://github.com/badoriie/zalang/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/badoriie/zalang/releases/tag/v0.1.0-beta.1
