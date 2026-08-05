# Appendix A - The Hidden APIs of the First-Party Packages

Every chapter so far has asked the same question of Laravel's own core: which public,
realistically usable method or class never made it into the official documentation. This
appendix asks the same question of ten first-party packages built around that core: Sanctum,
Pennant, Scout, Pulse, Horizon, Telescope, Passport, Fortify, Folio, and Socialite. Each of them
ships and versions on its own schedule, independent of the framework itself, so this
appendix is not meant to be read start to finish the way Chapters 1 through 18 or Appendix B are.
Read it in whatever order is useful. Every package section below is self-contained: none of them
continues the one before it, and none assumes any other section has been read first. Where the
rest of this book is pinned throughout to `laravel/framework` v13.22.0, every entry here instead
carries its own package version and its own verification date, tracked independently, package by
package.

Each entry below also carries four short labels, defined once here rather than re-explained
ten times. Audience states whether the method addresses an application developer, the book's
default reader, or, less often, a package or subsystem author instead. Alias flags a method that
is a trivial rename of one already documented elsewhere, with no behavior of its own worth
learning separately. Stability warns that the package an entry belongs to has a history of
changing its public API across minor versions, and that the entry should be re-verified against
the installed version before any production use. Case type states whether an entry is an
undocumented method inside an otherwise-documented class, an entire undocumented class, or a
class whose own documentation page covers only some of its methods.

| Package | Method(s) | Description |
|---|---|---|
| Sanctum | `PersonalAccessToken::cant()` | Checks a token's own abilities directly, not only the current request's token |
| Pennant | `Feature::getAllMissing()` | Resolves a feature across several scopes in one call, skipping already-cached ones |
| Scout | `withScoutMetadata()`, `syncWithSearchUsingQueue()` | Attaches transient hit metadata, and routes a model's own sync jobs to a queue |
| Pulse | `Pulse::ignore()`, `Pulse::ignoreRoutes()`, `Pulse::rescue()`, `Pulse::lazy()` | Suppresses recording, skips its own dashboard route, contains exceptions, defers a closure to ingest time |
| Horizon | `Horizon::night()`, `Horizon::use()` | A deprecated dark-theme toggle and a programmatic Redis connection switch |
| Telescope | `withoutRecording()`, `hideRequestParameters()`, `hideResponseParameters()` | Suspends recording for a block, redacts named request/response fields |
| Passport | `withCookieSerialization()`, `withCookieEncryption()`, `ignoreCsrfToken()` | Configures its own cookie-based SPA authentication guard |
| Fortify | `loginThrough()`, `confirmPasswordsUsing()` | A documented-mechanism alias for its login pipeline, and a custom password-confirmation check |
| Folio | `Folio::data()`, `Folio::middlewareFor()`, `Folio::renderUsing()` | Reads back the last-matched page's own data, reports a URL's middleware, overrides rendering globally |
| Socialite | `enablePKCE()` | Switches an OAuth2 provider's authorization flow to PKCE |

### Sanctum

Verified against `laravel/sanctum` v4.3.3 (2026-08-04).

A Sanctum personal access token can check its own abilities directly:

```php
$token->cant('orders:write');
```

The documented way to check a token's abilities looks similar but is not the same method. Sanctum
documents `tokenCan()`/`tokenCant()` on the authenticated user, not on the token itself:
`$request->user()->tokenCant('orders:write')`. That documented pair only ever answers for the
token authenticating the current request, because `HasApiTokens::tokenCan()` reads
`$this->accessToken`, the token Sanctum resolved for this request and no other.
`PersonalAccessToken::cant()` has no such restriction: it works on any token instance at hand,
including one that belongs to a different user and has nothing to do with the request being
served.

That gap is exactly what a token-auditing endpoint needs. `SanctumTokenAuditController` looks up
a specific token by its own id, unrelated to whoever is making the request, and reports whether it
lacks a named ability:

