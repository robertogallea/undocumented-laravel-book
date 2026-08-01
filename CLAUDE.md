# CLAUDE.md - Operating guide for this project

> Operational tool for every work session on this book. Keep it concise: it does not
> duplicate `docs/chapters-overview.md` or `docs/book-index.md`, it points to them as the
> sources of truth.

## 1. Project overview

We are writing an open-source technical book in English titled:

> **Laravel 13: The Unwritten API - A Guide to Usable but Undocumented Concepts**

**Source of truth**: the official source code, tag `v13.22.0` of `laravel/framework`, branch
`13.x` of `laravel/docs`, plus the first-party package repositories at their respective
latest stable versions. Every release of the book states the Laravel version it was verified
against; see `CHANGELOG.md` and the `laravelversion` key in `metadata.yaml`.

**Selection criteria for any entry** (all three required, see `docs/book-index.md` for the
full rationale):

1. Public method/class, realistically usable in an application (not internal plumbing:
   `build*`, `push*`, `setClient`, interface implementations like
   `ArrayAccess`/`JsonSerializable`, etc.).
2. Absent from the corresponding official documentation, verified by exact method/class
   name, not just by general topic.
3. Not a trivial alias with no instructional value of its own, unless explicitly flagged as
   such.

**Mandatory rule**: every entry has at least one real, runnable code example, never
pseudocode (see section 4).

**Structure**: `chapter-0` (Motivation and Methodology, no Part) opens the book; chapters 1-18
are grouped into 8 named Parts; `chapter-19` (Final Chapter - Conclusions, no Part) closes the
main body; `chapter-A` and `chapter-B` are the appendices.

| Part | Title | Chapters |
|---|---|---|
| I | Code Fundamentals | 1-3 |
| II | Eloquent Beyond Basic Relationships | 4-5 |
| III | HTTP, APIs, and Testing | 6-7 |
| IV | Container and Routing | 8-9 |
| V | Authorization, Validation, and Asynchrony | 10-12 |
| VI | Artisan Commands | 13-14 |
| VII | Observing and Communicating | 15-16 |
| VIII | Application Infrastructure | 17-18 |

When a Part is referred to by name in prose, always write `the "Name" Part`, never the bare
proper noun.

For the full per-chapter content (entries, outlines, example overviews) see
`docs/chapters-overview.md`; for audience/format/versioning/length see `docs/book-index.md`.

## 2. Folder structure

```
.
├── CLAUDE.md
├── README.md, CONTRIBUTING.md, LICENSE, LICENSE-CODE, CHANGELOG.md, VERSION
├── build-book.sh, to_pdf.sh, to_epub.sh
├── metadata.yaml, template.tex, epub-template.xhtml, epub.css, section-divider.lua
├── docs/
│   ├── chapters-overview.md, book-index.md, kdp-snapshots.md
│   └── chapters/chapter-N/chapter-N.md + prompts/step-M.md
├── chapters/
│   └── chapter-N/chapter-N-text.md
├── site/                # Docusaurus, synced from chapters/, see section 6
├── .github/workflows/    # ci.yml, deploy-site.yml, build-artifacts.yml
└── code/                 # companion Laravel app, independent git repo, gitignored here
```

Rules (binding):

- **Each chapter is isolated** in its own `chapters/chapter-N/` folder. Do not mix content
  from different chapters in the same file.
- **The spec and prompts for a chapter live in `docs/chapters/chapter-N/`**, not inside
  `chapters/chapter-N/`: the latter holds only the final prose (`chapter-N-text.md`).
- **`docs/` is the planning/spec layer, never the published site's content.** Docusaurus
  reads from `site/docs/`, which is generated and gitignored (see section 6) - never hand-edit
  it, and never confuse it with the top-level `docs/`.
- **The companion application lives in `code/`**, an independently git-tracked, gitignored
  project (see section 6 of `code/README.md`). Every code example in every chapter is
  extracted from there with `git -C code show <tag>:<path>`, never invented.
- **Before drafting any entry, re-verify it against the actual tagged `laravel/framework`
  source and the actual `laravel/docs` branch content** - the specs in `docs/` are a starting
  point written once; the live source is the authority, and may have changed since (a method
  may have been documented, removed, or changed signature).
- **Numbering**: `chapter-0` (motivation/methodology) .. `chapter-18` (last Part chapter),
  `chapter-19` (Final Chapter - Conclusions), then the appendices `chapter-A`, `chapter-B`.
- **`code/` tag convention**: milestone tags `ch01-complete` .. `ch18-complete`, cut when a
  chapter's full example set is done - not a per-increment tag scheme like a single growing
  app, since there is no single continuously-growing example application in this book.

