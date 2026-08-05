# Chapter 5 - Lesser-known query builder features

Chapter 4 closed the gap between `whereHas()`'s closure and a plain column, operator, and
value, on a single relation at a time. Chapter 5 closes Part II (Eloquent Beyond Basic
Relationships) by turning to the query builder itself: composing constraints across builders,
and pulling more than one aggregate out of a relation in a single query - the two things a
reporting or dashboard screen typically needs once the relationships it reads from are already
in place. Every example is verified against `laravel/framework` `v13.22.0` and the
`laravel/docs` `13.x` branch, and is a real, green Pest test drawn from the book's companion
application, continuing the same internal helpdesk domain (tickets, replies, notes, tags, and
a category) that Chapter 4 introduced.

## `mergeConstraintsFrom()`

**Case type**: public method inside `Illuminate\Database\Eloquent\Concerns\QueriesRelationships`
- the same trait every entry in Chapter 4 lives in - but this one is not adjacent to
`whereHas()`, it is the primitive underneath it. `addHasWhere()`, the method that builds the
subquery for `has()`/`whereHas()` and everything that delegates to them, calls
`$hasQuery->mergeConstraintsFrom($relation->getQuery())` internally to bring the relation's own
constraints onto the subquery. Every relation-condition method in this book so far has been
using `mergeConstraintsFrom()` without naming it. 

**Alias flag**: not an alias - no documented
method fuses the where clauses of two independently-built query builders into one. 

**Version
note**: confirmed present and unchanged in `v13.22.0`; no known instability, this is core
query-builder code.

### Minimal snippet

Two independently obtained builders, fused into one:

```php
$merged = Ticket::assignedTo($user)->mergeConstraintsFrom(Ticket::open());
```

### Documented way vs. discovered way

There is no single documented method that does this - the closest documented equivalent is
simply chaining both conditions on the same builder from the start:

```php
$documented = Ticket::assignedTo($user)->open();
```

Both compile to the exact same query, confirmed directly in the companion app's test suite:

```php
$merged = Ticket::assignedTo($user)->mergeConstraintsFrom(Ticket::open());
$documented = Ticket::assignedTo($user)->open();

expect($merged->toSql())->toBe($documented->toSql())
    ->and($merged->getBindings())->toBe($documented->getBindings());
```

`mergeConstraintsFrom()` only merges where constraints and their bindings from the builder
passed in - not joins, not eager loads, not orders or limits, despite the generic-sounding
name. What it does with global scopes is worth spelling out precisely, since assuming the wrong
thing here is easy: it does not bypass or duplicate the destination builder's active global
scopes wholesale. The implementation is
`$this->withoutGlobalScopes($from->removedScopes())->mergeWheres(...)` - it only propagates
whichever global scopes the source builder had itself explicitly removed (via
`withoutGlobalScope()`/`withoutGlobalScopes()`), so the merged builder ends up excluding the
same scopes the source opted out of. Any global scope neither builder removed stays fully
active on both sides, applied normally when the query runs - merging does not mean "everything
from the source, scope suppression included."

### Real scenario: composing a support dashboard's ticket filters

A support dashboard often needs to combine filters that are defined and reused separately - "my
open tickets" is `open()` and `assignedTo($user)` coming together, not a query written fresh
each time from both conditions at once:

```php
$user = User::factory()->create();
$otherUser = User::factory()->create();

$myOpenTicket = Ticket::factory()->assignedTo($user)->create();
Ticket::factory()->assignedTo($user)->urgent()->create();
Ticket::factory()->assignedTo($otherUser)->create();
Ticket::factory()->create();

$matches = Ticket::assignedTo($user)->mergeConstraintsFrom(Ticket::open())->pluck('id');

expect($matches)->toEqual(collect([$myOpenTicket->id]));
```

Only the ticket that is both open and assigned to the current user survives: the second
ticket is assigned to the same user but no longer open, the third is open but assigned to
someone else, and the fourth is open and unassigned. Each condition still comes from its own
scope, defined once on the model and reused independently - `mergeConstraintsFrom()` is what
lets a dashboard bring two such builders together at the point where they need to be combined,
rather than requiring every combination to be written out as its own chained call up front.

A correction before the next entry: the original outline for this chapter planned
`withAggregate()` "and family" - `withAvg()`, `withMax()`, `withMin()` - as a single entry.
Checked directly against the `13.x` docs branch rather than assumed, `eloquent-relationships.md`
has a section titled "Other Aggregate Functions" that names `withMin()`, `withMax()`,
`withAvg()`, `withSum()`, and `withExists()` explicitly, with worked examples covering both the
column-naming convention and the alias syntax. All five are already documented. Only
`withAggregate()` itself - the method underneath all five - is not, so the entry below covers
that method alone.

## `withAggregate()`

**Case type**: undocumented method inside the same `QueriesRelationships` trait as the previous
entry, in an unusual position: every one of its own callers has a documented section of its
own. `withCount()` normalizes its argument to an array and then calls `withAggregate($relations,
'*', 'count')`; `withMax()`, `withMin()`, `withSum()`, and `withAvg()` are each a single line
calling `withAggregate()` with a fixed function name; `withExists()` is
`withAggregate($relation, '*', 'exists')`. The method that does the actual work is never named
on the docs page that covers all six of its results.

