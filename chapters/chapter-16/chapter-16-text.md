# Chapter 16 - Mail and localization

Chapter 15 opened Part VII (Observing and Communicating) by controlling how far an event's
response chain runs and by reaching directly into the log pipeline. Chapter 16 closes it by
turning to two adjacent but distinct layers of the same concern: how an email actually leaves the
application outside the Mailable-based flow the documentation covers, and how a piece of
translated text is resolved once the standard locale/fallback mechanism is not enough.

The two halves of this chapter share no code. The Mail block, covered here and in the two
sections that follow it, sends alerts to the fulfillment team about a problem order - `Order` has
no email column in this codebase, so the recipient is deliberately internal, never the customer.
The Localization block later in the chapter revisits `Order` from a different angle: the status
label shown when a customer looks one up.

## `Mail::raw()`, `Mail::plain()`, and `Mail::html()`

**Case type**: three undocumented methods on `Illuminate\Mail\Mailer` (and the `Mail` facade),
sitting beside the documented Mailable-based flow (`make:mail`, a class with a `build()` method,
`Mail::to(...)->send(new SomeMailable)`) that `mail.md` covers in full. 

**Alias flag**: not
aliases - each one skips a different part of that pipeline rather than just calling `send()`
under a shorter name: `raw()` skips the view layer entirely, `plain()` renders a view but keeps
only its text part, `html()` accepts HTML directly with no view render step involved at all.

**Audience**: application developers, no shift toward package authors. 

**Stability**: core mail
component, no minor-version churn found while verifying against v13.22.0.

### Minimal snippet

```php
Mail::raw('The nightly export finished with 3 warnings.', function ($message) {
    $message->to('ops@example.com')->subject('Export warnings');
});
```

### Documented way vs. discovered way

`mail.md`'s own canonical example for sending mail is a Mailable class:

```php
Mail::to($request->user())->send(new OrderShipped($order));
```

That class needs a `build()` method, at minimum a view to render, and its own file - reasonable
overhead for a message that will be reused, tested on its own, or grows past a one-off. For a
short, one-off internal alert, all three of that ceremony's pieces can be skipped, each in a
different way:

```php
// No class, no view: the text is the entire message body.
Mail::raw($text, $callback);

// No class: a view still exists, but only its text part is ever sent.
Mail::plain($view, $data, $callback);

// No class, no view: the HTML is already in hand as a string.
Mail::html($html, $callback);
```

One pitfall applies to all three: `Mail::fake()` does not observe them the way it observes a
Mailable. `Illuminate\Support\Testing\Fakes\MailFake::raw()` is an explicit no-op - nothing is
sent and nothing is recorded, so a test asserting on it with `Mail::assertSent()` would pass
vacuously, or rather never see anything to assert at all. `plain()` and `html()` are not
overridden by `MailFake` in any form, so calling them while `Mail::fake()` is active falls
straight through to the real mailer and genuinely sends. None of the three can be tested through
the fake; testing them means exercising the real mailer, which is exactly what the real scenario
below does.

### Real scenario: alerting the fulfillment team about a problem order

`App\Support\Fulfillment\OrderIssueReporter` uses all three, one method per method:

```php
class OrderIssueReporter
{
    public function reportUrgent(Order $order, string $note): void
    {
        Mail::raw(
            "Order {$order->tracking_code}: {$note}",
            function (Message $message) use ($order) {
                $message->to(config('services.fulfillment.alert_address'))
                    ->subject("Urgent order issue: {$order->tracking_code}");
            }
        );
    }

    public function reportFromTemplate(Order $order, string $note): void
    {
        Mail::plain(
            'emails.fulfillment.issue-plain',
            ['order' => $order, 'note' => $note],
            function (Message $message) use ($order) {
                $message->to(config('services.fulfillment.alert_address'))
                    ->subject("Order issue report: {$order->tracking_code}");
            }
        );
    }

    public function reportRichAlert(Order $order, string $note): void
    {
        $html = view('emails.fulfillment.issue-rich', [
            'order' => $order,
            'note' => $note,
        ])->render();

        Mail::html($html, function (Message $message) use ($order) {
            $message->to(config('services.fulfillment.alert_address'))
                ->subject("Order issue alert: {$order->tracking_code}");
        });
    }
}
```