```php
class SanctumTokenAuditController extends Controller
{
    // Deliberately unauthenticated for this appendix's minimal, isolated scenario: a real
    // application would gate who may audit a token that does not belong to the requester.
    // The point demonstrated here is `PersonalAccessToken::cant()` itself, not an access
    // control layer around it.
    public function missingAbility(Request $request, PersonalAccessToken $token)
    {
        $validated = $request->validate([
            'ability' => ['required', 'string'],
        ]);

        return response()->json([
            'missing' => $token->cant($validated['ability']),
        ]);
    }
}
```

`GET /api/tokens/{token}/missing-ability?ability=orders:write` binds `{token}` straight to a
`PersonalAccessToken` model through route-model binding, so the token being audited is never the
one authenticating the call. The test suite makes that explicit by authenticating as one user
while auditing a token that belongs to another:

```php
$owner = User::factory()->create();
$token = $owner->createToken('limited', ['orders:read']);

$auditor = User::factory()->create();
Sanctum::actingAs($auditor, ['*']);

$response = $this->getJson("/api/tokens/{$token->accessToken->id}/missing-ability?ability=orders:write");

$response->assertOk()->assertJson(['missing' => true]);
```

Flags: audience, application developer, no shift toward package authorship. Alias, not an alias -
`cant()` is not interchangeable with `tokenCant()`, since only `cant()` can be pointed at a token
other than the one authenticating the current request. Stability, no known history of breaking
changes to this method. Case type, an undocumented method defined directly on
`PersonalAccessToken`, a class the official documentation never addresses directly - only its
effects, reached exclusively through `HasApiTokens::tokenCan()`/`tokenCant()` on the user model,
are documented.

### Pennant

Verified against `laravel/pennant` v1.24.0 (2026-08-04).

Pennant resolves a feature's value for several scopes in one call, only for whichever ones are
not already cached:

```php
Feature::getAllMissing(['new-checkout' => [$userA, $userB, $userC]]);
```

The documented equivalent, `Feature::loadMissing()`, does the same thing for exactly one scope at
a time: `Feature::for($user)->loadMissing(['new-checkout'])` attaches the single scope already
fixed by the fluent builder, then calls the very method used above internally. `getAllMissing()`
skips that one-scope limitation entirely. Its `$features` argument accepts a feature name mapped
to a list of scopes, resolving every one of them not already cached in a single call, backed by a
single query rather than one per scope. Already-cached scopes are silently dropped from both the
resolution step and the return value.

`PennantFeatureAuditController` puts this to use warming a feature's cache for a batch of users at
once, skipping whichever are already resolved:

```php
class PennantFeatureAuditController extends Controller
{
    public function warmMissing(Request $request)
    {
        $users = User::query()
            ->whereIn('id', explode(',', $request->string('user_ids')->toString()))
            ->get();

        $resolved = Feature::getAllMissing(['new-checkout' => $users->all()]);

        return response()->json(['resolved' => $resolved]);
    }
}
```

The test suite calls `GET /api/pennant/new-checkout/warm-missing` twice for the same three users:
once with nothing cached, where all three come back resolved, and once after resolving the first
user directly outside the batch call, where only the remaining two come back - proving the
already-cached one was skipped, not silently re-resolved:

```php
Feature::for($users->first())->active('new-checkout');

$response = $this->getJson('/api/pennant/new-checkout/warm-missing?user_ids='.$users->pluck('id')->implode(','));

expect($response->json('resolved.new-checkout'))->toHaveCount(2);
```

Flags: audience, application developer. Alias, not an alias - `getAllMissing()` is the batching
primitive `loadMissing()` itself delegates to for its own single-scope case; calling it directly
is what unlocks resolving several scopes in one call, a capability the documented method cannot
express on its own. Stability, Pennant is a comparatively young package, and `getAllMissing()` in
particular lives on an internal driver-wrapper class with no signature declared anywhere on the
`Feature` facade itself, so a future refactor could rename or remove it without the deprecation
cycle a documented method would get. Case type, an undocumented method on an internal class,
`Laravel\Pennant\Drivers\Decorator`, that the documented `Feature::loadMissing()` reaches only for
a single scope, through a second internal class, `PendingScopedFeatureInteraction`.

