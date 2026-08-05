# Chapter 6 - The HTTP client beyond the basics

Chapter 6 opens Part III (HTTP, APIs, and Testing), turning from Eloquent's query builder to
Laravel's HTTP client. `Http::withBasicAuth()`, `Http::withDigestAuth()`, and `Http::fake()` are
the documented tools for authenticating an outgoing request and faking one in a test; this
chapter walks through four siblings that sit right next to them and cover ground the official
documentation never names by exact method: a third, less common authentication scheme, a way to
stream a response straight to disk instead of buffering it in memory, a way to fake a single
request instance without touching the rest of a test's HTTP traffic, and a way to see the full,
untruncated message of a failed request's exception. Every example is verified against
`laravel/framework` `v13.22.0`, the corresponding Guzzle release actually installed in this
book's companion application (`guzzlehttp/guzzle` 7.15.2), and the `laravel/docs` `13.x` branch,
and is a real, green Pest test drawn from that companion application.

The running scenario for this chapter is an order-management application that needs to pull a
PDF invoice for an order from an internal legacy invoicing service - the kind of system that
still only speaks NTLM, and that a modern application ends up talking to anyway.
`App\Support\LegacyInvoicing\LegacyInvoiceClient` is the small class this chapter builds up one
entry at a time; `OrderController::invoice()` is the recognizable real-world surface it is
called from.

## `withNtlmAuth()`

NTLM (NT LAN Manager) is a challenge-response authentication protocol Microsoft built for
Windows networks, long before HTTP APIs were the norm. Unlike Basic auth, it never puts a
username and password directly on the wire: the client first sends a bare request, the server
answers with a random challenge, and the client replies with a hash computed from that challenge
and the user's password hash - a back-and-forth across several requests on the same connection,
not a single header. It predates and was largely superseded by Kerberos inside modern Active
Directory domains, but plenty of older, standalone intranet systems - internal IIS applications,
legacy SOAP or file-serving endpoints, exactly the kind of system this chapter's legacy invoicing
service represents - never moved past it and still expect it from any client that wants in. That
multi-step handshake is also why NTLM cannot be reduced to setting one header the way Basic auth
can: it has to be handled by the transport layer itself, which is exactly what the stability note
below is about.

**Case type**: undocumented method inside `Illuminate\Http\Client\PendingRequest`'s
"Authentication" section, which is otherwise well documented - `withBasicAuth()`,
`withDigestAuth()`, and `withToken()` all have their own place in `laravel/docs`.
`withNtlmAuth($username, $password)` sits in the exact same part of the class, with the exact
same signature shape, and is never named there. 

**Alias flag**: not an alias - it is a genuinely
different authentication scheme, not a rename of Basic or Digest auth.

