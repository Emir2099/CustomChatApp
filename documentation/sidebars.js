/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      link: {
        type: 'generated-index',
        title: 'Getting Started',
        description: 'Learn how to set up and run the chat application',
      },
      items: [
        'getting-started/installation',
        'getting-started/configuration',
        'getting-started/firebase-setup',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      link: {
        type: 'generated-index',
        title: 'Architecture',
        description: 'Understand the system design and architecture',
      },
      items: [
        'architecture/overview',
        'architecture/data-model',
        'architecture/firebase-integration',
        'architecture/folder-structure',
      ],
    },
    {
      type: 'category',
      label: 'Core Features',
      link: {
        type: 'generated-index',
        title: 'Core Features',
        description: 'Detailed documentation of all features',
      },
      items: [
        'features/authentication',
        'features/chat',
        'features/file-sharing',
        'features/user-blocking',
        'features/group-chat',
        'features/voice-messages',
      ],
    },
    {
      type: 'category',
      label: 'Components',
      link: {
        type: 'generated-index',
        title: 'UI Components',
        description: 'Documentation of React components',
      },
      items: [
        'components/chat-area',
        'components/direct-message-panel',
        'components/sidebar',
        'components/message-reactions',
        'components/voice-recorder',
      ],
    },
    {
      type: 'category',
      label: 'Contexts & Hooks',
      link: {
        type: 'generated-index',
        title: 'Contexts & Hooks',
        description: 'Documentation of React contexts and custom hooks',
      },
      items: [
        'contexts/auth-context',
        'contexts/chat-context',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      link: {
        type: 'generated-index',
        title: 'Advanced Topics',
        description: 'Advanced concepts and optimization techniques',
      },
      items: [
        'advanced/performance-optimization',
        'advanced/security-rules',
        'advanced/custom-hooks',
        'advanced/deployment',
      ],
    },
  ],
};

export default sidebars; 