### Scout

Verified against `laravel/scout` v11.5.0 (2026-08-04).

A searchable model can carry transient, display-only data on a single instance without it ever
becoming one of its own attributes:

```php
$article->withScoutMetadata('highlight', $snippet);

$article->scoutMetadata()['highlight'];
```

And a model can send its own sync jobs to a queue of its choosing, regardless of the
application-wide default:

```php
public function syncWithSearchUsingQueue()
{
    return 'scout-sync';
}
```

`withScoutMetadata()`/`scoutMetadata()` are a setter/getter pair, not a hook to override: Scout's
own engines call the setter automatically. Algolia's engine, for instance, attaches every
underscore-prefixed field a search hit comes back with (its own highlighting and ranking data)
onto the hydrated model this same way, before handing it back to application code. Nothing stops
application code from calling it directly for its own purposes, as `ScoutArticleController` does
below. `syncWithSearchUsingQueue()` is read by Scout's own `queueMakeSearchable()` when it
dispatches a model's sync job; overriding it per model, as `SearchableArticle` does, sends that
one model's own sync jobs to a dedicated queue no matter what the global `scout.queue`
configuration says for everything else.

```php
class SearchableArticle extends Model
{
    use Searchable;

    public function syncWithSearchUsingQueue()
    {
        return 'scout-sync';
    }
}
```

`ScoutArticleController::search()` attaches a computed snippet to each hit as metadata, kept
separate from the hit's own attributes:

```php
public function search(Request $request)
{
    $results = SearchableArticle::search($request->string('q')->toString())->get();

    return response()->json($results->map(function (SearchableArticle $article) {
        $article->withScoutMetadata('highlight', Str::limit($article->body, 40));

        return [
            'id' => $article->id,
            'title' => $article->title,
            'highlight' => $article->scoutMetadata()['highlight'],
        ];
    }));
}
```

The test suite confirms the queue override by faking the queue, enabling `scout.queue`, and
creating a new article through `store()`:

```php
Queue::fake();
config(['scout.queue' => true]);

$response = $this->postJson('/api/scout/articles', [
    'title' => 'Dedicated queue article',
    'body' => 'This article syncs through its own overridden queue name.',
]);

Queue::assertPushedOn('scout-sync', MakeSearchable::class);
```

Flags: audience, application developer. Alias, neither method is an alias - `withScoutMetadata()`
has no documented equivalent at all, and `syncWithSearchUsingQueue()` overrides, per model,
behavior the documentation only exposes as one application-wide configuration option. Stability,
no known history of breaking changes to either method. Case type, two undocumented methods inside
an otherwise partially-documented trait, `Searchable` - most of its lifecycle (`search()`,
`toSearchableArray()`, `searchable()`) is documented, these two are not.

### Pulse

Verified against `laravel/pulse` v1.8.0 (2026-08-04).

Pulse can suppress its own recording for the duration of a callback, stop registering its own
dashboard route, contain a callback's exceptions, and defer a callback until its own ingest cycle:

```php
Pulse::ignore(fn () => /* nothing recorded in here */ null);
Pulse::ignoreRoutes();
Pulse::rescue(fn () => /* exceptions here never propagate */ null);
Pulse::lazy(fn () => /* runs later, at ingest time */ null);
```

None of the four behave quite like their names suggest at first read. `ignore()` takes no pattern
to match against - it is a runtime wrapper that flips an internal flag off for the duration of the
callback, so anything recorded inside it, of any kind, is skipped entirely; Pulse uses this on
itself so that writing its own buffered entries to storage does not generate new entries about
that write. `ignoreRoutes()` takes no arguments at all: it does not filter which routes get
recorded, it tells Pulse not to register its own `/pulse` dashboard route in the first place.
`rescue()` matches its likely first impression closely: it catches anything a callback throws and
hands it to whatever was registered through the documented `Pulse::handleExceptionsUsing()` -
`rescue()` itself is the undocumented half of a pair whose other half is documented. `lazy()`
does not toggle a "lazy mode": it queues a closure to run later, only once Pulse's own ingest
cycle actually happens, not at the point it was called.

