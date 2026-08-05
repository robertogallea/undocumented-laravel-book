# Chapter 7 - Testing responses like an expert

Chapter 6 covered the request side of Part III (HTTP, APIs, and Testing): authenticating,
streaming, and faking outgoing calls. Chapter 7 stays in the same Part and turns to the response
side - the assertions that check what a test actually got back, and one that does not depend on
getting anything back from an HTTP request at all. `assertJson()`, `assertJsonValidationErrors()`,
`assertRedirect()`, and `assertRedirectToRoute()` are the documented tools every Laravel test
suite already reaches for; this chapter walks through four siblings that sit right next to them,
each replacing a combination of those already-known assertions with a single, more precise one:
an order-tolerant JSON comparison, an exact check of which validation errors came back and no
others, a redirect assertion tied to a controller action instead of a route name, and a JSON
assertion class that never touches a `TestResponse` at all. Every example is verified against
`laravel/framework` v13.22.0 and the `laravel/docs` `13.x` branch, and is a real, green Pest test
drawn from this book's companion application.

The running scenario for the first three entries is a small helpdesk ticketing endpoint:
`TicketController` creates a `Ticket` from a category, a set of tags, and any number of notes,
and exposes that creation both as a JSON API endpoint and as a redirecting web form - the same
domain chapters 4 and 5 already queried, now with an actual HTTP surface in front of it for the
first time. The fourth entry, unlike the other three, cannot use that scenario at all: it asserts
on JSON that never came from an HTTP response.

## `assertSimilarJson()`

**Case type**: undocumented method inside `Illuminate\Testing\TestResponse`'s JSON-assertion
family, which is otherwise well documented - `assertJson()` and `assertExactJson()` both have
their own entry in `laravel/docs`. `assertSimilarJson($data)` sits in the exact same file, a few
lines below `assertExactJson()`, and is never named there. 

**Alias flag**: not an alias of either
sibling - it fills the one combination neither of them covers, and its own assertion logic
(delegating to `AssertableJsonString::assertSimilar()`, which runs `Arr::sortRecursive()` on both
sides before comparing) is genuinely different from both.

### Minimal snippet

```php
$response->assertSimilarJson([
    'status' => 'open',
    'tags' => ['follow-up', 'urgent'],
]);
```

### Documented way vs. discovered way

`laravel/docs` documents exactly two ways to compare a response against an expected array, and
they sit at opposite ends of a spectrum:

```php
// assertJson(): the given fragment must be present, extra response keys are fine...
$response->assertJson(['status' => 'open']);

// assertExactJson(): the response must match exactly, including list order...
$response->assertExactJson([
    'status' => 'open',
    'tags' => ['urgent', 'follow-up'],
]);
```

`assertSimilarJson()` sits between them: like `assertExactJson()`, it requires the entire
response to match, no extra or missing keys allowed; unlike `assertExactJson()`, it does not care
about the order of items inside a list, because it sorts every nested array - associative and
sequential alike - on both sides before comparing:

```php
$response->assertSimilarJson([
    'status' => 'open',
    'tags' => ['follow-up', 'urgent'], // reversed - still passes
]);
```

### Real scenario: comparing a ticket's tags regardless of attachment order

`TicketController::store()` returns a ticket's tags in whatever order they were attached; a test
that cares about their content, not their order, reaches for `assertSimilarJson()` instead of
hardcoding the attachment order into the expectation:

```php
it('accepts tag order differences via assertSimilarJson() where assertExactJson() would not', function () {
    $category = Category::factory()->create(['name' => 'Billing']);
    $urgent = Tag::factory()->create(['name' => 'urgent']);
    $followUp = Tag::factory()->create(['name' => 'follow-up']);

    $response = $this->postJson('/api/tickets', [
        'subject' => 'Duplicate charge on invoice',
        'category_id' => $category->id,
        'tags' => [$urgent->id, $followUp->id],
    ]);

    $ticket = Ticket::sole();

    $expected = [
        'id' => $ticket->id,
        'subject' => 'Duplicate charge on invoice',
        'status' => 'open',
        'category' => 'Billing',
        'tags' => ['follow-up', 'urgent'],
        'notes_count' => 0,
    ];

    $response->assertSimilarJson($expected);

    expect(fn () => $response->assertExactJson($expected))
        ->toThrow(ExpectationFailedException::class);
});
```

Order tolerance is not the same as leniency about content, though: `assertSimilarJson()` still
requires every key to be present and no extra one to sneak in - it normalizes order, not
completeness.

```php
it('still fails on a missing or unexpected key, tolerating order only', function () {
    $category = Category::factory()->create(['name' => 'Technical']);

    $response = $this->postJson('/api/tickets', [
        'subject' => 'Cannot reset password',
        'category_id' => $category->id,
    ]);

    $ticket = Ticket::sole();

    expect(fn () => $response->assertSimilarJson([
        'id' => $ticket->id,
        'subject' => 'Cannot reset password',
        'status' => 'open',
        'category' => 'Technical',
        'tags' => [],
        'notes_count' => 0,
        'escalated' => false,
    ]))->toThrow(ExpectationFailedException::class);
});
```

