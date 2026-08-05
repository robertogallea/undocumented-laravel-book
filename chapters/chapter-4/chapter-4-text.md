# Chapter 4 - Querying relationships without `whereHas`

Chapter 4 opens Part II (Eloquent Beyond Basic Relationships), turning from the standalone
support classes of Chapter 3 toward Eloquent's own query builder. `whereHas()` and
`whereDoesntHave()` are the documented way to filter a query by a condition on related data;
this chapter walks through a family of concise siblings that build the closure for you from a
plain column, operator, and value, so the common single-condition case does not need a
`fn ($query) => $query->where(...)` wrapper of its own. Every example is verified against
`laravel/framework` `v13.22.0` and the `laravel/docs` `13.x` branch, and is a real, green Pest
test drawn from the book's companion application.

The running scenario for this chapter is an internal helpdesk application: tickets that carry
replies (some public, some internal-only), notes attached polymorphically to either a ticket or
a knowledge-base article, tags, and a category - the kind of relational shape a support team's
search and triage screens are built on.

A word on this chapter's entry list first. The most obvious candidate for this opening
section, `whereRelation()`/`orWhereRelation()`, turned out to already have its own place in the
official documentation - `whereRelation()` with two worked examples, `orWhereRelation()` named
right alongside it - once checked directly against the `13.x` docs branch rather than assumed.
The same is true of `whereMorphRelation()` and `whereNotMorphedTo()`, planned for this
chapter's second entry. Both pairs are still worth knowing, but they do not belong in a book
about undocumented API: this chapter instead covers their genuinely undocumented negation
siblings, which live in the exact same source file and cover the exact same ground for the
"does not have" case.

## `whereDoesntHaveRelation()` and `orWhereDoesntHaveRelation()`

**Case type**: undocumented pair of methods inside `Illuminate\Database\Eloquent\Concerns\
QueriesRelationships`, a trait that is otherwise heavily documented - `whereHas()`,
`orWhereHas()`, `whereDoesntHave()`, and `orWhereDoesntHave()` all have their own docs
section, and even the closely related `whereRelation()`/`orWhereRelation()` are named there.
`whereDoesntHaveRelation()` and `orWhereDoesntHaveRelation()` are not. 

**Alias flag**: not a
trivial alias. Both delegate to `whereDoesntHave()`/`orWhereDoesntHave()` with a closure built
on the fly from a plain column, operator, and value - the same convenience-wrapper pattern
`whereRelation()` uses for `whereHas()` - and both fall back to invoking a raw closure directly
if one is passed instead of a column name, so nothing `whereDoesntHave()` can do is lost by
reaching for the shorthand. 

**Version note**: confirmed present and unchanged in `v13.22.0`; no
known instability, this is core query-builder code.

### Minimal snippet

Tickets with no internal reply yet:

```php
$ticketsWithoutInternalReplies = Ticket::whereDoesntHaveRelation('replies', 'is_internal', true)->get();
```

### Documented way vs. discovered way

The same query, written first the documented way, with a closure:

```php
$ticketsWithoutInternalReplies = Ticket::whereDoesntHave(
    'replies',
    fn ($query) => $query->where('is_internal', true)
)->get();
```

`whereDoesntHaveRelation()` does not build a different query underneath - it constructs the
identical closure and hands it to `whereDoesntHave()`, so the two forms compile to the same SQL
with the same bindings, confirmed directly in the companion app's test suite:

```php
$discovered = Ticket::whereDoesntHaveRelation('replies', 'is_internal', true);
$documented = Ticket::whereDoesntHave('replies', fn ($query) => $query->where('is_internal', true));

expect($discovered->toSql())->toBe($documented->toSql())
    ->and($discovered->getBindings())->toBe($documented->getBindings());
```

Two things worth knowing before reaching for the shorthand everywhere. First, like `whereHas()`
and its relatives, this only filters - it does not eager-load `replies`; a `with('replies')` is
still needed separately to avoid an N+1 when the matched tickets' replies are read afterward.
Second, `whereDoesntHaveRelation()` inherits `whereDoesntHave()`'s support for dot-notation on
nested relations (e.g. `'replies.author'`), because both ultimately delegate to the same `has()`
method where that logic lives - but the column condition this method builds only ever applies to
the last segment of a dotted relation path, with any intermediate relation just required to
exist, and the negation wraps the whole chain rather than just the last link. Confirmed against a
reply that also belongs to an author:

```php
$john = User::factory()->create(['name' => 'John']);
$jane = User::factory()->create(['name' => 'Jane']);

$ticketWithReplyByJohn = Ticket::factory()->create();
Reply::factory()->for($john, 'author')->for($ticketWithReplyByJohn)->create();

$ticketWithReplyByJane = Ticket::factory()->create();
Reply::factory()->for($jane, 'author')->for($ticketWithReplyByJane)->create();

$ticketWithNoReplies = Ticket::factory()->create();

$matches = Ticket::whereDoesntHaveRelation('replies.author', 'name', 'John')->pluck('id');

expect($matches)->toContain($ticketWithReplyByJane->id, $ticketWithNoReplies->id)
    ->and($matches)->not->toContain($ticketWithReplyByJohn->id);
```

The ticket replied to by John is correctly excluded, while both the ticket replied to by Jane and
the ticket with no replies at all surface - `'name'` never constrains `replies` directly, only
the nested `author`. For a single relation, as in every other example in this chapter, this
distinction does not matter. When a condition needs more than one clause, or logic more complex
than a single column/operator/value comparison, the documented closure-based method remains the
right tool - a principle the rest of this chapter comes back to.

### Real scenario: a support triage query

A support team's triage view needs tickets that are already flagged urgent, or that nobody has
answered internally yet - a single query combining a base filter with the negation in `or`:

```php
$urgentWithInternalReply = Ticket::factory()->urgent()->create();
Reply::factory()->internal()->for($urgentWithInternalReply)->create();

$openWithNoReplies = Ticket::factory()->create(['status' => 'open']);

$openWithInternalReply = Ticket::factory()->create(['status' => 'open']);
Reply::factory()->internal()->for($openWithInternalReply)->create();

$matches = Ticket::where('status', 'urgent')
    ->orWhereDoesntHaveRelation('replies', 'is_internal', true)
    ->pluck('id');

expect($matches)->toContain($urgentWithInternalReply->id, $openWithNoReplies->id)
    ->and($matches)->not->toContain($openWithInternalReply->id);
```

The urgent ticket surfaces regardless of its replies, the untouched open ticket surfaces because
nobody has answered it internally, and the open ticket that already has an internal reply is
correctly left off the list - one `where()`/`orWhereDoesntHaveRelation()` pair standing in for
what would otherwise be a `where()` next to a full `orWhereDoesntHave()` closure.

## `whereMorphDoesntHaveRelation()` and `orWhereMorphDoesntHaveRelation()`

**Case type**: undocumented pair of methods inside the same `QueriesRelationships` trait, the
polymorphic counterpart of the previous entry. Their positive siblings,
`whereMorphRelation()`/`orWhereMorphRelation()`, are exactly the pair this chapter's opening note
already flagged as documented; the negation pair is not. 

**Alias flag**: not a trivial alias -
same closure-construction convenience as every other entry in this chapter, delegating to
`whereDoesntHaveMorph()`/`orWhereDoesntHaveMorph()`. 

**Version note**: confirmed present and
unchanged in `v13.22.0`; no known instability, core query-builder code.

### Minimal snippet

Notes attached to a ticket that has not been escalated to urgent:

```php
$notesOnNonUrgentTickets = Note::whereMorphDoesntHaveRelation('notable', [Ticket::class], 'status', 'urgent')->get();
```

`notable` is the `MorphTo` relation declared on `Note`, so it is `Note` that gets queried here,
not `Ticket` - the same direction the documented `whereHasMorph()` example in the official docs
uses (`Comment::whereHasMorph('commentable', [Post::class, Video::class], ...)`, querying
`Comment`, not `Post`/`Video`).

### Documented way vs. discovered way

The same query, written first the documented way, with a closure:

```php
$notesOnNonUrgentTickets = Note::whereDoesntHaveMorph(
    'notable',
    [Ticket::class],
    fn ($query) => $query->where('status', 'urgent')
)->get();
```