`reportUrgent()` needs nothing beyond the note itself - there is no view to author for a one-line
ping. `reportFromTemplate()` reuses a small Blade view, `emails.fulfillment.issue-plain`, but
`plain()` forces it into a text-only message regardless of what the view contains, so the view
never needs to worry about HTML at all. `reportRichAlert()` goes the other way: the view,
`emails.fulfillment.issue-rich`, is rendered ahead of time with `view(...)->render()`, and the
resulting HTML string is handed to `html()` directly - `html()` never touches the view layer
itself, only the string it is given.

All three are addressed to `config('services.fulfillment.alert_address')`, never to the customer:
`Order` has no email column, and this alert is about an order, not to whoever placed it. Testing
any of them means reading from the real mail transport instead of `Mail::fake()`, per the pitfall
above - this codebase already configures an `array` transport for tests
(`MAIL_MAILER=array` in `phpunit.xml`), which collects real, unsent messages in memory:

```php
$messages = Mail::getSymfonyTransport()->messages();
expect($messages)->toHaveCount(1);

$email = $messages->first()->getOriginalMessage();
expect($email->getTo()[0]->getAddress())->toBe('ops@example.test');
```

## `Mail::sendNow()`

**Case type**: an undocumented method on `Illuminate\Mail\Mailer` (and the `Mail`/`PendingMail`
facade chain), sitting beside the documented `send()`, `queue()`, and `later()` that `mail.md`
covers for a Mailable implementing `Illuminate\Contracts\Queue\ShouldQueue`. 

**Alias flag**: not
an alias - on a Mailable that does not implement `ShouldQueue`, `send()` already sends
immediately, so `sendNow()` adds nothing there; its entire value is forcing an immediate send on
a Mailable that otherwise would queue. 

**Audience**: application developers, no shift toward
queue-worker or package-author concerns. 

**Stability**: core mail component, no minor-version
churn found while verifying against v13.22.0.

### Minimal snippet

```php
// $delayed implements ShouldQueue.
Mail::to($address)->send($delayed);    // queued, delivered whenever a worker picks it up
Mail::to($address)->sendNow($delayed); // sent immediately, queue skipped entirely
```

### Documented way vs. discovered way

`mail.md`'s documented pair for controlling when a queued Mailable is delivered is `queue()` and
`later()`:

```php
Mail::to($request->user())->queue(new OrderShipped($order));
Mail::to($request->user())->later(now()->addMinutes(10), new OrderShipped($order));
```

Both only move delivery later: `queue()` pushes it onto the queue right away, `later()` schedules
it for a future moment. Neither one goes in the opposite direction - forcing a Mailable that
already implements `ShouldQueue` to send immediately instead of waiting for a worker.
`Mail::sendNow()` is that missing direction: it calls the exact same build/render pipeline as
`send()`, but dispatches through the real transport synchronously regardless of `ShouldQueue`.

### Real scenario: escalating a shipping delay when it cannot wait for a worker

`App\Mail\OrderShippingDelayed` is the first Mailable in this codebase, and it implements
`ShouldQueue`:

```php
class OrderShippingDelayed extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Order $order,
        public string $reason,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Shipping delay: {$this->order->tracking_code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.fulfillment.shipping-delayed',
            with: [
                'order' => $this->order,
                'reason' => $this->reason,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
```

`OrderIssueReporter::escalateShippingDelay()` sends it one way or the other depending on how
urgent the delay is:

```php
public function escalateShippingDelay(Order $order, string $reason, bool $urgent = false): void
{
    $recipient = Mail::to(config('services.fulfillment.alert_address'));

    if ($urgent) {
        $recipient->sendNow(new OrderShippingDelayed($order, $reason));

        return;
    }

    $recipient->send(new OrderShippingDelayed($order, $reason));
}
```

A routine delay goes through `send()` and waits for a queue worker like any other `ShouldQueue`
Mailable. A delay serious enough to need the fulfillment team's attention right now goes through
`sendNow()` instead, bypassing the queue entirely regardless of the Mailable's own
`ShouldQueue` contract. `Mail::fake()` makes the difference directly observable: the same
Mailable class ends up in different collections depending on which method sent it.

