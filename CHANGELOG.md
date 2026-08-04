# Changelog

All notable changes to this book are documented here, following the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This book has its own SemVer,
decoupled from the Laravel version (see `VERSION` and `docs/book-index.md` for the
major/minor/patch rules).

Every entry below must state both the book version and the Laravel version it was verified
against (e.g. "book v0.2.0, valid for Laravel v13.24.0"), plus what changed for individual
API entries: newly added, changed, removed (because Laravel has since documented it), or
fixed (a stale or broken example).

## [Unreleased]

### Added

- Appendix A (The Hidden APIs of the First-Party Packages) - ten first-party package entries,
  each verified against its own latest stable release, independent of the `laravelversion` this
  book otherwise pins to. Versions verified 2026-08-04, for a future patch pass to re-check
  without archaeology through git history:
  - `laravel/sanctum` v4.3.3
  - `laravel/pennant` v1.24.0
  - `laravel/scout` v11.5.0
  - `laravel/pulse` v1.8.0
  - `laravel/horizon` v5.48.2
  - `laravel/telescope` v5.22.0
  - `laravel/passport` v13.7.5
  - `laravel/fortify` v1.37.3
  - `laravel/folio` v1.1.19
  - `laravel/socialite` v5.29.0
  - `laravel/reverb` was investigated for a planned `acceptClientEventsFrom()` entry and dropped
    entirely - no such method exists anywhere in the package; the real mechanism is a
    configuration key (`accept_client_events_from`), not a method or a class. See
    `docs/chapters/chapter-A/chapter-A.md`'s "Nota di correzione (Fase 12, Reverb)" before
    re-attempting this package.

### Changed

### Fixed

### Removed