## `assertOnlyJsonValidationErrors()`

**Case type**: undocumented method inside `Illuminate\Testing\TestResponse`'s validation-error
assertion family, which is otherwise well documented - `assertJsonValidationErrors()` and
`assertJsonValidationErrorFor()` both have their own entry in `laravel/docs`.
`assertOnlyJsonValidationErrors($errors, $responseKey = 'errors')` sits right next to them and is
never named there. 

**Alias flag**: not an alias - it delegates to `assertJsonValidationErrors()`
internally and then adds a real check of its own: that no other, unexpected validation error is
also present in the response.

### Minimal snippet

```php
$response->assertOnlyJsonValidationErrors(['subject']);
```

### Documented way vs. discovered way

`assertJsonValidationErrors()` only checks that the errors you name are present - it says
nothing about any other key the response's error bag might contain:

```php
// Passes even if the response also has an unrelated `category_id` error...
$response->assertJsonValidationErrors(['subject']);
```

`assertOnlyJsonValidationErrors()` runs that same check, then asserts the error bag contains
nothing else:

```php
// Fails if any error besides `subject` is present...
$response->assertOnlyJsonValidationErrors(['subject']);
```

A test that only reaches for the documented method can pass while silently missing a validation
rule that fires unexpectedly alongside the one actually being tested - `assertOnlyJsonValidationErrors()`
closes exactly that gap.

### Real scenario: an exhaustive check on ticket creation, including a nested key

`TicketController::store()` validates `notes.*.body` alongside `subject` and `category_id`.
Laravel's validator reports that nested rule as a literal, dot-suffixed key -
`'notes.0.body'` - in the JSON error bag, and `assertOnlyJsonValidationErrors()` matches it as
plain text, the same way it matches any other key; there is no special nested-array resolution
involved, only the fact that Laravel's validation errors are already a flat map of dotted-string
keys.

```php
it('asserts only the specific validation errors present, including a nested notes.*.body key', function () {
    $category = Category::factory()->create();

    $response = $this->postJson('/api/tickets', [
        'category_id' => $category->id,
        'notes' => [
            [],
        ],
    ]);

    $response->assertOnlyJsonValidationErrors(['subject', 'notes.0.body']);
});
```

And the contrast from the documented-vs-discovered comparison above, made concrete: an
otherwise-passing test that would have missed a second, unrelated validation failure.

```php
it('fails when the response carries an additional, unexpected validation error', function () {
    $response = $this->postJson('/api/tickets', []);

    $response->assertJsonValidationErrors(['subject']);

    expect(fn () => $response->assertOnlyJsonValidationErrors(['subject']))
        ->toThrow(ExpectationFailedException::class);
});
```

## `assertRedirectToAction()`

**Case type**: undocumented method inside `Illuminate\Testing\TestResponse`'s redirect-assertion
family, which is otherwise well documented - `assertRedirect()` and `assertRedirectToRoute()`
both have their own entry in `laravel/docs`. `assertRedirectToAction($name, $parameters = [])`
sits between them in the same file and is never named there. 

**Alias flag**: not an alias - it
resolves the expected URL through a distinct mechanism of its own (the global `action()` helper,
which looks up a route by its controller action), independent from both a raw URI string and a
route name.

### Minimal snippet

```php
$response->assertRedirectToAction([TicketController::class, 'show'], ['ticket' => $ticket]);
```

### Documented way vs. discovered way

All three redirect assertions end up comparing against the same `Location` header, but each
resolves the expected URL differently:

| Method | Resolves the expected URL from | Needs |
|---|---|---|
| `assertRedirect($uri)` | the raw URI/URL passed in, used as-is | nothing to look up |
| `assertRedirectToRoute($name, $parameters)` | a named route, via the `route()` helper | the target route must have a `->name(...)` |
| `assertRedirectToAction($name, $parameters)` | a controller action, via the `action()` helper | the target route must be backed by that controller action - no name required |

### Real scenario: redirecting to a route that was never given a name

`routes/web.php`'s `GET /tickets/{ticket}` route (`TicketController::show`) has no `->name(...)`
at all - it only exists as a controller action. `assertRedirectToRoute()` has nothing to resolve
against a route like this one; `assertRedirectToAction()` targets it directly, by the same
controller-action reference the production redirect itself already uses:

```php
it('redirects to the show action after creating a ticket via the web form', function () {
    $category = Category::factory()->create();

    $response = $this->post('/tickets', [
        'subject' => 'Website checkout is broken',
        'category_id' => $category->id,
    ]);

    $ticket = Ticket::sole();

    $response->assertRedirectToAction([TicketController::class, 'show'], ['ticket' => $ticket]);
});
```

## `AssertableJsonString`

**Case type**: an entirely undocumented class (not a method inside a documented one, unlike the
previous three entries) - `Illuminate\Testing\AssertableJsonString` never appears by exact name
in `laravel/docs`. 

