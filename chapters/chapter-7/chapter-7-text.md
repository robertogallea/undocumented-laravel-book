# Chapter 7 - Testing responses like an expert

Chapter 6 covered the request side of Part III (HTTP, APIs, and Testing): authenticating,
streaming, and faking outgoing calls. Chapter 7 stays in the same Part and turns to the response
side - the assertions that check what a test actually got back, and one that does not depend on
getting anything back from an HTTP request at all. `assertJson()`, `assertJsonValidationErrors()`,
`assertRedirect()`, and `assertRedirectToRoute()` are the documented tools every Laravel test
suite already reaches for; this chapter walks through five siblings that sit right next to them,
each replacing a combination of those already-known assertions with a single, more precise one:
an order-tolerant JSON comparison, an exact check of which validation errors came back and no
others, a redirect assertion tied to a controller action instead of a route name, a way to assert
a precognitive request succeeded, and a JSON assertion class that never touches a `TestResponse`
at all. Every example is verified against `laravel/framework` v13.22.0 and the `laravel/docs`
`13.x` branch, and is a real, green Pest test drawn from this book's companion application.

The running scenario for the first four entries is a small helpdesk ticketing endpoint:
`TicketController` creates a `Ticket` from a category, a set of tags, and any number of notes,
and exposes that creation both as a JSON API endpoint and as a redirecting web form - the same
domain chapters 4 and 5 already queried, now with an actual HTTP surface in front of it for the
first time. The fifth entry, unlike the other four, cannot use that scenario at all: it asserts
on JSON that never came from an HTTP response.

## `assertSimilarJson()`

**Case type**: undocumented method inside `Illuminate\Testing\TestResponse`'s JSON-assertion
family, which is otherwise well documented - `assertJson()` and `assertExactJson()` both have
their own entry in `laravel/docs`. `assertSimilarJson($data)` sits in the exact same file, a few
lines below `assertExactJson()`, and is never named there. **Alias flag**: not an alias of either
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
