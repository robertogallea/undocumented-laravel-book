# Contributing

This book is open source and conceived as a living document, not a static edition: it is
meant to be corrected, extended, and kept current as Laravel evolves. Contributions are
welcome, within the acceptance criteria below.

## Governance

Single maintainer: every pull request is reviewed and approved by the book's author (no
delegation to cross-review or distributed merge rights, at least at this stage). Propose
non-trivial changes as an issue first, so the shape of an entry can be agreed on before you
invest time writing it.

## Acceptance checklist for a new entry

A new entry (a method, class, or feature presented as "undocumented") is only accepted if
it meets all four of the following:

1. **Public and realistically usable.** It is a public method or class that an application
   developer could actually reach and use, not internal plumbing (`build*`, `push*`,
   `setClient`, interface implementations like `ArrayAccess`/`JsonSerializable`, etc.).
2. **Absent from the official documentation**, verified by the exact method or class name,
   not merely by general topic. If the class has a docs page that covers only some of its
   methods (like `Pipeline`), say so explicitly rather than presenting the whole class as
   secret.
3. **At least one real, runnable code example**, following the book's three-tier structure
   (minimal snippet, documented-vs-discovered comparison, real scenario) - two tiers
   (minimal snippet + real scenario) for Appendix A entries.
4. **Passes CI.** The example must run as a real, green test in `code/` (see
   `code/.github/workflows/tests.yml`), against the Laravel version currently declared in
   `metadata.yaml`.

Also apply the flagging rules from `CLAUDE.md` section 4: call out any audience shift (e.g.
an entry aimed at package authors rather than application developers), any alias with no
instructional value of its own, and any package with a historically unstable API surface
(e.g. Passport, Cashier) that needs a stability warning. Do not present anything already
widely known in the community (e.g. `tap()`, `optional()`) as "hidden".

## Local verification

Before opening a pull request:

```bash
# Code examples and their tests
cd code && composer install && vendor/bin/pest && vendor/bin/pint --test

# Site builds cleanly
cd site && npm ci && npm run sync && npm run build

# The book assembles without errors
bash build-book.sh
```

## Licensing of contributions

By contributing, you agree that your prose contributions are licensed under CC BY-SA 4.0
(see `LICENSE`) and your code contributions under the MIT License (see `LICENSE-CODE`),
consistent with the rest of the project.
