#!/usr/bin/env node
// Regenerates site/docs/ from ../chapters/. site/docs/ is generated and gitignored:
// never hand-edit it, chapters/chapter-N/chapter-N-text.md is the single source of truth.
//
// Tolerates missing chapter files exactly like build-book.sh does (this scaffold is
// expected to run with zero chapters written yet).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(__dirname, '..');
const CHAPTERS_ROOT = join(SITE_ROOT, '..', 'chapters');
const DOCS_OUT = join(SITE_ROOT, 'docs');

// Chapter number -> Part folder. Chapters not listed here (0, 19, A, B) get a top-level file.
const PART_BY_CHAPTER = {
  1: '01-part-i-code-fundamentals',
  2: '01-part-i-code-fundamentals',
  3: '01-part-i-code-fundamentals',
  4: '02-part-ii-eloquent-beyond-basic-relationships',
  5: '02-part-ii-eloquent-beyond-basic-relationships',
  6: '03-part-iii-http-apis-and-testing',
  7: '03-part-iii-http-apis-and-testing',
  8: '04-part-iv-container-and-routing',
  9: '04-part-iv-container-and-routing',
  10: '05-part-v-authorization-validation-and-asynchrony',
  11: '05-part-v-authorization-validation-and-asynchrony',
  12: '05-part-v-authorization-validation-and-asynchrony',
  13: '06-part-vi-artisan-commands',
  14: '06-part-vi-artisan-commands',
  15: '07-part-vii-observing-and-communicating',
  16: '07-part-vii-observing-and-communicating',
  17: '08-part-viii-application-infrastructure',
  18: '08-part-viii-application-infrastructure',
};

const PART_LABELS = {
  '01-part-i-code-fundamentals': 'Part I - Code Fundamentals',
  '02-part-ii-eloquent-beyond-basic-relationships': 'Part II - Eloquent Beyond Basic Relationships',
  '03-part-iii-http-apis-and-testing': 'Part III - HTTP, APIs, and Testing',
  '04-part-iv-container-and-routing': 'Part IV - Container and Routing',
  '05-part-v-authorization-validation-and-asynchrony': 'Part V - Authorization, Validation, and Asynchrony',
  '06-part-vi-artisan-commands': 'Part VI - Artisan Commands',
  '07-part-vii-observing-and-communicating': 'Part VII - Observing and Communicating',
  '08-part-viii-application-infrastructure': 'Part VIII - Application Infrastructure',
};

// Top-level position for standalone (non-Part) items, so they sort around the Parts.
const STANDALONE_POSITION = { 0: 0, 19: 90, A: 91, B: 92 };

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function ensurePartCategory(partDir, label, position) {
  const dir = join(DOCS_OUT, partDir);
  mkdirSync(dir, { recursive: true });
  const categoryFile = join(dir, '_category_.json');
  writeFileSync(
    categoryFile,
    JSON.stringify({ label, position, collapsible: true, collapsed: false }, null, 2) + '\n',
  );
}

function main() {
  rmSync(DOCS_OUT, { recursive: true, force: true });
  mkdirSync(DOCS_OUT, { recursive: true });

  const chapterIds = [...Array(19).keys()].map((n) => String(n + 1)).concat(['A', 'B']);
  chapterIds.unshift('0');

  let synced = 0;
  let missing = 0;

  for (const id of chapterIds) {
    const src = join(CHAPTERS_ROOT, `chapter-${id}`, `chapter-${id}-text.md`);
    if (!existsSync(src)) {
      console.error(`MISSING: chapter ${id} (expected: ${src})`);
      missing += 1;
      continue;
    }

    const raw = readFileSync(src, 'utf8');
    const title = extractTitle(raw, `Chapter ${id}`);
    const numericId = /^\d+$/.test(id) ? Number(id) : null;
    const partDir = numericId !== null ? PART_BY_CHAPTER[numericId] : undefined;

    let outDir = DOCS_OUT;
    let sidebarPosition = numericId ?? id;

    if (partDir) {
      ensurePartCategory(partDir, PART_LABELS[partDir], Number(partDir.slice(0, 2)));
      outDir = join(DOCS_OUT, partDir);
    } else {
      sidebarPosition = STANDALONE_POSITION[id];
    }

    mkdirSync(outDir, { recursive: true });

    const frontMatter = [
      '---',
      `id: chapter-${id}`,
      `title: "${title.replace(/"/g, '\\"')}"`,
      `sidebar_position: ${sidebarPosition}`,
      ...(id === '0' ? ['slug: /'] : []),
      '---',
      '',
    ].join('\n');

    writeFileSync(join(outDir, `chapter-${id}.md`), frontMatter + raw);
    synced += 1;
  }

  if (synced === 0) {
    // Docusaurus's docs plugin needs at least one document to build. This placeholder is
    // itself generated (not hand-edited) and disappears the moment any real chapter exists.
    writeFileSync(
      join(DOCS_OUT, 'chapter-0.md'),
      [
        '---',
        'id: chapter-0',
        'title: "Laravel 13: The Unwritten API"',
        'sidebar_position: 0',
        'slug: /',
        '---',
        '',
        '# Laravel 13: The Unwritten API',
        '',
        'No chapter text has been written yet. Run `npm run sync` again once `chapters/` has',
        'real content.',
        '',
      ].join('\n'),
    );
  }

  console.log(`Synced ${synced} chapter(s) into site/docs/.`);
  if (missing > 0) {
    console.error(`Warning: ${missing} chapter(s) still without text, skipped.`);
  }
}

main();
