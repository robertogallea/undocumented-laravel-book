# Chapter 17 - Configuration and cookies at runtime

Chapter 16 closed Part VII (Observing and Communicating) with two facades that reach past their
better-known surface: `Mail`, sending outside the Mailable-based flow, and `Lang`, resolving
locales beyond the standard fallback chain. Chapter 17 opens Part VIII (Application
Infrastructure) with the same idea applied to two more facades every Laravel application already
depends on: `Config`, read and written far more often than its full public surface suggests, and
`Cookie`, whose queue of outgoing values turns out to be inspectable and reversible, not just
write-only. The chapter starts with `Config`.

## `Config::getMany()`

**Case type**: an undocumented method on `Illuminate\Config\Repository` (and the `Config`
facade), sitting beside the documented single-key `config()`/`Config::get()`/`Config::set()` that
`configuration.md` covers. **Alias flag**: not a new, competing method - it is the actual
mechanism the documented `Config::get()` already delegates to whenever it receives an array of
keys; calling `getMany()` directly is about explicitness of intent at the call site, not new
capability. **Audience**: application developers, no shift toward package authors. **Stability**:
core `Config` component, no churn found verifying against v13.22.0.

### Minimal snippet

```php
Config::getMany([
    'shipping.default' => null,
    'shipping.accounts.default' => null,
]);
// ['shipping.default' => 'flat', 'shipping.accounts.default' => 'ups']
```

`Illuminate\Config\Repository::getMany()` accepts either form for each entry: a bare,
integer-indexed key with no default, or a `key => default` pair -

```php
public function getMany($keys)
{
    $config = [];

    foreach ($keys as $key => $default) {
        if (is_numeric($key)) {
            [$key, $default] = [$default, null];
        }

        $config[$key] = Arr::get($this->items, $key, $default);
    }

    return $config;
}
```

- and every lookup goes through `Arr::get()`, so a missing key never throws, it just falls back
to whatever default that key was given.

### Documented way vs. discovered way

`Config::get()` (the same class, and what `config()` calls internally for a single key) already
handles an array argument by delegating straight to `getMany()`:

```php
public function get($key, $default = null)
{
    if (is_array($key)) {
        return $this->getMany($key);
    }

    return Arr::get($this->items, $key, $default);
}
```

So `Config::get(['shipping.default' => null, 'shipping.accounts.default' => null])` is a
genuinely documented way to reach the same result - the honest comparison here is not "no
equivalent exists", it is "the same call, made explicitly instead of through an overload nobody
reads the source to discover." Next to it, the ordinary approach most code actually reaches for
is three separate single-key calls:

```php
config('shipping.default');
config('shipping.accounts.default');
config('shipping.accounts.instances.ups.driver');
```

One thing this comparison has to rule out explicitly: the global `config()` helper's own array
form is not a shorthand for either of the above. Passing an array to `config()` does not read
anything at all -

```php
function config($key = null, $default = null)
{
    if (is_null($key)) {
        return app('config');
    }

    if (is_array($key)) {
        return app('config')->set($key);
    }

    return app('config')->get($key, $default);
}
```

- it sets every key in the array to the paired value. This is not a hypothetical trap: this same
codebase already relies on exactly that behavior in a Chapter 16 test
(`config(['services.fulfillment.alert_address' => 'ops@example.test'])`, to seed a value before
asserting on it), and reaching for the same syntax expecting it to *read* several keys at once
would silently overwrite them instead.

### Real scenario: a shipping-configuration diagnostics summary

`config/shipping.php` already holds several related settings read individually across the
codebase - the active rate driver, the default carrier account, and each account's own driver.
`App\Support\ShippingDiagnostics` gathers three of them in one call:

```php
class ShippingDiagnostics
{
    public function summary(): array
    {
        $defaultAccount = config('shipping.accounts.default');

        return Config::getMany([
            'shipping.default' => null,
            'shipping.accounts.default' => null,
            "shipping.accounts.instances.{$defaultAccount}.driver" => null,
        ]);
    }
}
```

The third key cannot be a static literal: its dotted path embeds the second key's own resolved
value, so `$defaultAccount` is read first, with a plain single-key `config()` call, before the one
`getMany()` call that produces the actual summary. Two tests confirm the behavior from both
sides. The first proves the call does real multi-key work against the account currently
configured as default:

```php
$summary = (new ShippingDiagnostics)->summary();

expect($summary)->toBe([
    'shipping.default' => 'flat',
    'shipping.accounts.default' => 'ups',
    'shipping.accounts.instances.ups.driver' => 'ups',
]);
```

The second isolates `getMany()`'s per-key default against `dhl`, a carrier that does not exist
anywhere under `shipping.accounts.instances` - not a missing leaf, a missing branch entirely -
confirming the fallback holds even then:

```php
$values = Config::getMany([
    'shipping.default' => null,
    'shipping.accounts.default' => null,
    'shipping.accounts.instances.ups.driver' => null,
    'shipping.accounts.instances.dhl.driver' => null,
]);

expect($values)->toBe([
    'shipping.default' => 'flat',
    'shipping.accounts.default' => 'ups',
    'shipping.accounts.instances.ups.driver' => 'ups',
    'shipping.accounts.instances.dhl.driver' => null,
]);
```