```php
Mail::assertQueued(OrderShippingDelayed::class, fn (OrderShippingDelayed $mail) => /* ... */);
Mail::assertNotSent(OrderShippingDelayed::class);   // not urgent: queued, not sent

Mail::assertSent(OrderShippingDelayed::class, fn (OrderShippingDelayed $mail) => /* ... */);
Mail::assertNotQueued(OrderShippingDelayed::class); // urgent: sent, never queued
```

## `Mail::alwaysFrom()`, `Mail::alwaysReplyTo()`, and `Mail::alwaysReturnPath()`

**Case type**: an undocumented runtime trio on `Illuminate\Mail\Mailer` (and the `Mail` facade),
beside the documented, config-time-only `'from'` key in `config/mail.php` that `mail.md` covers.
The trio stops at three on purpose: `Mail::alwaysTo()`, the fourth method of the same family on
the same class, is documented in `mail.md` as the way to route every message to a single address,
and is not part of this entry.

**Alias flag**: not aliases - the config key can only ever be set once, at deploy time, the same
for every environment reading that file; these three add a runtime, environment-conditional
override on top of it, and reply-to/return-path have no config-time equivalent at all, not just a
more limited one. 

**Audience**: application developers, no shift toward package authors.

**Stability**: core mail component, no minor-version churn found while verifying against v13.22.0.

### Minimal snippet

```php
Mail::alwaysFrom('capture@example.test');
Mail::alwaysReplyTo('capture@example.test');
Mail::alwaysReturnPath('capture@example.test');

// Every message built by this mailer afterward uses that address for all three,
// regardless of what the Mailable/raw()/plain()/html() call itself specifies.
```

### Documented way vs. discovered way

`mail.php`'s documented `'from'` key sets the sender once, for every environment that reads the
same file:

```php
'from' => [
    'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    'name' => env('MAIL_FROM_NAME', env('APP_NAME', 'Laravel')),
],
```

There is no equivalent key at all for reply-to or return-path, and the from-address itself cannot
change based on anything the application decides at runtime - only on which `.env` file happened
to be loaded. `Mail::alwaysFrom()`, `Mail::alwaysReplyTo()`, and `Mail::alwaysReturnPath()` cover
both gaps: callable from application code, conditionally, whenever a real decision (not just a
fixed environment file) determines the sender.

One pitfall applies to all three, the same shape as the one `raw()`/`plain()`/`html()` already
ran into: `Mail::fake()` does not observe them either. `Illuminate\Support\Testing\Fakes\MailFake` does not define any of the three, so
calling them while `Mail::fake()` is active falls through to the real `MailManager` and genuinely
mutates the real `Mailer` instance's stored addresses - but `MailFake`'s own `send()`/`sendMail()`
never consult that state when recording a message, so the override has no observable effect on
anything `Mail::assertSent()`/`assertQueued()` can see. Testing the actual effect means reading
from the real transport, exactly as this chapter's first entry already does.

### Real scenario: capturing every mail sent from staging

`App\Providers\AppServiceProvider::boot()` applies all three, guarded by the environment:

```php
if ($this->app->environment('staging')) {
    Mail::alwaysFrom(config('services.staging_capture.address'));
    Mail::alwaysReplyTo(config('services.staging_capture.address'));
    Mail::alwaysReturnPath(config('services.staging_capture.address'));
}
```

This is decided once at boot, not inside `OrderIssueReporter` or any future mail sender: staging
is a fixed, known environment for the whole life of the process, so there is nothing to
re-evaluate on every message. The guard is deliberately conditional, though - it must never run
unconditionally, or a misconfigured deploy would silently divert every email, including real
customer-facing mail from other parts of the application, into the staging capture address
outside staging as well. Leaving this guard active (or its environment check broken) is exactly
the kind of mistake that would only surface once a customer reports an email that never arrived.

Testing a boot-time guard like this needs one detail that is easy to miss: `boot()` already runs
once, during test setup, before any test body executes - a later `$this->app['env'] = 'staging'`
mutation cannot reach back and retrigger a check that already ran. Re-invoking the guard after the
mutation is the same technique this book's own companion code already uses for an
identically-shaped guard in `StockPruneMovementsCommand::prohibit()` - but here it has to be the
guard alone, not the whole of `boot()`: `boot()` also registers this provider's `Event::listen()`
calls, and `Illuminate\Events\Dispatcher::listen()` appends to an array rather than overwriting,
so calling `boot()` a second time would silently double-register every one of them for the rest
of the test. `AppServiceProvider::applyStagingMailCapture()` isolates just the guard for exactly
this reason:

