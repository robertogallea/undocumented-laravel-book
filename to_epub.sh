#!/usr/bin/env bash
# Builds the EPUB edition: book.md -> book.epub
set -euo pipefail

export PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/node_modules/.bin:$PATH"
export MERMAID_FILTER_FORMAT=png

pandoc book.md -o book.epub --template=epub-template.xhtml --metadata-file=metadata.yaml --css=epub.css --toc --highlight-style=tango --filter mermaid-filter -t epub3