**Alias flag**: not an alias itself - the relationship runs the other way, `withCount()` and the
four other documented helpers are thin, fixed-function wrappers around this method, confirmed
directly in the source cited above. 

**Version note**: confirmed present and unchanged in
`v13.22.0`, core query-builder code, no stability concern.

### Minimal snippet

The one thing none of the six documented helpers can do - pass an aggregate function that is
not among the six Laravel chose to wrap:

```php
$result = Ticket::withAggregate('replies', 'body', 'group_concat')->find($ticket->id);
```

### Documented way vs. discovered way

`withCount()` and `withAvg()` cover a reply count and an average response time the documented
way; nothing documented reaches a metric like "every reply body concatenated into one field",
because Laravel only ever named six functions. Chaining the documented helpers alongside the
one call only `withAggregate()` can make, all in a single query:

```php
$result = Ticket::withCount('replies')
    ->withAvg('replies', 'response_minutes')
    ->withAggregate('replies', 'body', 'group_concat')
    ->find($ticket->id);

expect($result->replies_count)->toBe(3)
    ->and((float) $result->replies_avg_response_minutes)->toBe(20.0)
    ->and($result->replies_group_concat_body)
    ->toContain('First reply')
    ->toContain('Second reply')
    ->toContain('Third reply');
```

Three things worth knowing. First, the resulting column name follows the same
`{relation}_{function}_{column}` convention `withCount()`/`withAvg()` already use - here
`replies_group_concat_body` - because the alias-building logic in `withAggregate()` is shared by
all six methods, not specific to the five that got a name. Second, the same `'relation as
alias'` syntax the documented helpers support works identically here:

```php
$result = Ticket::withAggregate('replies as reply_digest', 'body', 'group_concat')->find($ticket->id);

expect($result->reply_digest)->toContain('Alpha')->toContain('Beta')
    ->and($result->getAttributes())->not->toHaveKey('replies_group_concat_body');
```

Third, and the reason to reach for any of these six methods in the first place: every aggregate
chained this way rides along in the same single query as a subselect, confirmed directly against
the manual alternative - fetching each ticket and then querying its replies separately for the
count, the average, and the concatenation:

```php
DB::enableQueryLog();
Ticket::withCount('replies')
    ->withAvg('replies', 'response_minutes')
    ->withAggregate('replies', 'body', 'group_concat')
    ->get();
$aggregatedQueryCount = count(DB::getQueryLog());
DB::flushQueryLog();

foreach (Ticket::all() as $ticket) {
    $ticket->replies()->count();
    $ticket->replies()->avg('response_minutes');
    $ticket->replies()->pluck('body')->implode(',');
}
$manualQueryCount = count(DB::getQueryLog());

expect($aggregatedQueryCount)->toBe(1)
    ->and($manualQueryCount)->toBe(10);
```

One query against a growing multiple, one extra query per ticket for every metric read the
manual way.

Fourth, `group_concat` itself is not portable: SQLite and MySQL both support it, but PostgreSQL
has no function of that name - it uses `string_agg` instead. Since `withAggregate()`'s whole
point is passing through whatever function the underlying database actually supports, the
function name has to match the database the query runs against, same as writing raw SQL would.

Fifth, and worth stating plainly since this method makes it easy to forget: the function name
passed to `withAggregate()` is placed directly into the generated SQL with no escaping or
whitelist, unlike the column argument, which is safely wrapped by the query grammar. Every
example here uses a literal string, which is safe - but a function name built from request
input would be a real SQL injection vector. Treat `$function` the same as any other raw SQL
fragment: it must never come from user-controlled data.

### Real scenario: a reply digest on the support dashboard

The same dashboard from the previous entry needs one more column: a quick digest of what a
ticket's replies actually say, next to the count and the average response time it already
shows, without an extra round trip per ticket:

```php
$ticket = Ticket::factory()->create();
Reply::factory()->for($ticket)->create(['body' => 'First reply', 'response_minutes' => 10]);
Reply::factory()->for($ticket)->create(['body' => 'Second reply', 'response_minutes' => 20]);
Reply::factory()->for($ticket)->create(['body' => 'Third reply', 'response_minutes' => 30]);

$result = Ticket::withCount('replies')
    ->withAvg('replies', 'response_minutes')
    ->withAggregate('replies', 'body', 'group_concat')
    ->find($ticket->id);
```

`withCount()` and `withAvg()` are the documented, familiar half of this query. The digest is
the half that needed `withAggregate()` directly - not because the other five are lacking in
general, but because this particular metric is not one of the six Laravel named.

A second correction, this time on the chapter's closing entry: the outline described
`withWhereRelation()` as combining an aggregation and a condition on the same relationship.
Reading its actual source shows that is not what it does - there is no aggregation involved at
all. It filters by a condition on a relation and eager-loads that same relation with the
identical condition applied, in a single call. The entry below covers what it actually does.

## `withWhereRelation()`