**Alias flag**: not an alias, and not to be confused with the similarly-named,
genuinely documented `Illuminate\Testing\Fluent\AssertableJson` (the class behind
`$response->assertJson(fn (AssertableJson $json) => ...)`) - the two are independent
implementations. `AssertableJson`'s constructor is protected and cannot be instantiated directly
from application code; the only relationship between the two is a one-way conversion
(`AssertableJson::fromAssertableJsonString()`) that `TestResponse::assertJson()` uses internally
when given a closure. Neither extends nor wraps the other. This is the chapter's most likely
source of confusion, given how close the two names are.

### Minimal snippet

`AssertableJsonString` never needs a `TestResponse` - it wraps any JSON-shaped value directly:

```php
$json = new AssertableJsonString($rawJsonString);

$json->assertFragment(['status' => 'open']);
```

### Documented way vs. discovered way

Without it, asserting on a JSON string produced outside a request/response cycle means decoding
it by hand and falling back to generic expectations:

```php
$decoded = json_decode($rawJsonString, true);

expect($decoded['category'])->toBe('Billing');
expect($decoded['tags'])->toBe(['urgent' => 2]);
```

`AssertableJsonString` replaces that with the same structured assertions `TestResponse` itself
uses internally - `assertExact()`, `assertFragment()`, `assertMissing()`, `assertStructure()` -
on any JSON string, array, `Jsonable`, or `JsonSerializable` value, with the same clear failure
messages:

```php
(new AssertableJsonString($rawJsonString))->assertExact([
    'category' => 'Billing',
    'tags' => ['urgent' => 2],
]);
```

### Real scenario: asserting a queued job's JSON digest with no HTTP response involved

`TicketDigestExport` compiles a per-category JSON digest (open ticket count, tag frequency,
average reply response time) and writes it to storage - nothing here ever touches a controller,
a route, or a `TestResponse`:

```php
class TicketDigestExport implements ShouldQueue
{
    use Queueable;

    public function __construct(public Category $category) {}

    public function handle(): void
    {
        $tickets = $this->category->tickets()->with('tags')->get();

        $tagFrequency = $tickets
            ->flatMap(fn ($ticket) => $ticket->tags->pluck('name'))
            ->countBy()
            ->sortKeys()
            ->all();

        $averageResponseMinutes = Reply::whereIn('ticket_id', $tickets->pluck('id'))
            ->whereNotNull('response_minutes')
            ->avg('response_minutes');

        $digest = [
            'category_id' => $this->category->id,
            'category' => $this->category->name,
            'open_tickets' => $tickets->where('status', 'open')->count(),
            'tags' => $tagFrequency,
            'average_response_minutes' => $averageResponseMinutes !== null
                ? round($averageResponseMinutes, 1)
                : null,
        ];

        Storage::put("reports/tickets-digest-{$this->category->id}.json", json_encode($digest));
    }
}
```

The test runs the job directly and asserts on the stored string, with no `TestResponse` in sight:

```php
it('exports a JSON ticket digest for a category, asserted without any HTTP response', function () {
    Storage::fake();

    $category = Category::factory()->create(['name' => 'Billing']);
    $urgent = Tag::factory()->create(['name' => 'urgent']);

    $openTicket = Ticket::factory()->for($category, 'category')->create(['status' => 'open']);
    $openTicket->tags()->attach($urgent);
    Reply::factory()->for($openTicket)->create(['response_minutes' => 30]);
    Reply::factory()->for($openTicket)->create(['response_minutes' => 50]);

    $closedTicket = Ticket::factory()->for($category, 'category')->create(['status' => 'closed']);
    $closedTicket->tags()->attach($urgent);

    (new TicketDigestExport($category))->handle();

    $json = Storage::get("reports/tickets-digest-{$category->id}.json");

    (new AssertableJsonString($json))->assertExact([
        'category_id' => $category->id,
        'category' => 'Billing',
        'open_tickets' => 1,
        'tags' => ['urgent' => 2],
        'average_response_minutes' => 40.0,
    ]);
});
```

The same principle extends well beyond a queued job: any JSON string produced outside a
request/response cycle - the output of an Artisan command, or a payload broadcast over an event
- can be asserted on the same way. The digest job above is one instance of that, not the only
one.

## Summary

| Entry | Documented alternative | When to prefer the undocumented one |
|---|---|---|
| `assertSimilarJson()` | `assertJson()` (subset match) / `assertExactJson()` (exact, order-sensitive) | Full content must match, but list order shouldn't |
| `assertOnlyJsonValidationErrors()` | `assertJsonValidationErrors()` | Need to assert no other, unexpected validation error is present |
| `assertRedirectToAction()` | `assertRedirect()` / `assertRedirectToRoute()` | The target route has no name, only a controller action |
| `AssertableJsonString` | Manual `json_decode()` plus generic assertions | Asserting JSON produced outside a request/response cycle (a queued job, an Artisan command, a broadcast event) |

None of these four replace their documented counterpart outright. `assertSimilarJson()` and
`assertOnlyJsonValidationErrors()` are the wrong choice the moment the looser, already-known
assertion (`assertJson()`, `assertJsonValidationErrors()`) is already precise enough for the test
at hand - reaching for the stricter one then only adds complexity without a real gain.
