Static assets for the Docusaurus site.

- `favicon.png`, `logo.png`, `hero.webp`, `social-card.jpg`: real artwork (an unfolding layer
  revealing hidden code, illustrating the book's theme of undocumented Laravel APIs).
  `hero.webp` has a transparent background (matches `assets/hero-banner.webp` at repo root,
  used by the top-level README) - `social-card.jpg` stays opaque since og:image previews are
  always composited on a platform-controlled background, never the page's own.
  `social-card.jpg` is 1200x630, used as the default `og:image`/`twitter:image` via
  `themeConfig.image` in `docusaurus.config.js`.