**Case type**: undocumented method inside the same `QueriesRelationships` trait, but this one
returns to Chapter 4's territory rather than extending `withAggregate()`. `laravel/docs` `13.x`
documents `withWhereHas()` - "check for the existence of a relationship while simultaneously
loading the relationship based on the same conditions" - with a full worked example.
`withWhereRelation()` is to `whereRelation()` (documented, per Chapter 4's own correction) what
`withWhereHas()` is to `whereHas()`: the concise column/operator/value sibling of a documented
closure-based method, never itself named in the docs. 

**Alias flag**: not an alias - a genuine
combination of two documented primitives (`whereRelation()` and `with()`) into one call, and the
same combination `withWhereHas()` already makes with the closure form. 

**Version note**:
confirmed unchanged in `v13.22.0`, core query-builder code.

### Minimal snippet

```php
$results = Ticket::withWhereRelation('replies', 'is_urgent', true)->get();
```

### Documented way vs. discovered way

Chapter 4 repeated a caveat on every relation-condition entry: filtering does not eager-load,
`with()` is still needed separately. `withWhereHas()` is Laravel's own documented answer to
that gap for the closure form; `withWhereRelation()` is the same answer for the concise
shorthand this chapter and Chapter 4 have both been using:

```php
$documented = Ticket::withWhereHas('replies', fn ($query) => $query->where('is_urgent', true))->get();
$discovered = Ticket::withWhereRelation('replies', 'is_urgent', true)->get();

expect($documented->pluck('id'))->toEqual($discovered->pluck('id'))
    ->and($documented->pluck('id'))->toEqual(collect([$escalated->id]));

foreach ([$documented, $discovered] as $results) {
    $ticket = $results->first();

    expect($ticket->relationLoaded('replies'))->toBeTrue()
        ->and($ticket->replies)->toHaveCount(1)
        ->and($ticket->replies->first()->is_urgent)->toBeTrue();
}
```

Both forms match the same ticket and both eager-load only its urgent reply, not the calm one
sitting on the same ticket - the condition applies identically to the filter and to the eager
load, which is the entire point of reaching for either method over a plain `with('replies')`
applied afterward. Like `whereRelation()` in Chapter 4, the shorthand is not limited to a single
column/operator/value comparison - a closure works exactly as it does with `whereHas()`, for
whenever a condition needs more than one clause:

```php
$results = Ticket::withWhereRelation('replies', function ($query) {
    $query->where('is_urgent', true)->where('response_minutes', '<', 10);
})->get();

expect($results->pluck('id'))->toEqual(collect([$matching->id]))
    ->and($results->first()->relationLoaded('replies'))->toBeTrue()
    ->and($results->first()->replies)->toHaveCount(1);
```

### Real scenario: a support escalation dashboard

The dashboard needs tickets that have at least one urgent reply, with only that urgent reply
attached and ready to display, not the ticket's full reply history:

```php
$withUrgentReply = Ticket::factory()->create();
Reply::factory()->urgent()->for($withUrgentReply)->create();
Reply::factory()->for($withUrgentReply)->create();

$withOnlyCalmReplies = Ticket::factory()->create();
Reply::factory()->for($withOnlyCalmReplies)->create();

$withNoReplies = Ticket::factory()->create();

$escalationDashboard = Ticket::withWhereRelation('replies', 'is_urgent', true)->get();

expect($escalationDashboard->pluck('id'))->toEqual(collect([$withUrgentReply->id]));

$ticket = $escalationDashboard->first();

expect($ticket->relationLoaded('replies'))->toBeTrue()
    ->and($ticket->replies)->toHaveCount(1)
    ->and($ticket->replies->first()->is_urgent)->toBeTrue();
```

Only the ticket with an urgent reply reaches the dashboard, and its `replies` collection already
holds exactly that one reply - loaded, filtered, and ready to render, without a second query and
without the calm reply on the same ticket getting mixed in.

One closing note before the summary: none of these three methods replace the manual, multi-query
approach in every case. When a metric needs to be isolated - read on its own, cached separately,
or recomputed on a different schedule than the rest of the query - a dedicated call for it is
still the right tool. What these methods remove is the busywork of writing that combination out
by hand every time the same shapes recur: two scopes fused instead of chained, six named
aggregate functions plus whichever one Laravel did not name, and a relation filter that eager
loads itself.

## Quick reference

| Entry | Documented alternative | When to prefer the undocumented one |
|---|---|---|
| `mergeConstraintsFrom()` | Chaining both scopes directly on one builder | Combining builders obtained independently or at different points in the code, not chained up front |
| `withAggregate()` | `withCount()` / `withMax()` / `withMin()` / `withSum()` / `withAvg()` / `withExists()` | An aggregate function not among the six named wrappers |
| `withWhereRelation()` | `withWhereHas()` with a closure | A single column/operator/value condition, without writing a closure for it |

Part II closes here. Chapter 4 gave relationship conditions a concise column/operator/value
syntax to sit alongside `whereHas()`'s closures; Chapter 5 turned to the query builder itself,
composing and aggregating across builders once those same relationships feed a report or a
dashboard. Part III moves to the HTTP client, a different corner of the framework with no
narrative dependency on the helpdesk domain built across these two chapters.
