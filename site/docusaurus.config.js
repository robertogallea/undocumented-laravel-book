// @ts-check
const {themes: prismThemes} = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Laravel 13: The Unwritten API',
  tagline: 'A guide to usable but undocumented concepts',
  favicon: 'img/favicon.png',

  future: {
    v4: true,
  },

  url: 'https://robertogallea.github.io',
  baseUrl: '/undocumented-laravel-site/',

  organizationName: 'robertogallea',
  projectName: 'undocumented-laravel-site',
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    }
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/robertogallea/undocumented-laravel-book/edit/main/chapters/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Default og:image/twitter:image for link previews (overridable per-page).
      image: 'img/social-card.jpg',
      navbar: {
        title: 'Laravel 13: The Unwritten API',
        logo: {
          alt: 'Laravel 13: The Unwritten API logo',
          src: 'img/logo.png',
        },
        items: [
          {
            href: 'https://github.com/robertogallea/undocumented-laravel-book',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [],
        copyright: `Copyright ${new Date().getFullYear()} Roberto Gallea. Text licensed under CC BY-SA 4.0, code under MIT.`,
      },
      prism: {
        // Same theme for both site modes, on purpose: laravel.com/docs renders every code
        // block through Torchlight with a fixed dark "palenight" theme regardless of the
        // page's own light/dark toggle. `palenight` here is prism-react-renderer's closest
        // bundled equivalent to that same Material Palenight color scheme.
        theme: prismThemes.palenight,
        darkTheme: prismThemes.palenight,
        additionalLanguages: ['php', 'bash'],
      },
    }),
};

module.exports = config;
