# Laravel 13: The Unwritten API

<p align="center">
  <img src="assets/hero-banner.webp" alt="An unfolding layer reveals hidden code underneath, illustrating the book's theme of undocumented Laravel APIs" width="800">
</p>

An open-source book about the public, realistically usable, but undocumented parts of
Laravel: methods and classes that exist, work, and are worth knowing, yet appear nowhere in
the official documentation.

See `CLAUDE.md` for the full operating guide (structure, writing conventions, per-chapter
workflow, progress status). The book's planning/spec layer (audience, format, selection
criteria, per-chapter outlines and writing prompts) is kept locally by the maintainer and is
not part of this published repo.

## Structure

```
.
├── CLAUDE.md                  # operating guide for writing this book
├── chapters/
│   └── chapter-N/chapter-N-text.md   # the book's prose (English, primary and only edition for now)
├── site/                       # Docusaurus site (GitHub Pages), synced from chapters/
├── metadata.yaml               # editorial metadata (Pandoc)
├── template.tex                # shared LaTeX template
├── build-book.sh                # concatenates chapters/chapter-N into book.md
├── to_pdf.sh                    # book.md -> book.pdf (pandoc + xelatex)
└── to_epub.sh                   # book.md -> book.epub (pandoc)
```

Chapters are numbered `chapter-0` (motivation and methodology) through `chapter-18` (the last
numbered chapter), grouped into 8 named Parts, followed by `chapter-19` (the closing
Conclusions chapter) and the appendices `chapter-A`, `chapter-B`. See `CLAUDE.md` section 1
for the full Part/chapter map.

## How to build the book

```bash
bash build-book.sh   # assembles chapters/chapter-*/chapter-*-text.md into book.md
bash to_pdf.sh        # compiles book.md into book.pdf
bash to_epub.sh       # compiles book.md into book.epub
```

`build-book.sh` reports on stderr any chapter/appendix still without a text file, without
interrupting generation.

## How to build the site

```bash
cd site
npm ci
npm run sync    # regenerates site/docs/ from ../chapters/
npm start        # local dev server
npm run build    # static production build
```

## Prerequisites

- [Pandoc](https://pandoc.org/) with the `xelatex` engine (a TeX Live/MacTeX distribution
  with `fontspec`/`polyglossia`)
- Node.js (for the Mermaid filter used by `to_pdf.sh`/`to_epub.sh`, and for `site/`)
- PHP and Composer (for the companion application in `code/`)

## License

The book's text (`chapters/`) is licensed under CC BY-SA 4.0 (see `LICENSE`). All
code, including inline snippets, is licensed under the MIT License (see `LICENSE-CODE` and
`code/LICENSE`). See `CONTRIBUTING.md` for how to propose a new entry.
