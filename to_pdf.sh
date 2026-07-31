#!/usr/bin/env bash
# Builds the PDF edition: book.md -> book.pdf
set -euo pipefail

export PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/node_modules/.bin:$PATH"
export MERMAID_FILTER_FORMAT=png

pandoc book.md -o book.pdf --pdf-engine=xelatex --template=template.tex --metadata-file=metadata.yaml --toc --highlight-style=tango --filter mermaid-filter --lua-filter=section-divider.lua