Audience shift, for two of these four: `lazy()` and `rescue()` are not something application code
calls to observe Pulse - they are the same building blocks Pulse's own bundled recorders call
internally. Every recorder shipped with the package (`SlowJobs`, `Servers`,
`SlowOutgoingRequests`, `Exceptions`, `Queues`, `SlowQueries`, `CacheInteractions`, `UserJobs`)
calls `$this->pulse->lazy()` and/or `$this->pulse->rescue()` on itself; nothing else in the
framework does. An application developer who only wants to react to a caught exception reaches
for the documented `Pulse::handleExceptionsUsing()` instead, exactly as `AppendixAServiceProvider`
does below - `rescue()` and `lazy()` matter directly only to whoever is writing a custom Pulse
Recorder of their own, the same package/subsystem-author shift Chapter 3 gave `Manager` and
`MultipleInstanceManager`. `ignore()` and `ignoreRoutes()` stay ordinary application-developer
calls.

`AppendixAServiceProvider` wires three of the four together:

```php
public function register(): void
{
    // Pulse: must run during the register phase, before any provider's boot() - including
    // PulseServiceProvider's own, which is what actually checks registersRoutes() to decide
    // whether to add the /pulse dashboard route in the first place.
    Pulse::ignoreRoutes();
}

public function boot(): void
{
    // Pulse: route caught internal-recording exceptions to a static log a test can inspect.
    Pulse::handleExceptionsUsing(fn (Throwable $e) => PulseFailureLog::record($e));
}
```

The test suite proves each behavior directly. `ignoreRoutes()` leaves no dashboard route to hit at
all:

```php
$this->get('/pulse')->assertNotFound();
```

`ignore()` and `lazy()` both need `Pulse::startRecording()` first, since this project's own
`phpunit.xml` sets `PULSE_ENABLED=false` for the whole suite, which makes Pulse stop recording by
default during tests:

```php
Pulse::startRecording();

Pulse::record('appendix-a-test', 'not-ignored', 1);
Pulse::ignore(fn () => Pulse::record('appendix-a-test', 'ignored', 1));

expect(Pulse::ingest())->toBe(1);
```

And `rescue()` confirms the exception never propagates, reaching the configured handler instead:

```php
$result = Pulse::rescue(fn () => throw new RuntimeException('boom'));

expect($result)->toBeNull()
    ->and(PulseFailureLog::$caught)->toContain('boom');
```

Flags: audience, application developer for `ignore()`/`ignoreRoutes()`; a package/subsystem-author
shift for `lazy()`/`rescue()`, per the note above - confirmed against every bundled Recorder's own
source. Alias, none of the four are aliases. `rescue()` and the documented `handleExceptionsUsing()`
are a matched pair, one undocumented primitive and one documented configuration point; `ignore()`
is related to, but distinct from, the documented `Pulse::filter()` - `filter()` drops an entry
after it has already been captured, `ignore()` prevents capture from happening at all. Stability,
no known history of breaking changes to these four; Pulse itself is a comparatively young package,
worth a mild verify-before-production note.
Case type, four undocumented methods inside an otherwise partially-documented `Pulse` class -
`filter()`, `handleExceptionsUsing()`, and the dashboard's own authorization gate are documented,
these four are not.

### Horizon

Verified against `laravel/horizon` v5.48.2 (2026-08-04).

Horizon can switch its dashboard to a dark theme and point itself at a different Redis connection
than its own default:

```php
Horizon::night();
Horizon::use('appendix-a-queue');
```