```php
$this->app['env'] = 'staging';
(new AppServiceProvider($this->app))->applyStagingMailCapture();

(new OrderIssueReporter)->reportUrgent($order, 'Package damaged in transit.');

$email = Mail::getSymfonyTransport()->messages()->first()->getOriginalMessage();
$stagingAddress = config('services.staging_capture.address');

expect($email->getFrom()[0]->getAddress())->toBe($stagingAddress)
    ->and($email->getReplyTo()[0]->getAddress())->toBe($stagingAddress)
    ->and($email->getReturnPath()->getAddress())->toBe($stagingAddress);
```

Outside staging, the same call leaves every address at whatever the message would otherwise use.
With `Mail::fake()` active and staging simulated the same way, `Mail::assertQueued()` still
passes on the Mailable's own content and recipient - there is simply no assertion that could ever
expose the overridden from/reply-to/return-path in the first place.

This closes the chapter's Mail block. The Localization block that follows shares no code with it:
it turns from how an email leaves the application to how a piece of translated text is resolved,
revisiting `Order` from a different angle - the status label shown when a customer looks one up.

## `Lang::handleMissingKeysUsing()`

**Case type**: an undocumented method on `Illuminate\Translation\Translator` (and the `Lang`
facade), alongside the documented fallback-locale mechanism it observes rather than replaces -
`localization.md` covers publishing and organizing translation files, and how a fallback locale
fills gaps in the requested one, but nothing about being notified when even the fallback comes up
empty. 

**Alias flag**: not an alias - nothing else in the documented API reacts to a missing key
at the point of lookup. 

**Audience**: application developers, no shift toward package authors.

**Stability**: core framework, no minor-version churn found while verifying against v13.22.0.

### Minimal snippet

```php
Lang::handleMissingKeysUsing(function ($key, $replace, $locale, $fallback) {
    // record $key/$locale somewhere, e.g. for later review
    return null; // keep the original key as the resolved value
});

Lang::get('greetings.missing', [], 'fr', false); // 'greetings.missing' - untranslated, now recorded
```

### Documented way vs. discovered way

`localization.md` documents the fallback locale as the answer to a missing translation: if
`config('app.fallback_locale')` has the key, that locale's text is used instead, silently. There
is no documented way to learn that this happened - a translator finds out only by noticing raw
keys in the interface, or not at all if the fallback happens to cover the gap. There is nothing
comparable to being told, at the moment of lookup, exactly which key and which locale just missed.

### Real scenario: detecting drift between locale files

`lang/en/orders.php` and `lang/es/orders.php` hold the same `status` labels, except one: `en` has
picked up a `refunded` status the Spanish file has not caught up with yet.

```php
return [
    'status' => [
        'pending' => 'Pending',
        'shipped' => 'Shipped',
        'delayed' => 'Delayed',
        'refunded' => 'Refunded',
    ],
];
```

```php
return [
    'status' => [
        'pending' => 'Pendiente',
        'shipped' => 'Enviado',
        'delayed' => 'Retrasado',
    ],
];
```

`App\Support\Localization\MissingTranslationCollector` just remembers every miss it is told about:

```php
class MissingTranslationCollector
{
    protected array $misses = [];

    public function record(string $key, ?string $locale): void
    {
        $this->misses[] = [$key, $locale];
    }

    public function all(): array
    {
        return $this->misses;
    }
}
```

It is bound as a plain singleton, deliberately, not `scoped()` the way this chapter's other
context holder, `PreferredLocaleContext`, is further down: the whole point is to accumulate misses
across the entire process, not just one request. That choice carries the same cost every other
process-lifetime singleton in this book does - under a long-running worker such as Octane,
`$misses` grows for as long as the worker lives, since nothing here ever drains or bounds it. A
real deployment would read `all()` and reset the collector periodically (a scheduled command, for
instance), rather than let it accumulate unchecked for the worker's entire lifetime.