**Stability note - read this before using it in production.** `withNtlmAuth()` only works
because Laravel forwards `['user', 'pass', 'ntlm']` straight into Guzzle's `auth` request option,
and Guzzle itself has started retiring that path: as of Guzzle 7.12 (the actual version this
book's companion application has installed, 7.15.2, already includes it), passing `'ntlm'` this
way triggers a deprecation notice, and Guzzle 8.0 will stop applying NTLM through the `auth`
option at all. The same code path also throws an `InvalidArgumentException` outright if the
installed libcurl build has no NTLM support - and NTLM is itself deprecated in curl/libcurl, so
that support is not guaranteed to still be there on a given server. None of this is Laravel's
doing; it is entirely downstream of a dependency actively moving away from NTLM. Treat
`withNtlmAuth()` as something to verify on the exact environment it will run on, not a drop-in
call.

### Minimal snippet

The method in isolation, alongside the two documented schemes it sits next to:

```php
Http::withNtlmAuth($username, $password)->get($url);
```

### Documented way vs. discovered way

`laravel/docs` documents exactly two built-in schemes for this shape of call:

```php
// Basic authentication...
$response = Http::withBasicAuth('taylor@laravel.com', 'secret')->post(/* ... */);

// Digest authentication...
$response = Http::withDigestAuth('taylor@laravel.com', 'secret')->post(/* ... */);
```

`withNtlmAuth()` is the third scheme the same class supports, built the same way, just never
named on that page:

```php
Http::withNtlmAuth('taylor@laravel.com', 'secret')->post(/* ... */);
```

All three end up doing the same thing internally - setting `$this->options['auth']` to a
`[$username, $password, $type]` triple, with only the third element changing.

### Real scenario: authenticating the legacy invoicing client

`LegacyInvoiceClient::forOrder()` is the one place in this chapter's companion code that talks to
the legacy invoicing service, and it authenticates with `withNtlmAuth()` directly:

```php
class LegacyInvoiceClient
{
    public function forOrder(Order $order): Response
    {
        return Http::baseUrl(config('legacy_invoicing.base_url'))
            ->withNtlmAuth(
                config('legacy_invoicing.username'),
                config('legacy_invoicing.password'),
            )
            ->get("/invoices/{$order->uuid}");
    }
}
```

Testing this honestly runs into the same downstream fact behind the stability note above.
`Http::fake()` only replaces the transport layer - it never runs Guzzle's real
`Client::transfer()`, which is the only code that actually turns the `auth` option into
something visible: a real `Authorization` header for Basic auth, or curl-level options for NTLM
and Digest. That means Basic auth shows up on a faked request's headers, but NTLM never does,
under a fake or otherwise, because that translation step simply never runs. The test for this
entry has to reach for `beforeSending()` instead - a callback that fires with the request's raw
options on every send, faked or real, regardless of what Guzzle would have done with them:

```php
it('sets the auth option to a three-element ntlm array via withNtlmAuth()', function () {
    Http::fake();

    $capturedOptions = null;

    Http::withNtlmAuth('legacy-user', 'legacy-secret')
        ->beforeSending(function ($request, $options) use (&$capturedOptions) {
            $capturedOptions = $options;
        })
        ->get('https://legacy-invoicing.internal/invoices/test-uuid');

    expect($capturedOptions['auth'])->toBe(['legacy-user', 'legacy-secret', 'ntlm']);
});
```

A second test exercises `LegacyInvoiceClient` itself end to end against the faked service,
confirming the whole call still resolves normally:

```php
it('authenticates the legacy invoice request for an order with withNtlmAuth()', function () {
    Http::fake([
        'legacy-invoicing.internal/*' => Http::response('%PDF-1.4 fake invoice body', 200),
    ]);

    $order = Order::factory()->create();

    $response = (new LegacyInvoiceClient)->forOrder($order);

    expect($response->status())->toBe(200);

    Http::assertSent(fn ($request) => $request->url() === "https://legacy-invoicing.internal/invoices/{$order->uuid}");
});
```

What this test suite cannot do is prove the Guzzle deprecation notice from the stability note
above actually fires - that only happens inside Guzzle's real transfer logic, which a faked
request never reaches. That fact is verified directly against the installed
`guzzlehttp/guzzle` source instead, not through a runnable assertion.

## `sink()`

**Case type**: undocumented method inside `Illuminate\Http\Client\PendingRequest`. Unlike
`withNtlmAuth()`, there is no partially-documented section to place it next to - `laravel/docs`
has no section at all about saving a response body directly to disk. 

**Alias flag**: none - it
changes how the response body is materialized, not a rename of an existing call.

### Minimal snippet

`sink()` accepts either a file path or an already-open stream resource:

```php
Http::sink($path)->get($url);
Http::sink($resource)->get($url);
```

### Documented way vs. discovered way

The documented way to save a response is to fetch the full body in memory first, then write it
out:

```php
$response = Http::get($url);
Storage::disk('local')->put('invoice.pdf', $response->body());
```

`sink()` does both in the same call, and - this is worth stating plainly, since its name and its
internal reuse inside the stub-testing machinery both suggest a testing helper - it is not one:
it is a real Guzzle transport option, applied by the actual cURL and stream handlers on genuine,
unfaked requests, exactly the kind of thing worth reaching for when the response is a file too
large to comfortably hold in memory twice (once as the HTTP response body, once as the file
being written):

```php
Http::sink($path)->get($url);
```

### Real scenario: downloading the legacy invoice to disk

`LegacyInvoiceClient` gained a second method for this entry, `downloadForOrder()`, sharing the
same authenticated request as `forOrder()` through a small private helper:

```php
class LegacyInvoiceClient
{
    public function forOrder(Order $order): Response
    {
        return $this->request()->get("/invoices/{$order->uuid}");
    }

    public function downloadForOrder(Order $order, mixed $destination): Response
    {
        return $this->request()->sink($destination)->get("/invoices/{$order->uuid}");
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl(config('legacy_invoicing.base_url'))
            ->withNtlmAuth(
                config('legacy_invoicing.username'),
                config('legacy_invoicing.password'),
            );
    }
}
```

`$destination` is passed straight through to `sink()`, so it accepts either form without any
extra handling on this class's part. Two tests confirm both work against a faked response - a
string path:

```php
it('streams the invoice directly to a file path via sink()', function () {
    $body = str_repeat('%PDF-1.4 fake invoice body ', 100);

    Http::fake(['legacy-invoicing.internal/*' => Http::response($body, 200)]);

    $order = Order::factory()->create();
    $path = tempnam(sys_get_temp_dir(), 'invoice-');

    (new LegacyInvoiceClient)->downloadForOrder($order, $path);

    expect(file_get_contents($path))->toBe($body);

    unlink($path);
});
```

and an already-open resource:

```php
it('streams the invoice to an open resource via sink()', function () {
    $body = str_repeat('%PDF-1.4 fake invoice body ', 100);

    Http::fake(['legacy-invoicing.internal/*' => Http::response($body, 200)]);

    $order = Order::factory()->create();
    $resource = fopen('php://temp', 'w+');

    (new LegacyInvoiceClient)->downloadForOrder($order, $resource);

    expect(stream_get_contents($resource))->toBe($body);

    fclose($resource);
});
```

Both tests fake the request with `Http::fake()`, which is worth pausing on: `sink()` is not
test-only, but it still works correctly under a fake. That is not an accident - `Http::fake()`
is itself built on the same stub mechanism this chapter covers as its own entry next
(`stub()`); the handler behind it honors the `sink` option exactly like a real request would,
writing the faked body to the destination given. The next section explains that mechanism
directly.

A third test puts the comparison from earlier side by side, on the same faked response, and
checks both approaches end up with identical bytes on disk:

```php
it('writes the same bytes as the documented in-memory download, one call instead of two', function () {
    $body = str_repeat('%PDF-1.4 fake invoice body ', 100);

    // A closure fake, not a pre-built Http::response(), because this test sends two requests
    // against the same faked URL: Http::fake() otherwise reuses the exact same PSR-7 stream for
    // every match, and the second request would read it already exhausted by the first.
    Http::fake(['legacy-invoicing.internal/*' => fn () => Http::response($body, 200)]);

    $order = Order::factory()->create();

    // Documented way: fetch the full body in memory, then write it out.
    $response = (new LegacyInvoiceClient)->forOrder($order);
    Storage::disk('local')->put("invoices/{$order->uuid}-manual.pdf", $response->body());

    // Discovered way: sink() streams straight to disk in the same call that sends the request.
    $sinkPath = tempnam(sys_get_temp_dir(), 'invoice-');
    (new LegacyInvoiceClient)->downloadForOrder($order, $sinkPath);

    expect(file_get_contents($sinkPath))
        ->toBe(Storage::disk('local')->get("invoices/{$order->uuid}-manual.pdf"));

    unlink($sinkPath);
    Storage::disk('local')->delete("invoices/{$order->uuid}-manual.pdf");
});
```

The closure in that last fake is not incidental: `Http::fake()` builds the faked response once
and reuses the same underlying stream for every request that matches the URL pattern, so a test
that sends two requests against the same fake - as this one deliberately does, to compare both
approaches on equal footing - needs a fresh response per request, not a single shared one
already exhausted by the first read.

## `stub()`

**Case type**: undocumented method inside `Illuminate\Http\Client\PendingRequest`'s "Testing"
area, which is otherwise well documented - `Http::fake()`, `Http::fakeSequence()`, and
`preventStrayRequests()`/`allowStrayRequests()` all have their own place in `laravel/docs`.
`stub()` is never named there. 

**Alias flag**: none - it solves a narrower problem than
`Http::fake()`, not a rename of it.

### Minimal snippet

```php
Http::stub(fn ($request) => Http::response('pong', 200))->get($url);
```

### Documented way vs. discovered way

`Http::fake()` is the documented way to fake HTTP calls in a test, and it works by storing its
fakes on the `Factory` behind the `Http` facade - every `PendingRequest` the Factory builds
afterward, anywhere in the application, picks them up automatically. That reach is exactly what
makes it able to transparently intercept a call built deep inside a class like
`LegacyInvoiceClient`:

```php
Http::fake(['legacy-invoicing.internal/invoices/*' => Http::response('%PDF-1.4 invoice', 200)]);
```

`stub()` works the opposite way: `PendingRequest::stub()` only ever sets a callback on the one
instance it is called on. There is no Factory-level equivalent of it - calling
`Http::stub(...)` builds one fresh `PendingRequest` and registers the callback on that instance
alone. It never reaches into a request some other class builds internally; it only covers a
chain you construct and call it on yourself:

```php
Http::baseUrl($baseUrl)->withNtlmAuth($username, $password)
    ->stub(fn ($request) => Http::response('pong', 200))
    ->get('/health');
```

### Real scenario: a one-off probe against the legacy invoicing host

A natural place `stub()` earns its keep: a single ad hoc request against the same host
`LegacyInvoiceClient` talks to - a manual connectivity probe, say - that needs its own response
without touching whatever global `Http::fake()` state the rest of the test already relies on for
`LegacyInvoiceClient`'s own traffic. The test builds the probe with the exact same
`baseUrl()`/`withNtlmAuth()` chain the client uses internally, and proves the two fakes do not
interfere with each other:

```php
it('stubs a single ad hoc probe without disturbing the rest of the test\'s global fake', function () {
    // Documented way: a global fake, covering LegacyInvoiceClient's normal traffic for the
    // whole test.
    Http::fake(['legacy-invoicing.internal/invoices/*' => Http::response('%PDF-1.4 normal invoice', 200)]);

    $order = Order::factory()->create();

    expect((new LegacyInvoiceClient)->forOrder($order)->body())->toBe('%PDF-1.4 normal invoice');

    // Discovered way: an ad hoc probe against the same host, built the same way
    // LegacyInvoiceClient builds its own request, stubbed on its own - stub() only ever covers
    // the exact chain it is called on, it cannot reach into a class's internal request the way
    // Http::fake() does.
    $probe = Http::baseUrl(config('legacy_invoicing.base_url'))
        ->withNtlmAuth(config('legacy_invoicing.username'), config('legacy_invoicing.password'))
        ->stub(fn ($request) => Http::response('pong', 200))
        ->get('/health');

    expect($probe->body())->toBe('pong');

    // The global fake is still intact and undisturbed by the stub above.
    expect((new LegacyInvoiceClient)->forOrder($order)->body())->toBe('%PDF-1.4 normal invoice');
});
```

The last assertion is the point of the whole test: after the ad hoc probe runs, the global fake
is still exactly as it was, and `LegacyInvoiceClient` still gets the invoice body it was faked
with. Nothing about registering a stub on the probe's own chain touched the Factory's fakes.

`stub()` also interacts with the documented `preventStrayRequests()`/`allowStrayRequests()`
pair in a way worth knowing before it surprises anyone: if the stub callback does not intercept
a request (returns `null`) and stray requests are being prevented, the request still throws
`Illuminate\Http\Client\StrayRequestException`, exactly as an entirely unfaked request would:

```php
it('throws StrayRequestException when a stub does not intercept and stray requests are prevented', function () {
    Http::preventStrayRequests();

    $probe = Http::baseUrl(config('legacy_invoicing.base_url'))
        ->withNtlmAuth(config('legacy_invoicing.username'), config('legacy_invoicing.password'))
        ->stub(fn ($request) => null);

    expect(fn () => $probe->get('/health'))->toThrow(StrayRequestException::class);
});
```

A stub that declines to answer is not the same as no stub at all - it still falls through to
whatever stray-request policy is in effect.

## `dontTruncateExceptions()`

**Case type**: undocumented method inside `Illuminate\Http\Client\PendingRequest`'s "Error
Handling" area, which is otherwise well documented - `throw()` and its variants, the default
120-character truncation of `RequestException` messages, `truncateExceptionsAt()`, and the
global static pair `RequestException::truncateAt()`/`RequestException::dontTruncate()` all have
their own place in `laravel/docs`. `dontTruncateExceptions()` is the one method in that same
area never named there. 

**Alias flag**: none - it is a real sibling with genuinely different
behavior from `truncateExceptionsAt()`, not a rename of it, for reasons the real scenario below
makes concrete.

Truncation of a failed request's exception message is controlled at three levels, only the
innermost of which is this entry:

- A built-in default of 120 characters (`RequestException::$truncateAt`).
- A global override, meant for `bootstrap/app.php`: `RequestException::truncateAt($length)` /
  `RequestException::dontTruncate()` - both documented.
- A per-request override on the call itself: `Http::truncateExceptionsAt($length)` (documented)
  and `Http::dontTruncateExceptions()` (not documented).

### Minimal snippet

```php
Http::dontTruncateExceptions()->get($url)->throw();
```

### Documented way vs. discovered way

`laravel/docs` documents the per-request override for shortening the message:

```php
Http::truncateExceptionsAt(240)->post(/* ... */);
```

`dontTruncateExceptions()` sits right next to it, undocumented, and is not simply "no length
limit" on the same kind of summary. Reading `RequestException::prepareMessage()` directly shows
the two paths produce structurally different messages, not just different lengths: the
truncated path (default or `truncateExceptionsAt()`) calls Guzzle's
`Message::bodySummary($response, $length)` - the first `$length` characters of the **response
body only**, with a literal `(truncated...)` suffix appended when the body is longer than that.
`dontTruncateExceptions()` instead calls `Message::toString($response)` - the **entire raw HTTP
response**, status line and headers included, not merely an untruncated body. Reaching for
`dontTruncateExceptions()` expecting "the same summary, just longer" would be a reasonable guess
from the name alone, and it would be wrong.

Headers included is worth pausing on before using this in production. This chapter's own
example authenticates with `withNtlmAuth()`, which never puts credentials in a header - so
nothing sensitive leaks into the example below. That is not true of the two documented schemes
this chapter compared it against earlier: Basic auth sends `Authorization: Basic
<base64-encoded-credentials>` on every request, and a Bearer token sends `Authorization: Bearer
<token>` the same way. Call `dontTruncateExceptions()` on a request authenticated either of those
ways, and a failure sends that header straight into the exception message - and from there,
straight into whatever logs the application writes exceptions to. Reach for it deliberately, not
as a default, on any request carrying credentials in a header.

### Real scenario: diagnosing a failed legacy invoice request

`LegacyInvoiceClient` gained a third method for this entry, raising clearly instead of silently
returning an error response when the legacy invoicing service fails:

```php
public function forOrderOrFail(Order $order): Response
{
    return $this->request()->get("/invoices/{$order->uuid}")->throw();
}
```

Called as-is, with no truncation method involved, it hits the default: a 500 response with a
long diagnostic body gets summarized to its first 120 characters:

```php
it('truncates the exception message to 120 characters by default', function () use ($diagnosticBody) {
    Http::fake(['legacy-invoicing.internal/*' => Http::response($diagnosticBody, 500)]);

    $order = Order::factory()->create();

    try {
        (new LegacyInvoiceClient)->forOrderOrFail($order);
        $this->fail('Expected a RequestException to be thrown.');
    } catch (RequestException $e) {
        expect($e->getMessage())
            ->toContain(substr($diagnosticBody, 0, 120).' (truncated...)')
            ->not->toContain($diagnosticBody);
    }
});
```

Reaching for `dontTruncateExceptions()` on the same call shape confirms the distinction from
above directly: the message contains the full body, but also the response's status line - not
just a longer summary:

```php
it('includes the full raw response via dontTruncateExceptions(), not just an untruncated body', function () use ($diagnosticBody) {
    Http::fake(['legacy-invoicing.internal/*' => Http::response($diagnosticBody, 500)]);

    $order = Order::factory()->create();

    try {
        Http::baseUrl(config('legacy_invoicing.base_url'))
            ->withNtlmAuth(config('legacy_invoicing.username'), config('legacy_invoicing.password'))
            ->dontTruncateExceptions()
            ->get("/invoices/{$order->uuid}")
            ->throw();
        $this->fail('Expected a RequestException to be thrown.');
    } catch (RequestException $e) {
        // Not just an untruncated body: dontTruncateExceptions() switches to the entire raw
        // HTTP response (status line and headers included), not merely a longer body summary.
        expect($e->getMessage())
            ->toContain('HTTP/1.1 500')
            ->toContain($diagnosticBody)
            ->not->toContain('(truncated...)');
    }
});
```

And the documented sibling, `truncateExceptionsAt()`, on the same call shape, confirms it stays
on the body-summary path, just with a different cutoff:

```php
it('truncates to a custom length via the documented truncateExceptionsAt()', function () use ($diagnosticBody) {
    Http::fake(['legacy-invoicing.internal/*' => Http::response($diagnosticBody, 500)]);

    $order = Order::factory()->create();

    try {
        Http::baseUrl(config('legacy_invoicing.base_url'))
            ->withNtlmAuth(config('legacy_invoicing.username'), config('legacy_invoicing.password'))
            ->truncateExceptionsAt(240)
            ->get("/invoices/{$order->uuid}")
            ->throw();
        $this->fail('Expected a RequestException to be thrown.');
    } catch (RequestException $e) {
        expect($e->getMessage())
            ->toContain(substr($diagnosticBody, 0, 240).' (truncated...)')
            ->not->toContain($diagnosticBody);
    }
});
```

Which of the three levels to reach for depends on where the noise actually is: the global
`bootstrap/app.php` override when every request in the application needs the same policy, the
per-request `truncateExceptionsAt()` when only this one call needs a longer summary, and
`dontTruncateExceptions()` specifically when the summary itself is not enough - when the detail
that explains a failure lives in a header or in a part of the body past whatever length was
already configured.

## Summary

| Entry | Documented alternative | When to prefer it |
|---|---|---|
| `withNtlmAuth()` | `withBasicAuth()` / `withDigestAuth()` | Only when the service truly requires NTLM - verify Guzzle/libcurl support first |
| `sink()` | Fetch the full body, then `Storage::put()` / `file_put_contents()` | Downloading a response too large to comfortably hold in memory twice |
| `stub()` | `Http::fake()` (global) | Faking one ad hoc request built directly in test code, without touching global fake state used elsewhere |
| `dontTruncateExceptions()` | `truncateExceptionsAt($n)` / the 120-character default | The truncated summary itself hides the detail - it's in a header, or past whatever length is configured |

None of these four replace their documented counterpart outright. `sink()` is the wrong choice
the moment the body needs to be reprocessed in memory right away rather than just persisted -
fetching it normally is simpler when that is the goal. `stub()` is the wrong choice whenever
`Http::fake()` already covers the need: it reaches inside a class's own HTTP calls in a way
`stub()` cannot, and reaching for `stub()` anyway just to fake a single instance adds complexity
without buying anything back.

Chapter 6 opened Part III (HTTP, APIs, and Testing) from the request side: authenticating,
streaming, faking, and diagnosing failures. Chapter 7 stays in the same Part and turns to the
response side - asserting what comes back from a test, whether or not it started as an HTTP
response at all.
