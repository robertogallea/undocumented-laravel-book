#!/usr/bin/env bash
# Assembles chapters/chapter-{0..19,A,B}/chapter-{N}-text.md into book.md
# and reports any expected chapter/appendix that has no text file yet.
set -euo pipefail

OUT="book.md"
: > "$OUT"
missing=0

part_before_chapter() {
  case "$1" in
    1)  echo '# Part I - Code Fundamentals {.section-divider -}' ;;
    4)  echo '# Part II - Eloquent Beyond Basic Relationships {.section-divider -}' ;;
    6)  echo '# Part III - HTTP, APIs, and Testing {.section-divider -}' ;;
    8)  echo '# Part IV - Container and Routing {.section-divider -}' ;;
    10) echo '# Part V - Authorization, Validation, and Asynchrony {.section-divider -}' ;;
    13) echo '# Part VI - Artisan Commands {.section-divider -}' ;;
    15) echo '# Part VII - Observing and Communicating {.section-divider -}' ;;
    17) echo '# Part VIII - Application Infrastructure {.section-divider -}' ;;
  esac
}

for n in $(seq 0 19) A B; do
  f="chapters/chapter-${n}/chapter-${n}-text.md"
  heading="$(part_before_chapter "$n")"
  if [[ -n "$heading" ]]; then
    printf '%s\n\n' "$heading" >> "$OUT"
  fi
  if [[ -f "$f" ]]; then
    cat "$f" >> "$OUT"
    printf '\n\n' >> "$OUT"
  else
    echo "MISSING: chapter ${n} (expected: ${f})" >&2
    missing=$((missing + 1))
  fi
done

echo "Generated $OUT."
[[ "$missing" -gt 0 ]] && echo "Warning: ${missing} chapter(s) still without text." >&2

exit 0