## 3. Reference files and reading order

Before writing or modifying any chapter, always consult, in this order:

1. **`docs/chapters-overview.md`** - per-chapter short description, outline, and example
   overview. Consult it to understand the chapter's purpose and stay coherent with the rest
   of the book.
2. **`docs/book-index.md`** - audience, format, the three-tier example rule, selection
   criteria, Part/chapter list, versioning and length targets.
3. **`docs/chapters/chapter-N/chapter-N.md`** - the chapter's operational spec (Summary /
   Objectives / Requirements / Writing phases).
4. **The actual Laravel source and docs**: grep the tagged `laravel/framework` checkout and
   the `laravel/docs` branch for every method/class name before writing a word of prose - this
   step has no equivalent in a book about a single example domain, and is what makes every
   other step trustworthy.

## 4. Writing conventions (mandatory)

- **Language**: English only for now. An Italian edition is planned but not live yet (see
  section 9) - do not create `chapters-it/` or similar until that phase formally starts.
- **Banned characters**: never use `—` (em dash), `«`, `»`, or emoji (including check/cross
  marks). Use straight quotes in source; smart quotes are produced by Pandoc, not typed by
  hand.
- **Three-tier example structure is mandatory** for every main-body entry (chapters 0-19):
  1. Minimal isolated snippet - the method signature in action, first contact only.
  2. "Documented way vs. discovered way" comparison - the known API next to the undocumented
     one, on the same problem.
  3. Real scenario - placed in a recognizable situation (an API controller, a feature test, a
     queued job), never a generic model repeated chapter after chapter.

  Appendix A uses tiers 1 and 3 only, in abbreviated form (it is a quick reference, not a
  narrative chapter). Chapters 0, 19, and Appendix B carry no code examples at all - they are
  explicitly editorial/discursive.
- **Every example is real code extracted from `code/`** via `git -C code show <tag>:<path>` or
  `git -C code diff <tagA> <tagB>`, never invented pseudocode. Unlike a book built around one
  continuously-growing example app, this book has no preliminary-pseudocode narrative stage:
  it is code-first throughout.
- **Permitted formats**: inline code blocks and Mermaid diagrams for flows that benefit from
  visualization (e.g. a pipeline's lifecycle, a binding's resolution order). No
  images/screenshots, so the book does not age with every Laravel release.
- **Mandatory per-entry flagging checklist** (apply to every entry before considering a
  section done):
  - **Audience shift**: does this entry address application developers, or package/library
    authors (e.g. `Manager`, `MultipleInstanceManager`)? State it explicitly if it's the
    latter.
  - **Alias**: is this a trivial alias of a documented method (e.g. `Cache::sear()` =
    `rememberForever()`)? Flag it as such, don't present it as a new concept.
  - **Stability**: does this entry belong to a package with a historically unstable API
    surface across minor versions (e.g. Passport, Cashier)? Add an explicit
    verify-before-production note.
  - **Case type**: is this an undocumented method inside an otherwise-documented class, an
    entire undocumented class, or a class with a docs page that covers only some of its
    methods (e.g. `Pipeline`)? The third case must state up front what is already documented
    elsewhere.
  - Never present something already widely known in the community (e.g. `tap()`,
    `optional()`) as "hidden".
- **Version pinning**: `v13.22.0` (and the first-party packages' latest stable versions at
  time of writing) is binding for every example in every chapter. Do not introduce
  incompatible syntax or versions.
- **No invented domain specifics**: every entry's behavior, signature, and example scenario
  are derived from the actual source/tests/changelog, never improvised.
- **No references to internal writing phases**: chapter prose and `code/` comments never cite
  "Phase 1", "Phase 2", etc. - refer to the concept or the chapter's own narrative point
  instead.

## 5. Per-chapter / per-entry writing workflow

1. Read `docs/chapters/chapter-N/chapter-N.md` (plus `docs/chapters-overview.md` and
   `docs/book-index.md`, section 3).
2. For each entry in the chapter, re-verify the three selection criteria against the actual
   tagged Laravel source and docs branch - do not trust the spec text alone.
3. Write the `code/` example and its Pest test first; confirm it is green via `code/`'s own
   CI (`code/.github/workflows/tests.yml`) before writing any prose about it.
4. Write the prose, extracting the real snippet from `code/` (section 4), following the
   three-tier structure and running the mandatory flagging checklist per entry.
5. Follow the chapter's "Writing phases" in sequence, ideally one prompt per phase
   (`docs/chapters/chapter-N/prompts/step-M.md`, one session/turn per phase).
6. Run the final coherence check the spec requires: naming, version pinning, and continuity
   with neighboring chapters.