Confirmed identical SQL and bindings between the two forms, same proof technique as the
previous entry:

```php
$discovered = Note::whereMorphDoesntHaveRelation('notable', [Ticket::class], 'status', 'urgent');
$documented = Note::whereDoesntHaveMorph(
    'notable',
    [Ticket::class],
    fn ($query) => $query->where('status', 'urgent')
);

expect($discovered->toSql())->toBe($documented->toSql())
    ->and($discovered->getBindings())->toBe($documented->getBindings());
```

One gotcha worth knowing before trusting a "doesn't have" query on a polymorphic relation:
`$types` is not just a filter on which types to consider, it is a precondition of matching at
all, in both directions. Internally, `whereMorphDoesntHaveRelation()` builds one ordinary
`BelongsTo`-style exists check per entry in `$types`, each gated by an explicit
`notable_type = '<Type>'` clause, and OR's them together - it never asks "is this note's
notable relation missing or non-matching" in general, only "is this note's notable a `Ticket`
that fails the condition". A note attached to an `Article` - a type not listed in `$types` - is
excluded from the result exactly as it would be excluded from the positive
`whereHasMorph()`/`whereMorphRelation()` version, not included as "not a matching ticket". The
companion test confirms this directly: a note on an `Article` never appears in the result of
`whereMorphDoesntHaveRelation('notable', [Ticket::class], ...)`, regardless of its own state.
Reaching for `'*'` as the type list (documented separately, under "Querying All Related Models")
is the way to include every polymorphic type instead of an explicit list.

### Real scenario: a support team's note review queue

A review queue needs pinned notes plus notes sitting on tickets that have not been escalated
yet - a base condition on `Note` itself combined with the morph negation in `or`:

```php
$urgentTicket = Ticket::factory()->urgent()->create();
$pinnedNoteOnUrgentTicket = Note::factory()->pinned()->for($urgentTicket, 'notable')->create();

$openTicket = Ticket::factory()->create(['status' => 'open']);
$unpinnedNoteOnOpenTicket = Note::factory()->for($openTicket, 'notable')->create();

$otherUrgentTicket = Ticket::factory()->urgent()->create();
$unpinnedNoteOnUrgentTicket = Note::factory()->for($otherUrgentTicket, 'notable')->create();

$matches = Note::where('is_pinned', true)
    ->orWhereMorphDoesntHaveRelation('notable', [Ticket::class], 'status', 'urgent')
    ->pluck('id');

expect($matches)->toContain($pinnedNoteOnUrgentTicket->id, $unpinnedNoteOnOpenTicket->id)
    ->and($matches)->not->toContain($unpinnedNoteOnUrgentTicket->id);
```

The pinned note surfaces regardless of its ticket's status, the unpinned note on the still-open
ticket surfaces because nobody has escalated it yet, and the unpinned note already sitting on an
urgent ticket is correctly left off the list - it is neither pinned nor attached to a
not-yet-urgent ticket.

## `orWhereAttachedTo()` and `orWhereBelongsTo()`

**Case type**: undocumented pair of methods inside the same `QueriesRelationships` trait, but
with a different shape from the rest of this chapter - their base forms, `whereAttachedTo()` and
`whereBelongsTo()`, are themselves documented with dedicated examples; only the `or` variant of
each is missing. 

**Alias flag**: not a trivial alias - `orWhereAttachedTo($related,
$relationshipName)` is exactly `whereAttachedTo($related, $relationshipName, 'or')`, and
`orWhereBelongsTo()` mirrors `whereBelongsTo()` the same way, but that one extra argument is
precisely what the documented methods do not expose to a caller. Both also auto-derive the
relationship name from the related model's class when the second argument is omitted -
`Str::camel(class_basename($related))` for `whereBelongsTo()` (`Category` -> `category`),
`Str::plural(...)` of the same for `whereAttachedTo()` (`Tag` -> `tags`) - which is why neither
example below needs to name the relationship explicitly. 

**Version note**: confirmed present and
unchanged in `v13.22.0`; no known instability, core query-builder code.

### Minimal snippet

Tickets tagged `vip`, or in the `Billing` category, added to a base filter:

