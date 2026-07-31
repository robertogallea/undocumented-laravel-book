// @ts-check
const {themes: prismThemes} = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Laravel 13: The Unwritten API',
  tagline: 'A guide to usable but undocumented concepts',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://robertogallea.github.io',
  baseUrl: '/undocumented-laravel-book/',

  organizationName: 'robertogallea',
  projectName: 'undocumented-laravel-book',
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

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
      navbar: {
        title: 'Laravel 13: The Unwritten API',
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
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['php', 'bash'],
      },
    }),
};

module.exports = config;
