# Appendix B - Ideas for Future Contributions

Verified as of laravel/framework v13.22.0 (2026-08-05). A single stamp is enough for this
appendix, unlike Appendix A's per-package dates, because every candidate below was noticed at a
different point across the whole writing process rather than verified together in one pass.

This appendix is a list, not a chapter. Writing Chapters 1 through 18 and Appendix A meant
reading through classes and methods far beyond whatever ended up in a given entry, and more than
one genuinely undocumented, realistically usable method turned up along the way with nowhere to
go: its own chapter already had a shape, and squeezing in one more entry would have broken it.
Rather than let that work disappear, every one of those finds is recorded here instead, with
enough of its own context to pick back up later. What follows is not closed and does not claim to
be complete. It is also not a replacement for the research method Chapter 0 describes: a reader
who wants to go looking for their own undocumented corner of Laravel should still read the source
and the documentation branch side by side, exactly as that chapter recommends. This list only
saves that reader a first pass, by starting from ground already covered instead of from nothing.

Each candidate that follows is recorded in the same short shape: the class or method, what it
does, why it was left out of the chapter that found it, and how it could still become a full
entry in a future edition.

## Candidates already found

- `Env::enablePutenv()` / `disablePutenv()` / `extend()` / `getRepository()` (a third, unrelated
  `extend()`, not the ones below), `Manager::getContainer()` / `setContainer()` / `getDrivers()`,
  and `MultipleInstanceManager::setApplication()` - thin, undocumented accessors and toggles
  found while writing Chapter 3, each confirmed absent from the corresponding documentation page
  by exact name, but none yet tied to a teaching scenario of its own - `Manager` and
  `MultipleInstanceManager` would keep that chapter's own package-author audience flag if
  developed further, since neither targets everyday application code. Grouped here as one
  candidate for now, though a future edition would likely split it into separate entries, since
  `Env`, `Manager`, and `MultipleInstanceManager` are three otherwise unrelated classes with
  nothing in common beyond being thin and undocumented.
- `orWhereHasMorph()` / `orWhereDoesntHaveMorph()` - closure-based `or` variants of the
  documented `whereHasMorph()`/`whereDoesntHaveMorph()`, found while writing Chapter 4, not the
  concise column/operator/value shorthand family that chapter actually covers, and confirmed
  absent from `laravel/docs` by exact name in their own right. Future cut: paired with the
  already-documented `orWhereMorphRelation()` for a fuller polymorphic-query-family entry that
  covers every `or`-prefixed variant of a polymorphic relationship query at once.
- `beforeSending()` - a real pre-send inspection and mutation hook on the HTTP client, found
  while writing Chapter 6, likely passing all three selection criteria on its own rather than
  needing another entry to lean on. Kept out only to preserve that chapter's planned four-entry
  shape, where it appears solely as a testing tool for `withNtlmAuth()`, standing in for
  assertions `Http::fake()` cannot make against an NTLM-authenticated request. Future cut: a full
  three-tier entry of its own, independent of any other HTTP client entry.
- `Illuminate\Container\Container::rebinding()` - the more general, callback-based primitive that
  Chapter 8's own `refresh()` delegates to under the hood, found while writing that chapter but
  left out since `refresh()`'s narrower, single-method-on-one-target shape fit its running
  scenario better. Future cut: a scenario that genuinely needs the fully general callback form
  `refresh()` cannot express; a minor addition to Chapter 8.
- `Illuminate\Routing\Router::uses()` - the variadic, `Str::is()` wildcard-matched sibling of
  Chapter 9's own `currentRouteUses()` (single argument, strict equality, no wildcard); that
  chapter's own Alias flag already points here for it. Future cut: a full entry of its own, or a
  joint entry contrasting the two; a minor addition to Chapter 9.
- `Illuminate\Routing\Router::pushMiddlewareToGroup()` - the append counterpart of Chapter 9's own
  `prependMiddlewareToGroup()`, the same duplicate-safe behavior in the other direction. Kept out
  to keep that chapter's entry a single prepend-and-remove pair. Future cut: a joint "runtime
  group mutation" entry paired with `prependMiddlewareToGroup()`; a minor addition to Chapter 9.
- `AuthorizesRequests::authorizeResource()` - a controller-constructor helper that wires an entire
  resource controller's actions to an actual Eloquent Policy's standard abilities through the
  `can` middleware, found while writing Chapter 10, which already contrasts it in passing with
  `Gate::resource()`'s own plain-class ability registration - a different target, not a
  competing solution to the same problem. Future cut: a full entry built around that same
  contrast; a minor addition to Chapter 10.
