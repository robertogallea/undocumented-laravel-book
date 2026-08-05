# Chapter 14 - Reusable behaviors for custom commands

Chapter 13 opened Part VI - Artisan Commands around a single command, `stock:import`, styled
end to end with Laravel's component-based output system. Chapter 14 stays inside the same Part
and closes it, before Chapter 15 opens Part VII - Observing and Communicating. The running
command here, `stock:prune-movements`, deletes old stock movement rows past a configurable age
threshold - a different command, on a different concern, from Chapter 13's `stock:import` and
from Chapter 3's `StockImportPipeline`: no shared pipeline, no shared lock, no shared table
beyond `stock_movements` itself. Four cross-cutting behaviors are layered onto it one at a time,
in order of how forcefully each one stops the command from running: `Prohibitable`, forbidding
it outright in a given environment; `ConfirmableTrait`, asking for confirmation instead of
forbidding; `CommandMutex`/`CacheCommandMutex`, preventing two manual runs from overlapping; and
`ContainerCommandLoader`, a registration-level concern, unrelated to any of the first three,
closing the chapter. The command's own output keeps using
`$this->components->task()`/`success()`/`error()`, the same system Chapter 13 introduced, not a
new entry here. Every example is verified against `laravel/framework` v13.22.0 and the
`laravel/docs` `13.x` branch, and is a real, green Pest test drawn from this book's companion
application.

## `Prohibitable`