7. Update the progress table (section 8) and rebuild (section 6).

## 6. Full-book build pipeline

`build-book.sh` concatenates `chapters/chapter-{0..19,A,B}/chapter-N-text.md` into `book.md`,
injecting a Part-divider heading before chapters 1, 4, 6, 8, 10, 13, 15, and 17 (8 dividers,
matching the table in section 1). The chapter range (`seq 0 19 A B`) and the divider mapping
are **hardcoded** in `build-book.sh`: if the book's structure ever changes, update the script
directly, not only `docs/book-index.md`.

```bash
bash build-book.sh   # -> book.md, reports missing chapters on stderr
bash to_pdf.sh        # -> book.pdf (pandoc + xelatex, template.tex, metadata.yaml)
bash to_epub.sh       # -> book.epub (pandoc, epub-template.xhtml, epub.css)
```

The Docusaurus site (`site/`) is a separate, isolated Node project. `site/scripts/sync-docs.mjs`
regenerates `site/docs/` (gitignored, never hand-edited) from `chapters/`, grouping chapters
into the same 8 Parts via numbered folders so Docusaurus's autogenerated sidebar reproduces
the book's structure. Run `npm run sync` before `npm start`/`npm run build` inside `site/`.

There is no `check-accents.sh` in this project (the AI book's accent-style linter is Italian
specific): an equivalent linter for the future Italian edition will need to be authored fresh,
not ported, once that phase starts (section 9).

## 7. Governance and distribution

- **Dual license**: book text is CC BY-SA 4.0 (`LICENSE`); all code, including inline
  snippets, is MIT (`LICENSE-CODE`, mirrored at `code/LICENSE`).
- **Contribution model**: single maintainer, `CONTRIBUTING.md`'s 4-point acceptance checklist
  (public/realistic API, absent from docs by exact name, three-tier example, passes CI).
- **Versioning**: `VERSION` holds the book's own SemVer, decoupled from the Laravel version.
  Major = restructuring of Parts/chapters or a change in selection criteria. Minor = new
  entries added. Patch = corrections, obsolete-example fixes, or removal of entries Laravel
  has since documented. Every `CHANGELOG.md` entry states both the book version and the
  Laravel version verified.
- **Two independent CIs**: `code/.github/workflows/tests.yml` (inside the separately-tracked
  `code/` repo) runs every code example as a real Pest test plus Pint - this is the "every
  snippet is runnable" guarantee. The outer repo's `.github/workflows/ci.yml` runs
  `build-book.sh`, a markdown link check, and a Docusaurus build check on every push/PR - fast
  checks only. `.github/workflows/build-artifacts.yml` builds the PDF/EPUB via pandoc, but
  only on `workflow_dispatch` or a release tag (slow, not run on every push).
  `.github/workflows/deploy-site.yml` publishes `site/` to GitHub Pages on push to `main`.
  Because `code/` is gitignored from the outer repo, outer CI cannot verify that a chapter
  actually references a real `code/` tag - confirm this manually per chapter instead.
- **Four distribution channels**, all disclosing CC BY-SA 4.0 and linking back to the public
  repo: the always-current public repo, a Docusaurus site on GitHub Pages (versioned per
  Laravel major, i18n-ready), a free downloadable PDF, and a KDP snapshot (updated roughly
  annually at each Laravel major, logged in `docs/kdp-snapshots.md`).

## 8. Progress status

Update this table manually every work session.

Legend: to plan, planned (`chapter-N.md` exists), writing, complete and reviewed, text present
but not yet tracked in a session (to reconcile).

