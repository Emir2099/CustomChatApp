import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'React Firebase Chat App',
  tagline: 'A modern real-time chat application built with React and Firebase',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://Emir2099.github.io',
  baseUrl: '/CustomChatApp/',

  // GitHub pages deployment config
  organizationName: 'Emir2099',
  projectName: 'CustomChatApp',

  onBrokenLinks: 'ignore',
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
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Emir2099/CustomChatApp',
          showLastUpdateTime: true,
        },
        blog: false, 
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/chat-app-social-card.jpg',
      navbar: {
        title: 'Chat App Docs',
        logo: {
          alt: 'Chat App Logo',
          src: 'img/chat-logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          
          {
            href: 'https://github.com/Emir2099/CustomChatApp',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/getting-started/installation',
              },
              {
                label: 'Features',
                to: '/docs/features/authentication',
              },
              {
                label: 'Components',
                to: '/docs/components/chat-area',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Twitter/X',
                href: 'https://x.com/emir_husain_',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/Emir2099',
              },
              {
                label: 'Firebase',
                href: 'https://firebase.google.com',
              },
              {
                label: 'React',
                href: 'https://reactjs.org',
              },
            ],
          },
        ],
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'jsx', 'css', 'json', 'javascript'],
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
    }),
};

export default config;