```php
$escalated = Ticket::where('status', 'urgent')->orWhereAttachedTo($vipTag)->get();
$escalated = Ticket::where('status', 'urgent')->orWhereBelongsTo($billing)->get();
```

### Documented way vs. discovered way

Neither `whereAttachedTo()` nor `whereBelongsTo()` has a documented `or` form, so the manual way
is to wrap the `and`-boolean documented method in a closure passed to `orWhere()`:

```php
$escalated = Ticket::where('status', 'urgent')
    ->orWhere(fn ($query) => $query->whereAttachedTo($vipTag))
    ->get();
```

The two forms return the exact same tickets, with the same query bindings - the only difference
in the compiled SQL is the extra pair of grouping parentheses the closure form adds around the
condition. The companion test locates that one boundary explicitly rather than via a generic
pattern, since this check is specific to a query with a single `or` clause, not a general
SQL-diffing technique:

```php
$discovered = Ticket::where('status', 'urgent')->orWhereAttachedTo($vipTag);
$documented = Ticket::where('status', 'urgent')->orWhere(fn ($query) => $query->whereAttachedTo($vipTag));

$discoveredSql = $discovered->toSql();
expect(substr_count($discoveredSql, ' or '))->toBe(1);
$orBoundary = strpos($discoveredSql, ' or ') + strlen(' or ');
$wrappedSql = substr($discoveredSql, 0, $orBoundary).'('.substr($discoveredSql, $orBoundary).')';

expect($documented->toSql())->toBe($wrappedSql)
    ->and($discovered->getBindings())->toBe($documented->getBindings());
```

The same holds, method for method, for `orWhereBelongsTo()` against a closure-wrapped
`whereBelongsTo()`. And as with the two previous entries, both methods only filter - neither
eager-loads `tags` or `category`, so a `with(['tags', 'category'])` is still needed separately to
avoid an N+1 when the matched tickets' tags or category are read afterward.

### Real scenario: an escalation dashboard

A support dashboard needs every ticket that is already urgent, tagged `vip`, or filed under the
`Billing` category - one query chaining both methods after a base filter:

```php
$vipTag = Tag::factory()->create(['name' => 'vip']);
$billing = Category::factory()->create(['name' => 'Billing']);

$urgentTicket = Ticket::factory()->urgent()->create();
$vipTaggedTicket = Ticket::factory()->hasAttached($vipTag, [], 'tags')->create(['status' => 'open']);
$billingTicket = Ticket::factory()->for($billing, 'category')->create(['status' => 'open']);
$unrelatedTicket = Ticket::factory()->create(['status' => 'open']);

$matches = Ticket::where('status', 'urgent')
    ->orWhereAttachedTo($vipTag)
    ->orWhereBelongsTo($billing)
    ->pluck('id');

expect($matches)->toContain($urgentTicket->id, $vipTaggedTicket->id, $billingTicket->id)
    ->and($matches)->not->toContain($unrelatedTicket->id);
```

Each ticket surfaces through a different branch of the same chained query - already urgent,
tagged, or categorized - while the ticket that matches none of the three conditions is correctly
left off the dashboard, with no closure and no explicit relationship name in sight.

## Quick reference

| Entry | Documented alternative | When to prefer the undocumented one |
|---|---|---|
| `whereDoesntHaveRelation()` / `orWhereDoesntHaveRelation()` | `whereDoesntHave()` / `orWhereDoesntHave()` with a closure | A single column/operator/value negation, without writing a closure for it |
| `whereMorphDoesntHaveRelation()` / `orWhereMorphDoesntHaveRelation()` | `whereDoesntHaveMorph()` / `orWhereDoesntHaveMorph()` with a closure | The same single-condition case on a polymorphic relation |
| `orWhereAttachedTo()` / `orWhereBelongsTo()` | `whereAttachedTo()` / `whereBelongsTo()`, manually wrapped in `orWhere()` | Combining a membership check with another condition in `or`, without the extra closure and grouping parens |

Chapter 5 stays in Part II, moving from filtering a single relationship to composing and
aggregating queries across builders - `mergeConstraintsFrom()`, `withAggregate()`, and
`withWhereRelation()`, which pairs a concise relation filter with a matching eager load in a
single call.