- `Illuminate\Cache\Repository::array()` - a fifth typed getter sitting beside Chapter 11's
  `string()`/`integer()`/`float()`/`boolean()`, the same throw-on-wrong-type shape, left out only
  because that chapter's outline named the other four. Future cut: a scenario that caches a small
  structured value rather than a single scalar, already anticipated as this book's own closing
  contribution example; a minor addition to Chapter 11.
- `Illuminate\Notifications\AnonymousNotifiable::notifyNow($notification)` - a single-argument
  variant with no `$channels` parameter, tied to on-demand notification routing
  (`Notification::route(...)->notifyNow(...)`), distinct from the instance-side
  `RoutesNotifications::notifyNow()` Chapter 12 covers. Future cut: alone, or paired with
  `Notification::route()`; a minor addition to Chapter 12.
- `broadcastAs()`, definable on a notification class and read by
  `BroadcastNotificationCreated::broadcastAs()` to rename the broadcast event, found while writing
  Chapter 12 - the same customization pattern `laravel/docs` itself documents for
  `broadcastType()` under "Customizing the Notification Type," applied to the event name instead
  of the payload's type. Future cut: paired with `broadcastType()` for a fuller "customizing
  broadcast metadata" entry; a minor addition to Chapter 12.
- `Illuminate\Console\View\Components\Ask` (`$this->components->ask()`) - the same styled
  rendering pattern Chapter 13 already covers for
  `confirm()`/`secret()`/`askWithCompletion()`, but for the classic free-text `$this->ask()`
  prompt, found while writing that chapter. Kept out since its own running scenario had no
  free-text prompt to style, only a file choice, a yes-or-no confirmation, a fixed-choice list,
  and a hidden code. Future cut: a fifth prompt in a scenario that needs open-ended input; a
  minor addition to Chapter 13.
- `Illuminate\Console\Command::isolatableId()` - a hook `CacheCommandMutex::commandMutexName()`
  checks via `method_exists()`, letting a command scope its mutex by a dynamic argument instead of
  locking once per command name, found while writing Chapter 14. Kept out since that chapter's own
  command, `stock:prune-movements`, takes only options, no positional argument worth isolating on.
  Future cut: a report command keyed by warehouse, developed alongside
  `CommandMutex`/`CacheCommandMutex`; a minor addition to Chapter 14.
- `Illuminate\Events\Dispatcher::getListeners($eventName)` / `getRawListeners()` - introspection
  of an event's registered listeners, before and after they are turned into closures, found while
  writing Chapter 15, sitting right beside that chapter's own
  `until()`/`push()`/`flush()`/`forget()`/`forgetPushed()`. Kept out since none of those entries
  needed to inspect a listener list, only to dispatch, defer, or remove one. Future cut: a
  diagnostic or test-helper scenario that inspects registered listeners rather than acting on
  them; a minor addition to Chapter 15.
- `Illuminate\Translation\Translator::string()` / `array()` / `hasForLocale()` - the first two
  throw on a wrong-shaped result the same way Chapter 11's `Cache::string()` and siblings do,
  though their own parameters resolve a translation rather than a cache read
  (`$replace`/`$locale`/`$fallback`, no `$default`); `hasForLocale()` is a fallback-free existence
  check for a key in one specific locale. Found while writing Chapter 16, right beside that
  chapter's own `handleMissingKeysUsing()`/`determineLocalesUsing()`. Kept out since its
  localization block already carried two entries built around one scenario. Future cut: a joint
  entry paired with a translation-completeness-audit scenario, such as a `lang:audit` command
  comparing every key across shipped locales; a minor addition to Chapter 16.
- `Illuminate\Cookie\CookieJar::queued($key, $default = null, $path = null)` - the internal lookup
  `hasQueued()` itself delegates to, resolving one queued cookie instance directly by name and
  path instead of a yes-or-no answer. Chapter 17's own closing already names it as an
  out-of-scope candidate for a future edition; this entry adds the concrete scenario that chapter
  did not spell out. Future cut: reading a queued cookie's actual value or attributes before the
  response is built; a minor addition to Chapter 17.
- `Illuminate\Filesystem\FilesystemAdapter::readStream()` / `writeStream()` - reading or writing
  through a PHP stream resource instead of loading the whole contents into memory, found while
  writing Chapter 18. Kept out since none of that chapter's entries needed streaming, only
  existence, integrity, and delivery of documents small enough to hold in memory. Future cut: a
  scenario that moves a large file between disks; a minor addition to Chapter 18.