`AppServiceProvider::boot()` wires every miss to it:

```php
Lang::handleMissingKeysUsing(function (string $key, array $replace, ?string $locale, bool $fallback) {
    $this->app->make(MissingTranslationCollector::class)->record($key, $locale);

    return null;
});
```

`OrderController::lookup()` is where a miss can actually happen. It answers two different kinds
of caller, and the one that names a locale outright needs a deliberate detail to make a miss
possible at all:

```php
$key = "orders.status.{$order->status}";
$requested = $request->string('locale')->toString();

return response()->json([
    'uuid' => $order->uuid,
    'status' => $order->status,
    'status_label' => $requested !== ''
        ? Lang::get($key, [], $requested, false)
        : Lang::get($key),
]);
```

That last argument, `false`, is not optional on the branch that carries it. `Translator::get()`
only adds
`config('app.fallback_locale')` to the locales it checks when this argument is `true` - its
default, and the only value `__()`/`trans()` ever use, since neither helper exposes it at all.
With the default, a lookup for `refunded` in `es` would silently succeed via the English fallback
(`'en'` genuinely has the key) and `Lang::handleMissingKeysUsing()` would never fire - the drift
would stay invisible. Passing `false` restricts the check to `es` alone: a genuine miss there
reaches the callback, and `status_label` comes back as the literal key,
`orders.status.refunded`, exactly Laravel's ordinary behavior for a key that resolves nowhere at
all.

A caller that names no locale takes the other branch, keeps the ordinary fallback chain, and gets
its language decided somewhere else entirely. That branch is what the next section is about.

## `Lang::determineLocalesUsing()`

**Case type**: an undocumented method on `Illuminate\Translation\Translator` (and the `Lang`
facade), beside the documented `App::setLocale()` that `localization.md` presents as the way to
change language for a single HTTP request at runtime. 

**Alias flag**: not an alias -
`App::setLocale()` replaces the single locale the translator treats as current, for everything
that happens afterward in the same process; this replaces the entire ordered list of candidate
locales, recomputed on every individual lookup, and never touches the process's own locale at
all. 

**Audience**: application developers, no shift toward package authors. 

**Stability**: core
framework, no minor-version churn found while verifying against v13.22.0.

### Minimal snippet

```php
Lang::determineLocalesUsing(fn (array $locales) => ['pt_BR', ...$locales]);

__('orders.status.shipped'); // pt_BR is checked first, then the chain that was already there
```

### Documented way vs. discovered way

`localization.md` documents `App::setLocale()`, and it is genuinely a per-request mechanism: call
it from middleware and the rest of that request resolves in the chosen language. What it cannot
do is vary below that granularity. It assigns `Translator::$locale`, so it holds until something
assigns it again, and everything the request touches afterward - a queued job serialized mid
request, a notification rendered at the end of the controller, a second record belonging to a
different customer - is resolved in the locale the last caller happened to set. Restoring the
previous value afterward is the caller's own responsibility, and forgetting to is a silent bug
rather than an error.

`Lang::determineLocalesUsing()` works one level down. `Translator::get()` decides which locales
to consult with `$locales = $fallback ? $this->localeArray($locale) : [$locale];`, and
`localeArray()` builds `[$locale ?: $this->locale, $this->fallback]`, then passes that array
through the registered callback before walking it. The callback therefore sees the whole chain,
for one lookup, and can prepend to it, reorder it, or replace it outright. Nothing persists: the
next lookup rebuilds the array from scratch and calls the callback again. `localeArray()` also
applies `array_unique()`/`array_values()` to whatever comes back, so prepending a locale that was
already in the chain is harmless and needs no manual deduplication.

### Real scenario: resolving a status label in the customer's own language

An order carries the language its customer asked to be contacted in, in a nullable
`preferred_locale` column. A tiny holder makes that value reachable from outside the controller:

```php
class PreferredLocaleContext
{
    protected ?string $locale = null;

    public function set(?string $locale): void
    {
        $this->locale = $locale;
    }

    public function current(): ?string
    {
        return $this->locale;
    }
}
```

How it is bound matters more than what it contains:

```php
$this->app->scoped(PreferredLocaleContext::class);
```