`night()` carries an `@deprecated` tag directly in the installed version's own source, with no
replacement found anywhere in `config/horizon.php` - most likely because the dashboard now follows
the browser's own color-scheme preference automatically, though nothing in the source confirms
that directly. It is included here because it still passes every selection criterion, but it
should not be reached for in new code. `use($connection)` is not deprecated and holds up well: its
entire effect is copying whatever Redis connection config is registered under the given name into
`database.redis.horizon`, the connection name Horizon always reads from internally. The
documentation covers only the config-file equivalent, `'use' => 'default'` in `config/horizon.php`
- calling the method directly is what makes that choice programmatic, for instance to vary it by
environment, rather than fixed in a config file.

A cross-reference to Chapter 8 (the binding lifecycle) was considered for `use()`, since both pick
which underlying resource a subsystem resolves against, but declined: Chapter 8 is specifically
about the container's own binding resolution, and `use()` never touches the container at all - it
only rewrites a plain config array. The parallel is real but not close enough to state without
misleading.

`AppendixAServiceProvider` defines a self-contained Redis connection and applies both calls,
without ever opening an actual Redis socket:

```php
config(['database.redis.appendix-a-queue' => [
    'host' => '127.0.0.1',
    'port' => 6379,
]]);

Horizon::night();
Horizon::use('appendix-a-queue');
```

The test suite confirms `use()`'s effect directly through config, and `night()`'s only through
reflection on its own protected static property, since a dashboard theme has nothing else to
assert against:

```php
expect(config('database.redis.horizon.host'))->toBe('127.0.0.1')
    ->and(config('database.redis.horizon.port'))->toBe(6379);
```

Flags: audience, application developer. Alias, neither is an alias - `use()`'s only documented
equivalent is a config file key, not a method. Stability, `night()` is marked deprecated in the
verified version itself; state this plainly rather than folding it into a generic
verify-before-production note. Case type, two undocumented methods on an otherwise
partially-documented `Horizon` class - most of what `horizon.md` covers is expressed through the
config file rather than this class's own static methods.

### Telescope

Verified against `laravel/telescope` v5.22.0 (2026-08-04).

Telescope can suspend its own recording for a block of code and redact named fields from what it
stores, without disabling recording altogether:

```php
Telescope::withoutRecording(fn () => /* nothing recorded in here */ null);
Telescope::hideRequestParameters(['password']);
Telescope::hideResponseParameters(['token']);
```

`withoutRecording()` flips a static flag off for the callback's duration, restored afterward -
every `record*()` method funnels through a common path that checks this flag first, so anything
recorded inside the callback, of any kind, never queues at all. Neither hiding method is mentioned
by exact name on the documentation page, but `hideRequestParameters()` is not entirely a stranger
to it: the page's own code sample calls a method named `hideSensitiveRequestDetails()` without
ever explaining what is inside it, and the real `TelescopeServiceProvider` stub Laravel generates
for every project that installs Telescope fills that method with
`Telescope::hideRequestParameters(['_token']);` and a matching call for headers. The primitive is
already running in every Telescope installation from day one; the docs just never call it by name.
`hideResponseParameters()` has no such scaffold reference at all - not even an indirect one.

A cross-reference to Chapter 6 is worth drawing here: that chapter's `dontTruncateExceptions()`
section carries its own security note about `Authorization` header leakage in verbose diagnostic
HTTP client output. `hideRequestHeaders()`/`hideRequestParameters()` is Telescope's own answer to
exactly that class of risk, applied to a first-party observability tool instead of an HTTP client.
A second candidate, Chapter 15's `Log::listen()`/`withoutContext()`, was considered and declined -
both sit under a broad "observability control" theme, but log interception and context clearing do
not mirror suppression and redaction closely enough to state as a real parallel.

`TelescopeDemoController` puts both ideas to work. `runInternalTask()` wraps a sensitive operation
so Telescope never sees it, while a second, unwrapped call stays visible:

```php
public function runInternalTask(Request $request)
{
    Telescope::withoutRecording(function () {
        Telescope::recordRequest(IncomingEntry::make(['note' => 'internal-task']));
    });

    Telescope::recordRequest(IncomingEntry::make(['note' => 'visible-task']));

    return response()->json(['done' => true]);
}
```

`processPayment()` exercises Telescope's own request watcher directly, so the redaction runs
through its real, unmodified code path:

```php
public function processPayment(Request $request)
{
    $response = response()->json(['token' => 'secret-token-value', 'status' => 'ok']);

    (new RequestWatcher)->recordRequest(new RequestHandled($request, $response));

    return $response;
}
```

The test suite confirms both: the wrapped note never appears in the queue while the unwrapped one
does, and a submitted `password` alongside a returned `token` both come back as `'********'` while
an unrelated field passes through untouched:

```php
expect($entry->content['payload']['password'])->toBe('********')
    ->and($entry->content['payload']['card_holder'])->toBe('A. Tester')
    ->and($entry->content['response']['token'])->toBe('********');
```

Flags: audience, application developer. Alias, none of the three are aliases - only
`hideRequestParameters()` has even an indirect documentation trail, through the generated
scaffolding's own use of it, never through the docs page's prose. Stability, no known history of
breaking changes to these three. Case type, three undocumented methods inside an otherwise
partially-documented `Telescope` class - `filter()`/`filterBatch()`, the `enabled` flag, and the
dashboard's own authorization gate are documented, these three are not.

### Passport

Verified against `laravel/passport` v13.7.5 (2026-08-04).

Stability warning: this entry replaces `Passport::hashClientSecrets()`, planned originally, after
re-verification found it removed outright in Passport v13 (client secrets are now always hashed,
with no opt-in toggle left to document). Passport has a real history of removing, not just
changing, previously undocumented methods between major versions - re-verify this entry again
against whatever version is actually installed before relying on any of it in production.

Passport can decrypt its own authentication cookie, expect it in a given serialized form, and
skip its embedded CSRF check:

```php
Passport::withCookieEncryption();
Passport::withCookieSerialization();
Passport::ignoreCsrfToken();
```

All three configure the exact same mechanism: `Guards\TokenGuard::getTokenViaCookie()` and
`decodeJwtTokenCookie()`, the code path that authenticates a request through Passport's
already-documented SPA cookie flow (the `laravel_token` cookie `CreateFreshApiToken` sets).
`withCookieEncryption()`/`withoutCookieEncryption()` decide whether Passport decrypts that cookie
itself, independent of the framework's own `EncryptCookies` middleware, which the `api` middleware
group does not include. `withCookieSerialization()`/`withoutCookieSerialization()` decide whether
the decrypted payload is treated as PHP-serialized data. `ignoreCsrfToken()` skips comparing the
cookie's embedded `csrf` claim against the request's own CSRF token. None of the three appear by
exact name in the documentation, which covers only the cookie flow's existence, not these
configuration knobs into it.

The test suite builds a cookie exactly the way Passport's own `ApiTokenCookieFactory` and the
framework's `EncryptCookies` middleware would together, then flips each flag mid-test against a
route guarded by `auth:api`:

```php
function buildPassportCookie(int $userId, string $csrfToken): string
{
    $jwt = app(ApiTokenCookieFactory::class)->make($userId, $csrfToken)->getValue();

    $prefixed = CookieValuePrefix::create(Passport::cookie(), app('encrypter')->getKey()).$jwt;

    return app('encrypter')->encrypt($prefixed, Passport::$unserializesCookies);
}
```

```php
$this->withCredentials()->withUnencryptedCookie(Passport::cookie(), $cookie)
    ->withHeaders(['X-CSRF-TOKEN' => $csrf])
    ->getJson('/api/passport-demo/whoami')
    ->assertOk();

Auth::forgetGuards();
Passport::withoutCookieEncryption();

$this->withCredentials()->withUnencryptedCookie(Passport::cookie(), $cookie)
    ->withHeaders(['X-CSRF-TOKEN' => $csrf])
    ->getJson('/api/passport-demo/whoami')
    ->assertStatus(401);
```