- `Illuminate\Filesystem\FilesystemAdapter::providesTemporaryUrls()` /
  `providesTemporaryUploadUrls()` - a capability check answerable before calling
  `temporaryUrl()`/`temporaryUploadUrl()` and risking their `RuntimeException`, found while
  writing Chapter 18. Kept out since that chapter's own `buildTemporaryUploadUrlsUsing()` entry
  always registers a callback, making the check unconditionally true there. Future cut: a
  scenario where support is genuinely conditional, such as a runtime choice between a local and a
  cloud disk; a minor addition to Chapter 18.
- `Laravel\Passport\Passport::ignoreRoutes()` - configures whether Passport registers its own
  `/oauth/*` routes, the same naming and shape as the `ignoreRoutes()` Appendix A already covers
  for both Horizon and Pulse. Found while verifying Passport's own entry, kept out since that
  entry was already a coherent three-method scenario around the cookie-based SPA guard. Stability
  flag: Passport's own Appendix A entry already carries an explicit verify-before-production
  warning, and `docs/book-index.md` independently names Passport, alongside Cashier, as a package
  with a historically unstable API surface across minor versions - any future promotion of this
  candidate keeps that same warning. Future cut: a joint entry contrasting all three packages'
  identically named, independently implemented route-registration toggle.
- `Laravel\Telescope\Telescope::night()` - a second, separately implemented dark-theme toggle for
  a first-party dashboard, mirroring Horizon's own `night()`, which Appendix A confirms carries an
  `@deprecated` tag in the installed source with no replacement found. Found while verifying
  Telescope's own entry, kept out since that entry covers suppression and redaction, not dashboard
  theming. Future cut: verify first whether Telescope's `night()` carries the same deprecation,
  then build a joint "dark theme across first-party dashboards" entry if so.

## Already checked and the open ecosystem beyond this list

Three entries turned up during earlier chapters and were checked against the documentation
branch before being set aside for a different reason than everything above: they are simply
already documented, not left out for lack of space or fit. `Log::shareContext()` and
`sharedContext()` are covered in `laravel/docs`'s "Contextual Information" section, found while
writing Chapter 15. `Mail::alwaysTo()` is covered in that same branch's mail page, found while
writing Chapter 16, and is the exact reason that chapter's own trio of `always*` methods stops at
`alwaysFrom()`, `alwaysReplyTo()`, and `alwaysReturnPath()`. `Lang::stringable()` is covered on
the localization page, also found while writing Chapter 16. None of the three should be
reproposed without new evidence, such as a future release quietly dropping coverage a later
reader happens to notice.

Everything recorded in this appendix came from work already done, on ground this book already
walked. That is not the limit of what is out there. Laravel and the packages around it are large
enough that entire regions of both remain untouched by any chapter here, and no attempt has been
made to name them in advance. Finding one of those regions and applying Chapter 0's method to it
is exactly as valid a way to contribute as picking up any candidate already named above.

## Contributing a new entry

Turning any of the above into a full entry still has to clear the same bar every entry in this
book already cleared: a public, realistically usable method or class; genuinely absent from the
official documentation under its exact name; at least one real, runnable example built on the
book's own three-tier structure, or two tiers inside Appendix A; and a green run against the test
suite in `code/`. `CONTRIBUTING.md` and `docs/book-index.md` state these in full, so they are not
repeated here. What is worth adding is a caution specific to this list: none of these candidates
were re-verified at the moment of writing this closing section, only at the moment each was first
noticed. Laravel keeps moving, and a method flagged here as undocumented six chapters ago may
already have a documentation page by the time anyone picks it up. Re-checking the source and the
current documentation branch before writing a single line of prose is not optional, it is the
first step of the work, not a formality before it.

The concrete path from here to a pull request starts with an issue: name the candidate, link the
bullet in this appendix it came from, do that re-check, and then follow the same `chapter-N.md`
specification template already used for every chapter in this book. Once a candidate clears that
path and becomes a real entry, it should also disappear from here, with its promotion logged in
`CHANGELOG.md` the same way any other new entry is, a Minor version bump under this project's own
versioning rules. Nothing in this book has said that yet, so it is worth saying plainly now.

This static list is only as current as the edition it ships with, while a PDF, an EPUB, or a KDP
copy in someone's hands can trail behind it for a long time. The book's own repository keeps a
living version of the same idea in its issue tracker, open to anything found after this edition
went out, not only to the nineteen candidates named above. Everything else, the review process,
the licensing a contribution falls under, how a pull request gets merged, belongs to
`CONTRIBUTING.md` alone, and stays there rather than being repeated a second time in this closing
paragraph.
