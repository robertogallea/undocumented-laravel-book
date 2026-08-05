# Motivation and Methodology

This book is for a developer who already runs Laravel in production, who already knows how to
route a request, migrate a table, and queue a job, and who wants something past that: a working
knowledge of the framework itself, not just of how to use it. It will not make anyone ship
faster. That was never the promise, and it will not become one three chapters from now. What it
offers instead is a better mental model of a tool already used every day, one built by reading
the framework's own source rather than only its documentation.

It follows that this is not a book for a few kinds of readers it might be mistaken for. It is
not an introduction to Laravel: readers here are assumed to already know what a service provider
does, not to be meeting one for the first time. It is not a general PHP book: language features
get no dedicated treatment, only the parts of the framework built on top of them. And it makes no
promise of productivity, in the sense that phrase usually carries: no shortcuts, no fewer
keystrokes, no faster time to ship. Anyone hoping for that kind of book should look elsewhere;
this one asks for the opposite trade, more time spent understanding in exchange for less time
spent guessing later.

The image that best describes what follows is an ordinary one. Someone who drives the same car
every day eventually opens the hood, not because the engine has failed, but because knowing what
sits under it changes the relationship with the car itself: a strange noise stops being
mysterious, a warning light stops being a guess. Laravel is the car most of the readers of this
book already drive daily, confidently, without complaint. This book is the hood being opened.

This kind of curiosity rarely stops at the hood. Once someone understands why an engine makes
the noise it does, the next question tends to be whether the noise could be fixed, tuned, or
made quieter, not just explained. The same happens with a framework: understanding why it
behaves a certain way is one step past using it, but it is not the last one. Past a certain
point, understanding well enough starts to feel less like observation and more like standing:
noticing a gap worth documenting, a rough edge worth smoothing, and being in a position to do
something about either instead of only noticing it.

This is also, plainly, why this book exists as an open project rather than a closed one written
once and left alone. It was not decided separately, as a marketing choice or a licensing
preference; it grew directly out of the same drive the book is about. A book that teaches
readers to look under the hood of a framework they did not build has little business insisting
its own hood stay welded shut. So this one does not: anyone who finds their own undocumented
corner worth explaining, in a later Laravel release or in a first-party package this book has
not yet reached, is meant to open a pull request, not just a private note.

The hood, once opened, does not close again on its own.

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

The method behind every chapter that follows this one works at two levels, and both start from
the same habit just described: source and docs open together, matching versions.

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
section. A handful will not, sitting in the class but nowhere on the page. Nothing about a match
or a mismatch here is worth stating outright yet; the point of walking through `Str` now is only
to show what the comparison itself looks like in practice, not to report what it happened to find.
That reporting is what the rest of this book actually does, chapter by chapter, starting with
`Str` itself in the very next one.

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

The hood opened at the start of this chapter does not get closed again simply by reaching the end
of it. It stays open for the rest of the book, and every chapter from here on is another turn of
the same wrench, applied to a different corner of the same engine, never a new hood altogether.

One more thing is worth saying plainly, for a reader who ends up treating this book as a shelf
reference to dip into rather than one read start to finish: the method opens here, in this
chapter, and it is Chapter 19, at the very end, that closes it, once every corner covered in
between has had its own say.

What is left, then, is simple enough to state directly. Take the method just laid out, its two
levels, its filters, and the fixed meaning now attached to a single word, and start applying it
somewhere real. Chapter 1 is where that begins in earnest, and there is no better way to test
whether any of this actually works than to watch it work.