`Auth::forgetGuards()` matters here for a reason worth stating plainly: within one test, the
authentication guard and its resolved user stay cached across multiple requests, unlike separate
real HTTP requests - without it, a second call would silently reuse the first call's already
authenticated user instead of re-evaluating the cookie against the newly flipped flag.

Flags: audience, application developer. Alias, none of the three are aliases. Stability, explicit
and prominent, per the warning above - re-verify before production use. Case type, three
undocumented methods configuring an already-documented mechanism (Passport's cookie-based SPA
authentication flow), none of them named on the documentation page itself.

### Fortify

Verified against `laravel/fortify` v1.37.3 (2026-08-04).

Fortify can swap its own login pipeline for a custom one and replace the default
password-confirmation check:

```php
Fortify::loginThrough(fn ($request) => [/* pipe classes */]);
Fortify::confirmPasswordsUsing(fn ($user, $password) => /* custom check */ true);
```

`loginThrough()` is a trivial alias: its entire body is `static::authenticateThrough($callback);`,
and `authenticateThrough()` is documented, by exact name, in the "Customizing the Authentication
Pipeline" section, worked example included. `loginThrough()` itself never appears on the docs
page, but the mechanism it reaches is not new - stated here plainly rather than presented as a
discovery of its own. `confirmPasswordsUsing()` is not an alias: it sets a public static callback
that `Actions\ConfirmPassword` reads directly, falling back to the guard's own
username-and-password check only when nothing has been registered.

`AppendixAServiceProvider` uses both. The login pipeline reuses Fortify's own real pipe classes and
appends one custom pipe:

```php
Fortify::loginThrough(fn ($request) => array_filter([
    config('fortify.limiters.login') ? EnsureLoginIsNotThrottled::class : null,
    AttemptToAuthenticate::class,
    PrepareAuthenticatedSession::class,
    RecordLoginAttempt::class,
]));

Fortify::confirmPasswordsUsing(fn ($user, $password) => Hash::check($password, $user->password)
    || $password === self::FORTIFY_RECOVERY_CODE);
```

`RecordLoginAttempt` is the custom pipe, proving the pipeline that ran was the custom one:

```php
class RecordLoginAttempt
{
    public static int $count = 0;

    public function handle($request, $next)
    {
        self::$count++;

        return $next($request);
    }
}
```

The test suite confirms both entries directly - a real login through the custom pipeline, and
password confirmation accepted via the recovery code alone:

```php
$this->post('/login', ['email' => $user->email, 'password' => 'correct-password']);

$this->assertAuthenticatedAs($user);
expect(RecordLoginAttempt::$count)->toBe(1);
```

```php
$this->actingAs($user)
    ->post('/user/confirm-password', ['password' => AppendixAServiceProvider::FORTIFY_RECOVERY_CODE])
    ->assertSessionHasNoErrors();
```

Flags: audience, application developer. Alias, `loginThrough()` is a trivial, one-line delegation
to the documented `authenticateThrough()` - not a new mechanism; `confirmPasswordsUsing()` is not
an alias. Stability, no known history of breaking changes to either. Case type,
`confirmPasswordsUsing()` is an undocumented method inside an otherwise documented
password-confirmation flow; `loginThrough()` is an undocumented name for an already-documented
mechanism reached through a different, documented name.

### Folio

Verified against `laravel/folio` v1.1.19 (2026-08-04).

Folio can read back data from whichever page it last matched, report which middleware a URL would
run under, and override how every matched page becomes a response:

```php
Folio::data('article');
Folio::middlewareFor('/admin/dashboard');
Folio::renderUsing(fn ($request, $matchedView) => /* custom response */ null);
```