`scoped()`, not `singleton()` and not `bind()`. The callback registered in
`AppServiceProvider::boot()` and the controller must reach the same instance, so a plain `bind()`
would hand them one each and `current()` would always be `null`. A `singleton()` would work but
would carry one request's preference into the next under a long-running server such as Octane,
the same hazard Chapter 15 raised for log context. `scoped()` is a singleton that
`forgetScopedInstances()` clears at every request and job boundary, which is exactly the lifetime
this needs.

The callback itself stays a plain array reshaping, since it runs on every lookup that consults
the chain:

```php
Lang::determineLocalesUsing(function (array $locales) {
    $preferred = $this->app->make(PreferredLocaleContext::class)->current();

    return $preferred === null ? $locales : [$preferred, ...$locales];
});
```

It prepends rather than truncates, on purpose. An order with `preferred_locale` of `es` whose
status is `refunded` - the label `lang/es/orders.php` has not caught up with - still resolves to
`Refunded`, because the English fallback is still sitting behind `es` in the chain. Only the
order in which locales are tried has changed.

`OrderController::lookup()` supplies the value and otherwise stays out of the way:

```php
$context->set($order->preferred_locale);
```

One detail is worth stating plainly, because it decides where this entry can and cannot be used.
The callback lives inside `localeArray()`, and `Translator::get()` only calls `localeArray()`
when its `$fallback` argument is `true`. The strict lookup of the previous section passes
`false`, so `Lang::determineLocalesUsing()` never fires on it - the two entries in this block
cannot both act on the same call, by construction rather than by choice. That is why
`lookup()` branches: an explicitly requested locale is audited against that locale alone, and a
request that names none has its language decided by the order it is about.

## Summary

| Entry | Documented alternative | When to prefer it |
|---|---|---|
| `Mail::raw()` | A Mailable class plus `Mail::to(...)->send(...)` | The message is one throwaway line of text and a whole class, view, and test would exist only to carry it |
| `Mail::plain()` | A Mailable whose `content()` declares a `text` view | A view already holds the copy, but nothing else about the message justifies a class of its own |
| `Mail::html()` | A Mailable whose `content()` declares an `html` view | The HTML is already assembled in hand, by a renderer or an upstream service, and there is no view to point at |
| `Mail::sendNow()` | `Mail::to(...)->send(...)` on a Mailable that does not implement `ShouldQueue` | The same Mailable must queue on its ordinary path and bypass the queue on an urgent one, without a second class |
| `Mail::alwaysFrom()` / `alwaysReplyTo()` / `alwaysReturnPath()` | The `'from'` key in `config/mail.php` | The sender must depend on something decided at runtime, or reply-to and return-path need an override the config file has no key for at all |
| `Lang::handleMissingKeysUsing()` | The fallback locale filling the gap silently | Somebody has to learn that a key was missing, not just that the interface still rendered |
| `Lang::determineLocalesUsing()` | `App::setLocale()` | The language must be decided per lookup, from data, without leaving the process switched over for everything that follows |

Each documented alternative is not wrong, only narrower. A dedicated Mailable is worth its
ceremony the moment the message will be reused, tested on its own, or grows past a single
one-off: `raw()`, `plain()`, and `html()` earn their place only while none of that is true.
`send()` already sends immediately whenever the Mailable does not implement `ShouldQueue`, which
leaves `sendNow()` with nothing to add unless the same class genuinely needs both paths. The
static `'from'` key alone is fine wherever the sender never has to change based on a runtime
decision, only on which environment file was loaded. `handleMissingKeysUsing()` has nothing to
observe in an application that ships translations in one locale, where drift between files cannot
occur. And `App::setLocale()`'s whole-process switch is precise enough whenever a request really
does belong to a single language from beginning to end. Each entry in this chapter earns its
place only once one of those narrower conditions stops holding.

Part VII - Observing and Communicating ends here, complete across Chapters 15-16: from observing
the application's own events and logs to communicating outward, whether by mail sent without the
Mailable pipeline or by text resolved outside the standard locale chain. Part VIII - Application
Infrastructure opens next with Chapter 17, "Configuration and cookies at runtime", moving from
what the application says to the outside world to the configuration and cookie state it carries
while saying it.