**Case type**: an undocumented trait, `Illuminate\Console\Prohibitable`, applied to an otherwise
fully-documented base class, `Illuminate\Console\Command`. The official Artisan documentation's
only related concept is `Isolatable`, which is documented - but `Isolatable` is about
concurrency (Chapter 14's own `CommandMutex`/`CacheCommandMutex` entry, later in this chapter),
not about forbidding a command from running at all in a given environment. `Prohibitable`,
`Command::prohibit()`, and `isProhibited()` do not appear anywhere in `artisan.md`.

**Alias flag**: not a trivial alias of anything documented - see the comparison below for what
it adds over a hand-written check. 

**Audience**: ordinary application developers, not package
authors - reaching it requires nothing beyond adding the trait to a command already living in
the application. 

**Stability**: core framework code, no minor-version churn found while
verifying against v13.22.0.

### Minimal snippet

```php
use Illuminate\Console\Command;
use Illuminate\Console\Prohibitable;

class SomeCommand extends Command
{
    use Prohibitable;

    public function handle(): int
    {
        if ($this->isProhibited()) {
            return self::FAILURE;
        }

        // ...
    }
}

// Anywhere at boot time, independent of any specific invocation:
SomeCommand::prohibit(true);
```

`isProhibited()` already prints its own warning when the command is prohibited
("This command is prohibited from running in this environment.") and not called with
`$quiet = true`, so `handle()` only needs to act on the returned boolean, not print anything
itself. There is no `--force` interaction anywhere in `Prohibitable`: once prohibited, a command
stays prohibited, with no flag to bypass it.

### Documented way vs. discovered way

Nothing in the official docs covers forbidding a command outright, so the natural baseline is a
hand-written check at the top of `handle()`:

```php
public function handle(): int
{
    if ($this->laravel->isProduction()) {
        $this->components->error('This command cannot run in production.');

        return self::FAILURE;
    }

    // ...
}
```

This works, but the decision lives inside the command itself, re-read and re-evaluated on every
single invocation, from every call site that ever reaches it. `Prohibitable` moves the same
decision to a single static toggle, set once, wherever the application decides it, independent
of how or when the command is later invoked:

```php
StockPruneMovementsCommand::prohibit($this->app->isProduction());
```

A command's own `handle()` only ever asks "am I currently prohibited?" - it does not know or
care why, or where that was decided. A future maintainer adding a second, related guard right
next to a hand-written environment check has nowhere obvious to add it without duplicating the
same `if ($this->laravel->isProduction())` condition a second time; with `Prohibitable`, the
same `boot()` method that sets this toggle is exactly where a second, independent toggle would
also live.

### Real scenario: forbidding stock pruning in production

`StockPruneMovementsCommand` checks `isProhibited()` as the very first thing `handle()` does,
before even validating `--days`:

```php
class StockPruneMovementsCommand extends Command
{
    use Prohibitable;

    protected $signature = 'stock:prune-movements {--days=90}';

    protected $description = 'Delete stock movements older than a given number of days';

    public function handle(): int
    {
        if ($this->isProhibited()) {
            return self::FAILURE;
        }

        $daysOption = $this->option('days');

        if (! is_numeric($daysOption) || (int) $daysOption <= 0) {
            $this->components->error('The --days option must be a positive integer.');

            return self::FAILURE;
        }

        $days = (int) $daysOption;
        $deleted = 0;

        $this->components->task("Pruning stock movements older than {$days} day(s)", function () use ($days, &$deleted) {
            $deleted = StockMovement::where('created_at', '<', now()->subDays($days))->delete();
        });

        $this->components->success("Pruned {$deleted} stock movement(s).");

        return self::SUCCESS;
    }
}
```

The toggle itself is set once, in `AppServiceProvider::boot()`, tied to the real application
environment rather than to any particular way of invoking the command:

```php
public function boot(): void
{
    // Decided once at boot, not inside the command's own handle(): a future ConfirmableTrait
    // check added next to this one must not tempt anyone into moving this back into handle(),
    // which would silently reintroduce a per-invocation check instead of a single toggle.
    StockPruneMovementsCommand::prohibit($this->app->isProduction());

    Gate::resource('project', ProjectPermissions::class);
    Gate::define('approve-project', [ProjectPermissions::class, 'approve']);
    Gate::define('regenerate-project-report', [ProjectPermissions::class, 'regenerateReport']);
}
```

Running `stock:prune-movements` in production now fails outright, with no `--force` able to
change that: the next entry in this chapter gives the command a `--force` option of its own, but
`Prohibitable` does not read it and never will - once prohibited, a command stays prohibited.
Outside production, the command behaves exactly as it did before this entry: nothing about its
everyday behavior changed, only what happens in the one environment where losing stock history
permanently is not an acceptable risk.

## `ConfirmableTrait`

**Case type**: another undocumented trait, `Illuminate\Console\ConfirmableTrait`, on the same
documented `Command` base class as `Prohibitable`. Unlike `Prohibitable`, though, the general
idea it implements is not new to this book: the official Artisan documentation already
describes exactly this behavior for `migrate`, under "Forcing Migrations To Run In Production" -
ask for confirmation before running in production, unless `--force` is passed. What is
undocumented is the reusable trait itself, and that its gated environment and warning message
are both configurable rather than hardcoded to `migrate`'s own case. 

**Alias flag**: not a
trivial alias - see the comparison below for what it adds over a hand-written check.

**Audience**: application developers, same as `Prohibitable`. 

**Stability**: core framework
code, long-lived and unchanged in shape across recent Laravel versions.

### Minimal snippet

```php
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;

class SomeCommand extends Command
{
    use ConfirmableTrait;

    protected $signature = 'some:command {--force}';

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        // ...
    }
}
```

Called with no arguments, `confirmToProceed()` only asks in production, with a fixed prompt
("Are you sure you want to run this command?") and a fixed decline message ("Command
cancelled."). The `$warning` argument only changes the alert line printed before that fixed
prompt, not the prompt's own wording - a detail worth stating plainly, since it looks at first
glance like it should customize the question itself. On decline, `confirmToProceed()` returns
`false` and prints the cancellation message itself, but it does not choose an exit code: turning
that `false` into `self::FAILURE` is left entirely to the calling command.

### Documented way vs. discovered way

The documented behavior (`migrate`'s own confirmation in production) has no reusable trait
behind it in the docs - a command wanting the same thing elsewhere has to write it by hand:

```php
if ($this->laravel->environment() === 'staging' && ! $this->option('force')) {
    if (! $this->confirm('Are you sure you want to run this command?')) {
        return self::FAILURE;
    }
}
```

This works, but every command that wants the same protection repeats the same `--force` check
by hand, and the environment being guarded is baked into the condition itself.
`confirmToProceed()` collapses both concerns into the trait: the `--force` short-circuit is
automatic and identical everywhere it is used, and the environment being gated is not hardcoded
to `production` at all - it is whatever the passed callback decides, which is exactly why this
chapter's command can gate `staging` with the same trait `migrate` uses to gate `production`,
with no forked logic:

```php
$this->confirmToProceed(
    'This command will permanently delete old stock movements.',
    fn () => $this->getLaravel()->environment() === 'staging'
);
```

### Real scenario: two independent guards on the same command

`StockPruneMovementsCommand` now carries both traits, stacked as two separate, independent
checks rather than folded into one condition:

```php
class StockPruneMovementsCommand extends Command
{
    use ConfirmableTrait, Prohibitable;

    protected $signature = 'stock:prune-movements {--days=90} {--force : Force the operation to run without confirmation}';

    protected $description = 'Delete stock movements older than a given number of days';

    public function handle(): int
    {
        if ($this->isProhibited()) {
            return self::FAILURE;
        }

        if (! $this->confirmToProceed(
            'This command will permanently delete old stock movements.',
            fn () => $this->getLaravel()->environment() === 'staging'
        )) {
            return self::FAILURE;
        }

        $daysOption = $this->option('days');

        if (! is_numeric($daysOption) || (int) $daysOption <= 0) {
            $this->components->error('The --days option must be a positive integer.');

            return self::FAILURE;
        }

        $days = (int) $daysOption;
        $deleted = 0;

        $this->components->task("Pruning stock movements older than {$days} day(s)", function () use ($days, &$deleted) {
            $deleted = StockMovement::where('created_at', '<', now()->subDays($days))->delete();
        });

        $this->components->success("Pruned {$deleted} stock movement(s).");

        return self::SUCCESS;
    }
}
```

The two guards do not just gate different environments; they are built differently, on purpose.
`Prohibitable`'s toggle was decided once, at boot, in `AppServiceProvider::boot()` - by the time
`handle()` runs, the decision has already been made, and nothing short of restarting the
application can change it. `ConfirmableTrait`'s callback, by contrast, reads the current
environment live, fresh, every single time `handle()` runs, and can be bypassed with `--force` -
a deliberately softer guard for a deliberately less absolute risk. Outside `staging` and
`production`, the command still behaves exactly as it did before either entry, at least with
respect to these two guards - the next entry adds a third guard that applies everywhere, in
every environment, for a different kind of risk entirely.

## `CommandMutex`/`CacheCommandMutex`

**Case type**: an undocumented pair, the interface `Illuminate\Console\CommandMutex` and its
concrete implementation `Illuminate\Console\CacheCommandMutex`, supporting an area the official
docs only partially cover: Artisan's "Isolatable Commands" section documents the `Isolatable`
interface and its `--isolated` option, but never names or explains the mutex primitive
`Isolatable` is built on internally. 

**Alias flag**: not an alias of `Isolatable` - it is the
lower-level primitive `Isolatable` itself calls (`Command::commandIsolationMutex()`), usable
directly and independently of that opt-in mechanism. 

**Audience**: application developers, same
as the previous two entries. 

**Stability**: core framework code, stable.

### Minimal snippet

```php
use Illuminate\Console\CacheCommandMutex;
use Illuminate\Console\Command;

class SomeCommand extends Command
{
    public function handle(CacheCommandMutex $mutex): int
    {
        if (! $mutex->create($this)) {
            return self::FAILURE;
        }

        try {
            // ...
        } finally {
            $mutex->forget($this);
        }
    }
}
```

The interface, `CommandMutex`, cannot be type-hinted here directly - unlike `Isolatable`, which
Laravel resolves through a conditional container check, nothing ever binds `CommandMutex::class`
to `CacheCommandMutex::class` on its own. The concrete class is the correct, and only, choice for
a command that wants this mutex without also adopting `Isolatable`.

### Documented way vs. discovered way

The documented way to prevent overlapping runs is the `Isolatable` interface together with the
`--isolated` option:

```php
use Illuminate\Contracts\Console\Isolatable;

class SomeCommand extends Command implements Isolatable
{
    // ...
}
```

```
php artisan some:command --isolated
```

This works, but the protection is opt-in per invocation: whoever runs the command has to
remember to pass `--isolated` every time, and a forgotten flag means no protection at all - not
acceptable for a guard that must always apply, regardless of who runs the command or how. A
second difference matters just as much: when `Isolatable`'s own built-in check finds another
instance already running, it prints `The [command:name] command is already running.` and, by
default, exits with `self::SUCCESS`, not a failure - a deliberate choice suited to *scheduled*
commands, where an overlap being skipped should not look like an error to whatever is watching
exit codes. `stock:prune-movements` is invoked manually, not scheduled, so silently reporting
success while deleting nothing would hide a real condition from whoever ran it; the mutex used
directly here returns `self::FAILURE` instead, reusing `Isolatable`'s own message text but not
its default exit code.

One further mix-up worth naming: the scheduler's `withoutOverlapping()` solves a different
problem entirely. It guards one *scheduled* run against its own next scheduled run, entirely
within `Illuminate\Console\Scheduling`, and does nothing at all for two ad hoc, manually-triggered
invocations of the same command - which is exactly this chapter's scenario.

### Real scenario: guarding stock pruning against overlapping manual runs

`StockPruneMovementsCommand` now carries all three guards, each independent of the others:

```php
class StockPruneMovementsCommand extends Command
{
    use ConfirmableTrait, Prohibitable;

    protected $signature = 'stock:prune-movements {--days=90} {--force : Force the operation to run without confirmation}';

    protected $description = 'Delete stock movements older than a given number of days';

    public function handle(CacheCommandMutex $mutex): int
    {
        if ($this->isProhibited()) {
            return self::FAILURE;
        }

        if (! $this->confirmToProceed(
            'This command will permanently delete old stock movements.',
            fn () => $this->getLaravel()->environment() === 'staging'
        )) {
            return self::FAILURE;
        }

        if (! $mutex->create($this)) {
            $this->components->warn(sprintf('The [%s] command is already running.', $this->getName()));

            return self::FAILURE;
        }

        try {
            $daysOption = $this->option('days');

            if (! is_numeric($daysOption) || (int) $daysOption <= 0) {
                $this->components->error('The --days option must be a positive integer.');

                return self::FAILURE;
            }

            $days = (int) $daysOption;
            $deleted = 0;

            $this->components->task("Pruning stock movements older than {$days} day(s)", function () use ($days, &$deleted) {
                $deleted = StockMovement::where('created_at', '<', now()->subDays($days))->delete();
            });

            $this->components->success("Pruned {$deleted} stock movement(s).");

            return self::SUCCESS;
        } finally {
            $mutex->forget($this);
        }
    }

    public function isolationLockExpiresAt(): CarbonInterval
    {
        return CarbonInterval::minutes(5);
    }
}
```

The `try`/`finally` matters as much as the guard itself: `CacheCommandMutex::create()` acquires
the lock and leaves it held, with nothing releasing it automatically, so every path out of the
guarded block, including the `--days` validation failure, must still reach `forget()`.
`isolationLockExpiresAt()` overrides the framework's own 1-hour default with a much shorter,
explicit five minutes: this command runs one bounded bulk deletion with no loops and no external
calls, so five minutes is generous headroom for a normal run while still letting a killed process
(a SIGKILL, an out-of-memory event, a host reboot) self-heal within minutes rather than locking
out the next legitimate run for an hour.

This mutex has nothing to do with `App\Support\StockImportPipeline`'s own
`Cache::lock('stock-import', 10)` from Chapter 3. That lock protects one import batch's business
logic, scoped to the pipeline itself, regardless of whether it was triggered from the HTTP
endpoint or from `stock:import`. The lock added here protects one Artisan invocation's lifetime,
scoped to this command alone. They share nothing but the same underlying cache-lock mechanism -
two distinct locks, at two distinct levels of the same application, that never interact.

## `ContainerCommandLoader`

**Case type**: entirely undocumented, on more than one level. `Illuminate\Console\
ContainerCommandLoader` itself never appears in `artisan.md` by name, and neither does the
mechanism that actually produces one in this chapter's own code: the official docs describe
registering commands through `withCommands()` in `bootstrap/app.php`, always eagerly. Nowhere do
they mention that a command class carrying Symfony's `#[AsCommand]` attribute, registered by
class name rather than by instance, changes how Laravel resolves it - which is exactly the
combination this entry relies on. 

**Alias flag**: not an alias of anything documented.

**Audience shift, stated explicitly**: this entry targets whoever assembles and registers a
bundle of commands - a package author, or an application maintainer with a growing set of
optional or rarely-invoked admin commands - not the everyday developer adding one command to
`app/Console/Commands`. 

**Stability**: core framework code, stable.

### Minimal snippet

```php
use Illuminate\Console\Command;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(name: 'some:command')]
class SomeCommand extends Command
{
    protected $signature = 'some:command';

    // ...
}
```

```php
use Illuminate\Support\Facades\Artisan;

Artisan::addCommands([
    SomeCommand::class,
]);
```

Nothing here constructs `ContainerCommandLoader` directly. Laravel's own `Kernel::getArtisan()`
already ends every Artisan boot with an unconditional `->setContainerCommandLoader()` call,
which builds one from whatever has accumulated in its internal command map - `#[AsCommand]` is
what decides whether a given class ends up in that map (resolved later, on demand) or gets
constructed immediately instead.

### Documented way vs. discovered way

The documented way to register a command is `withCommands()` in `bootstrap/app.php`, or the
classic `$commands` array on a `Console\Kernel` subclass it replaced - either way, every listed
command is constructed the moment Artisan boots, whether or not it is the one actually invoked:

```php
->withCommands([
    SomeCommand::class,
])
```

Adding `#[AsCommand(name: '...')]` to the command class and registering it by class name through
`Artisan::addCommands()` changes nothing about how the command is invoked or what it does - it
changes only when it gets constructed. `Illuminate\Console\Application::resolve()` checks for
that attribute before deciding how to register a command: with it present, the class name is
recorded in a lazy map instead of being passed to the container's `make()` immediately. The
practical difference grows with the bundle: an application with many optional, rarely-used
commands pays the construction cost of every one of them on every single Artisan invocation
under the eager approach, regardless of which one (if any) actually runs that time.

One gotcha worth naming: `resolve()` decides whether a class is lazy purely from the attribute,
via reflection, before the command is ever built - it has no way to check that `name` against
whatever `$signature` will later produce once the class is actually instantiated. Renaming a
command in its `$signature` string without updating the matching `#[AsCommand(name: ...)]`
leaves the two silently out of sync: the lazy map still answers to the old name, while the
command itself, once resolved, answers to the new one.

### Real scenario: registering the pruning command and a companion report, both lazily

Both commands carry the attribute and share one registration call, in
`AppServiceProvider::boot()`:

```php
#[AsCommand(name: 'stock:prune-movements')]
class StockPruneMovementsCommand extends Command
{
    use ConfirmableTrait, Prohibitable;

    protected $signature = 'stock:prune-movements {--days=90} {--force : Force the operation to run without confirmation}';

    // ...
}
```

```php
#[AsCommand(name: 'stock:report-summary')]
class StockReportSummaryCommand extends Command
{
    protected $signature = 'stock:report-summary';

    protected $description = 'Show a summary count of stock movements';

    public function handle(): int
    {
        $this->components->twoColumnDetail('Total stock movements', (string) StockMovement::count());

        return self::SUCCESS;
    }
}
```

```php
public function boot(): void
{
    // ...
    StockPruneMovementsCommand::prohibit($this->app->isProduction());

    Artisan::addCommands([
        StockPruneMovementsCommand::class,
        StockReportSummaryCommand::class,
    ]);

    // ...
}
```

Both commands live outside `app/Console/Commands`, in their own `App\Console\LazyCommands`
namespace - not because that placement is required by anything shown here (`Artisan::
addCommands()` works by class name regardless of where the class lives), but to keep them out of
Laravel's default directory scan, which would otherwise register them a second, eager way of its
own. Running `stock:report-summary` alone constructs only `StockReportSummaryCommand`;
`StockPruneMovementsCommand`, still unused, is never built. Running `stock:prune-movements`
constructs only that one instead, carrying all three guards from the previous three entries with
it, unaffected by anything in this one.

With this entry, Chapter 14's four behaviors are complete - all layered onto (or around) a
single command that started, back in the first step of this chapter, with none of them at all.

## Summary

| Entry | Documented alternative | When to prefer it |
|---|---|---|
| `Prohibitable` | A hand-written `if ($this->laravel->isProduction()) { ...; return self::FAILURE; }` check | The decision must be made once, centrally, and apply no matter how or when the command is invoked |
| `ConfirmableTrait` | `migrate`'s own documented production confirmation, or a hand-written `--force`/`confirm()` check | The gated environment or warning needs to vary per command, or `--force` handling must stay consistent without repeating it everywhere |
| `CommandMutex`/`CacheCommandMutex` | `Isolatable` + `--isolated` | The guard must always apply, not depend on the caller remembering a flag, and an overlap should read as a real failure, not a silent skip |
| `ContainerCommandLoader` | `withCommands()` / the classic `$commands` array | The bundle of optional or rarely-used commands is large enough that constructing all of them on every boot is a real, avoidable cost |

The documented alternative is not wrong, only narrower. A hardcoded environment check is fine
for a command only ever invoked from one place, with no second guard likely to join it later.
The default, argument-less `confirmToProceed()` is fine whenever `production` is genuinely the
only environment that needs gating. `Isolatable`/`--isolated` is fine when an opt-in flag is an
acceptable safeguard rather than a guarantee. Eager registration is fine while the number of
commands stays small enough that construction cost never becomes noticeable. Each entry in this
chapter earns its place only once one of those narrower conditions stops holding.

Part VI - Artisan Commands ends here, complete across Chapters 13-14: from the console's own
styled output layer to four cross-cutting behaviors any custom command can adopt regardless of
what it does. Part VII - Observing and Communicating opens next with Chapter 15, "Events and logs
beyond the standard flow", moving from how a command behaves to how the application's own
internal events and logs can be observed and controlled.
