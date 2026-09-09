# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow the constraint that Chrome
extension manifests only accept plain `MAJOR.MINOR.PATCH` (no semver prerelease suffix), so a beta is
marked by the git tag and GitHub Release, not by the version number itself.

## [Unreleased]

## [0.1.0-beta.1] - 2026-09-09

### Added

- Initial public beta: translate Farsi/Finglish into native, formal German directly inside any chat
  box, with a Farsi back-translation shown before you send.
- Explain flow: select an operator's German reply and get it explained in Farsi.
- Provider-agnostic — OpenAI-compatible endpoints (including local Ollama), Anthropic, and Gemini, with
  automatic fallback across whichever providers are configured.
- Per-site conversation context and short-term history to improve translation accuracy.
- Configurable hotkeys, handled in-page so they work inside iframed chat widgets.

[Unreleased]: https://github.com/badoriie/zalang/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/badoriie/zalang/releases/tag/v0.1.0-beta.1