| Ch. | Title | Status | Notes |
|---:|---|:---:|---|
| 0 | Motivation and Methodology | to plan | |
| 1 | Str beyond the better-known helpers | writing | Text complete (`chapters/chapter-1/chapter-1-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch01-complete` tag cut. Pending maintainer read-through before marking complete. |
| 2 | Arr and Collection: the methods nobody imports | writing | Text complete (`chapters/chapter-2/chapter-2-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch02-complete` tag cut. Pending maintainer read-through before marking complete. |
| 3 | Support classes with no docs page (and one with partial docs) | writing | Text complete (`chapters/chapter-3/chapter-3-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch03-complete` tag cut. Pending maintainer read-through before marking complete. |
| 4 | Querying relationships without `whereHas` | writing | Text complete (`chapters/chapter-4/chapter-4-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch04-complete` tag cut. Entry list corrected mid-writing after re-verification found the originally planned `whereRelation()`/`orWhereRelation()` and `whereMorphRelation()`/`whereNotMorphedTo()` documented in `laravel/docs` `13.x`; replaced with their undocumented negation siblings (see `docs/chapters/chapter-4/chapter-4.md`). Pending maintainer read-through before marking complete. |
| 5 | Lesser-known query builder features | writing | Text complete (`chapters/chapter-5/chapter-5-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch05-complete` tag cut. Two entries corrected mid-writing after re-verification: `withAggregate()` "and family" narrowed to `withAggregate()` alone after finding `withAvg()`/`withMax()`/`withMin()`/`withSum()`/`withExists()` documented in `laravel/docs` `13.x`; `withWhereRelation()` reframed away from the originally assumed aggregation premise (it actually pairs `whereRelation()` with a matching eager load, the concise sibling of the documented `withWhereHas()`), which also required correcting a forward-reference sentence already published in `chapters/chapter-4/chapter-4-text.md` (see `docs/chapters/chapter-5/chapter-5.md`'s "Nota di correzione"). Pending maintainer read-through before marking complete. |
| 6 | The HTTP client beyond the basics | writing | Text complete (`chapters/chapter-6/chapter-6-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch06-complete` tag cut. Three entries corrected mid-writing after re-verification (see `docs/chapters/chapter-6/chapter-6.md`'s "Nota di riverifica"): `withNtlmAuth()` gained an explicit stability warning (Guzzle 7.12+ deprecates the `'ntlm'` auth type, removed in 8.0) and a testability note (NTLM never appears on a faked request's headers, unlike Basic auth, so the test uses `beforeSending()` instead); `dontTruncateExceptions()`'s comparison reframed as two documented/undocumented siblings rather than default-vs-discovered, and clarified that it switches to the entire raw HTTP response, not just an untruncated body; `stub()`'s real scenario rebuilt around an ad hoc probe after confirming it cannot reach a request built inside another class the way `Http::fake()` can. Post-close code review pass added: a NTLM explainer paragraph, a security note on `dontTruncateExceptions()` leaking `Authorization` headers for Basic/Bearer-authenticated requests, and `try`/`finally` cleanup in the `sink()` tests (`code/` `ch06-complete` tag moved to the fix commit). Pending maintainer read-through before marking complete. |
| 7 | Testing responses like an expert | writing | Text complete (`chapters/chapter-7/chapter-7-text.md`); `code/` examples and Pest tests green; coherence check passed and `ch07-complete` tag cut. Entry list corrected mid-writing after re-verification found the originally planned `assertSuccessfulPrecognition()` documented in `laravel/docs` `13.x`'s `precognition.md` (Testing section), missing only from the general `http-tests.md` reference; dropped with no replacement, so the chapter stands at four entries (see `docs/chapters/chapter-7/chapter-7.md`'s "Nota di correzione"). Part III - HTTP, APIs, and Testing is now fully written. Post-close code review pass fixed a `TicketController::show()` N+1 (missing eager load) and added a `distinct` validation rule on submitted tag ids to avoid a raw database exception on duplicates, with a regression test (`code/` `ch07-complete` tag moved to the fix commit). Pending maintainer read-through before marking complete. |
| 8 | The binding lifecycle | to plan | |
| 9 | The Router facade under the hood | to plan | |
| 10 | Advanced authorization and validation | to plan | |
| 11 | Cache beyond `remember` | to plan | |
| 12 | Job chaining, queues, and notifications outside the standard flow | to plan | |
| 13 | Component-based output for Artisan commands | to plan | |
| 14 | Reusable behaviors for custom commands | to plan | |
| 15 | Events and logs beyond the standard flow | to plan | |
| 16 | Mail and localization | to plan | |
| 17 | Configuration and cookies at runtime | to plan | |
| 18 | Filesystem and reflection | to plan | |
| 19 | Final Chapter - Conclusions | to plan | |
| A | The Hidden APIs of the First-Party Packages | to plan | |
| B | Ideas for Future Contributions | to plan | |

## 9. Future Italian-edition phase (documented, not built)

An Italian edition is part of the long-term plan (see the original book specification) but is
explicitly out of scope until the English edition stabilizes. When that phase starts:

- Add `chapters-it/chapter-N/chapter-N-text.md`, mirroring `chapters/` exactly, without
  touching the English structure.
- Add `build-book-it.sh` and `metadata-it.yaml`, mirroring `build-book.sh`/`metadata.yaml`.
- Docusaurus i18n: `site/i18n/it/...` is Docusaurus's own convention and does not collide with
  `chapters-it/`.
- An Italian accent/apostrophe linter equivalent to the AI book's `check-accents.sh` will need
  to be authored fresh for this project - it is not a straight port, since the substitution
  problem it checks for is Italian-specific.
