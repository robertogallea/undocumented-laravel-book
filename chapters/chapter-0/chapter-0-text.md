# Motivation and Methodology

This book is for developers who run Laravel in production and want to understand the framework,
not only use it. It assumes they already know how to route a request, migrate a table, and queue
a job. The payoff is not speed. It is a better mental model, built by reading the framework's
source alongside its documentation.

Readers should already know what a service provider does. The book covers framework features
built on PHP, not the language itself. It trades a little more time spent understanding for less
time spent guessing later; it does not promise shortcuts, fewer keystrokes, or faster delivery.

People who use the same tool every day eventually look under the hood. Not because it has failed,
but because a strange noise or warning light means more once they know what is inside. Laravel is
that tool here.

Curiosity can lead to a useful fix or a missing explanation. That is why the book is open source.
If a reader finds an undocumented corner in a later Laravel release or a first-party package,
they can turn that finding into a pull request instead of leaving it as a private note.

Curiosity needs a starting point, and the wrong one wastes it. Every claim this book makes about
Laravel rests on two things opened side by side: a release tag of `laravel/framework`, the exact
version installed and running, and the matching branch of `laravel/docs`, the page that currently
describes it. For this book that pair is `v13.22.0` and the `13.x` branch, but the pairing matters
more than the specific numbers: whatever version a reader runs, the two need to be read together,
not separately.

They drift apart in both directions, and each direction produces a different mistake. Read only
an old changelog or a stale local copy of the docs, and a method the framework's maintainers
documented months ago still looks like a discovery, when it has already stopped being one. Read
only the source, skipping the docs branch that actually matches it, and a method genuinely covered
on some page gets treated as hidden simply because nobody checked. Both mistakes come from
comparing things that were never meant to be compared: a tag from one moment against a branch from
another.

So the habit worth building here is narrow but exact: before deciding anything is undocumented,
open the tagged source and the matching docs branch at the same time, not from memory of either
one, and not from whatever version a search engine happens to surface first.

The method used in every later chapter works at two levels. Both begin with the same habit:
keeping the source and documentation open together at matching versions.

The first level looks inside a class the documentation already covers. Take a class like `Str`,
`Collection`, or `Gate`, each with its own dedicated page. Open the class itself and list every
public method it exposes, not the handful that happen to come to mind from daily use. Then open
its documentation page and do the same: list every method that page actually names. What is left
once the two lists are placed side by side, the methods present in the class but absent from the
page, is the raw material this book is built from. Most of what turns up this way is minor, and
some of it is not worth a reader's time at all; the filtering that separates one from the other
comes later. But the list itself only exists once both sides have actually been read in full, not
skimmed for what already feels familiar.

The second level is coarser, because there is no page to compare against in the first place. Some
classes never had one. Here the starting point is not a documentation page but a framework
component's own directory: its "root" classes, the ones sitting directly under
`Illuminate/<Component>`, rather than nested inside a driver subdirectory. For each of those class
names, the question is simply whether it appears anywhere at all in the documentation, on any
page, not only on the one page a reader might expect to cover it. Most of what this second pass
turns up is not meant for an application developer regardless of the docs gap: internal drivers
instantiated only by the framework itself, `*ServiceProvider` classes that exist purely to wire
other things together, `*Exception` classes, thin interface implementations, storage-layer
plumbing swapped out by configuration rather than called directly. None of that is a finding; it
is noise to filter out before what remains gets a second look.

Applied to `Str` specifically, the first level looks like this in practice: open the class file,
read down its list of public methods one at a time, and hold that list next to the documentation
page's own table of contents. Most entries match immediately, one name accounted for by one
section. A handful will not, sitting in the class but nowhere on the page. A match or mismatch
alone does not yet merit a conclusion. The `Str` walkthrough shows how to make the comparison,
not what it finds. The remaining chapters report those findings, starting with `Str` in the next
chapter.

None of this needs specialized tooling. Grep across a class file, a side-by-side diff of two plain
method-name lists, the project's own changelog, and the history of its merged pull requests are
enough to run either level by hand. This is, concretely, what opening the hood looks like once the
engine in question is a Laravel class instead of a car: not a single glance under the cover, but
the same class and the same page, read all the way through, side by side.

Finding a mismatch between a class and its documentation page is only the start; not every
mismatch is worth a reader's time. A name is often the first clue about which side of that line a
method falls on. Something named along the lines of `assembleInternalState()` or
`registerDriverHook()` reads as internal on sight, no matter how public its visibility happens to
be: a name built for the framework's own convenience, not for an application to call. The same
caution applies to visibility itself. A method is sometimes `public` only because an interface or
an abstract parent class demands it, not because anyone intended an application to call it
directly; that kind of publicness is an implementation detail leaking through, not an invitation.

A class's own test suite is a better witness than its name alone. Tests have to stay accurate for
the build to keep passing, which doc comments do not, so a method exercised deliberately, with
realistic input and a meaningful assertion, is being treated as behavior worth protecting, not as
an accident of visibility. A method never touched by a single test, on the other hand, is a method
the framework's own authors may not be relying on either.

The last check is the project's own history: its changelog, and the pull request that introduced
the method in question. That conversation, when one exists, usually says outright whether an
omission from the docs was a plain oversight, a deliberate choice made for reasons worth
understanding before recommending the method to anyone, or simply too recent to have reached a
docs page yet.

None of this reduces to a formula applied the same way every time. Two of these signals can point
in different directions, and the decision that follows still comes down to judgment, exercised
case by case rather than resolved once and for all here.

Every check described so far still leaves room to be wrong, and it is worth admitting that
plainly rather than letting a reader discover it on their own. A candidate that clears every
filter above, an unusual name aside, real visibility, a test suite exercising it, a changelog with
nothing suspicious, can still turn out to be something other than what it looked like: internal
plumbing left public for a reason specific to how the framework wires itself together, or a piece
of behavior the maintainers know about and have deliberately kept off the docs page because it is
not yet settled inside the framework itself. Neither of those is a mistake in the method as such;
both are simply what happens when a search this manual runs into a case its own checklist cannot
fully resolve. Treat any given candidate as provisional until it has actually been read end to
end, not as confirmed the moment it survives the first pass.

One word carries the weight of this entire book, and it deserves a fixed meaning rather than a
loose one. From here on, "undocumented" means exactly one thing: the method or class name in
question does not appear on its relevant documentation page, checked against the matching branch
described earlier, by that exact name. It does not mean thinly explained, mentioned once without
an example, or covered only in passing on a page about something else; any of those would already
count as documented, however imperfectly, and imperfect coverage is a different problem than no
coverage at all. Holding the word to that narrow sense is what keeps every chapter after this one
honest about what it actually found.

Everything this chapter has argued for narrows down, in the end, to three rules, stated once here
so that every chapter after this one can simply apply them, without restating or varying them
along the way:

- Public and realistically usable by an application, not internal plumbing that only happens to
  be reachable.
- Genuinely absent from the official documentation, checked by its exact method or class name
  against the matching branch, not merely under-explored by general topic.
- Not a trivial alias of something already documented, unless the book says outright that it is
  one and explains why that is still worth knowing.

The rest of the book applies this method to different parts of Laravel.

Readers using this as a reference rather than reading it straight through should keep the method
in view. It begins here and returns in Chapter 19.

The next step is simple. Apply the two-level method, its filters, and the fixed meaning of
"undocumented" to a real class. Chapter 1 begins with `Str`.
