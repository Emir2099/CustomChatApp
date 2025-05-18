---
sidebar_position: 3
---

# Folder Structure

When I designed this chat application, I wanted to keep the code organization clean and intuitive. Here's how I structured the codebase:

## Root Structure

```
/
├── documentation/        # Documentation site (Docusaurus)
├── public/               # Public assets and index.html
├── src/                  # Source code
├── .firebaserc           # Firebase project configuration
├── .gitignore            # Git ignore rules
├── firebase.json         # Firebase configuration
├── package.json          # Project dependencies and scripts
├── storage.rules         # Firebase storage rules
├── firebase-database-rules.json  # Firebase database security rules
├── README.md             # Project readme
└── vite.config.js        # Vite configuration
```

## Source Code Organization

The `src` directory contains all the application code, organized as follows:

```
src/
├── components/           # React components
│   ├── auth/             # Authentication-related components
│   ├── chat/             # Chat-related components
│   └── common/           # Reusable UI components
├── contexts/             # React context providers
├── config/               # Configuration files
├── utils/                # Utility functions
├── hooks/                # Custom React hooks
├── assets/               # Static assets (images, icons)
├── App.jsx               # Main application component
└── main.jsx              # Entry point
```

## Component Structure

I organized components by feature area to keep related code together:

### Auth Components

Authentication-related components like login, registration, and profile:

```
components/auth/
├── LoginForm.jsx
├── RegisterForm.jsx
├── ProfileSettings.jsx
├── PasswordReset.jsx
└── AuthGuard.jsx
```

### Chat Components

Components responsible for the messaging functionality:

```
components/chat/
├── ChatArea.jsx          # Main chat interface
├── ChatSidebar.jsx       # Sidebar with chat list
├── MessageInput.jsx      # Message composition input
├── MessageItem.jsx       # Individual message display
├── MessageList.jsx       # List of messages
├── ChatHeader.jsx        # Chat conversation header
├── MessageReactions.jsx  # Message reactions interface
└── DirectMessagePanel.jsx # User info panel for direct messages
```

### Common Components

Reusable UI components that aren't specific to a feature:

```
components/common/
├── Avatar.jsx            # User avatar display
├── Button.jsx            # Custom button component
├── Modal.jsx             # Modal dialog component
├── Spinner.jsx           # Loading spinner
└── Toast.jsx             # Toast notification
```

## Contexts

React contexts that provide application-wide state:

```
contexts/
├── AuthContext.jsx       # Authentication state
├── ChatContext.jsx       # Chat functionality and state
├── PresenceContext.jsx   # Online/offline user status
└── ThemeContext.jsx      # Application theming
```

## Why This Structure Works

I chose this organization for several reasons:

1. **Feature-based organization**: Related code stays together, making it easier to understand and maintain
2. **Separation of concerns**: Components, contexts, and utilities have clear responsibilities
3. **Reusability**: Common components and hooks can be used across different parts of the app
4. **Scalability**: As the app grows, new features can be added without disrupting existing code
5. **Discoverability**: New developers can quickly find relevant files by looking at the directory structure

For larger applications, I might consider a more strict domain-driven structure, but for a chat app of this size, this organization provides a good balance of simplicity and maintainability. 