`data()` and `middlewareFor()` are not what their names suggest at first read. `data()` does not
share new data with pages; its entire body is `Arr::get($this->lastMatchedView?->data ?: [], $key,
$default);` - it reads a piece of data, typically a route parameter, from whichever view Folio
most recently matched, usable from outside that page entirely. `middlewareFor()` does not assign
middleware to a path; it looks up, for a given URI, what middleware the already-documented
`Folio::path(...)->middleware([...])` call would apply there, and returns that list - a read-only
lookup, not a configuration point. Its argument is relative to the mount's own base URI, not the
full application path. `renderUsing()` matches its likely first impression, with one narrower
detail: its scope is global, overriding every Folio-matched page across every mount, not a single
page's own rendering.

`AppendixAServiceProvider` mounts an isolated page directory and registers both a middleware
pattern and the global render override:

```php
Folio::path(resource_path('views/pages/appendix-a-folio'))
    ->uri('/appendix-a-folio')
    ->middleware([
        'admin/*' => ['auth'],
    ]);

Folio::renderUsing(function ($request, $matchedView) {
    $response = response(View::file($matchedView->path, $matchedView->data));
    $response->headers->set('X-Appendix-A-Rendered-By', 'custom');

    return $response;
});
```

The article page reads its own route parameter back through `data()` instead of the page's own
automatically injected Blade variable:

```blade
{{ Folio::data('article') }}
```

The test suite confirms `middlewareFor()`'s report is truthful, not just self-consistent - the
same pattern that answers `'auth'` also genuinely blocks an unauthenticated request:

```php
expect(Folio::middlewareFor('/admin/dashboard'))->toContain('auth')
    ->and(Folio::middlewareFor('/articles/hello-world'))->not->toContain('auth');

$this->get('/appendix-a-folio/admin/dashboard')->assertRedirect('/login');
```

Flags: audience, application developer. Alias, none of the three are aliases - state the corrected
read-only direction for `data()` and `middlewareFor()` plainly, since both read easily as
assignment methods on first encounter. Stability, no known history of breaking changes to these
three. Case type, three undocumented methods inside an otherwise partially-documented
`Folio`/`FolioManager` - the assignment side of data sharing, middleware, and rendering is
documented through a page's own inline `render()` closure and the `Folio::path()->middleware()`
chain; the introspection and global-override side covered here is not.

### Socialite

Verified against `laravel/socialite` v5.29.0 (2026-08-04).

A Socialite provider can switch its authorization-code flow to PKCE with a single call:

```php
Socialite::driver('github')->enablePKCE()->redirect();
```

`enablePKCE()` sets a protected flag read at three points: the authorization request gains
`code_challenge` and `code_challenge_method` parameters; `redirect()` generates a random verifier
and stores it in the session; token exchange pulls that verifier back out and sends it along.
Nothing about PKCE appears anywhere in the documentation, not even in passing.

```php
class SocialiteRedirectController extends Controller
{
    public function redirect()
    {
        return Socialite::driver('github')->stateless()->enablePKCE()->redirect();
    }
}
```

The test suite confirms the generated authorization URL actually carries both parameters:

```php
parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

expect($query)->toHaveKey('code_challenge')
    ->and($query['code_challenge_method'])->toBe('S256');
```

and that a provider instance which never called `enablePKCE()` carries neither, checked in its own
separate test since Socialite's manager caches a driver instance by name for the lifetime of one
test - a provider already switched to PKCE earlier in the same test would still report it
afterward otherwise.

Flags: audience, application developer. Alias, not an alias. Stability, no known history of
breaking changes. Case type, an undocumented method on an otherwise well-documented
`Two\AbstractProvider` - the OAuth2 flow itself, scopes, and stateless mode are documented, PKCE is
not mentioned at all.

### Closing

Ten packages is not an exhaustive survey of the Laravel ecosystem's first-party packages, and
even these ten were not searched exhaustively for every undocumented method they carry - each
section above covers what its own scenario needed, not everything each package's source contains.
Appendix B (Ideas for Future Contributions) picks up from here, with specific sibling methods
already found along the way and areas of the ecosystem not yet touched at all.
