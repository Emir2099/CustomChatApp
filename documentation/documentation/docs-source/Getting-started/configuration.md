---
sidebar_position: 2
---

# Configuration Guide

This guide explains how to configure the React Firebase Chat Application to match your specific requirements and preferences.

## Environment Configuration

The application uses environment variables for configuration. Create a `.env` file in the root directory with the following variables:

```
# Firebase configuration
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_DATABASE_URL=your_database_url

# Application settings
REACT_APP_NAME="Your Chat App Name"
REACT_APP_DESCRIPTION="Your chat application description"
REACT_APP_MAX_FILE_SIZE=10485760  # 10MB in bytes
REACT_APP_THEME=light  # default theme: light or dark
```

For production deployment, create a `.env.production` file with production-specific values.

## Firebase Configuration

The application connects to Firebase through the `firebase.js` configuration file:

```jsx
// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

export default app;
```

## Application Constants

The application uses constants for various settings. You can customize these in the `constants.js` file:

```jsx
// src/config/constants.js
export const FILE_SIZE_LIMIT = parseInt(process.env.REACT_APP_MAX_FILE_SIZE || '10485760', 10);
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

export const IMAGE_COMPRESSION_QUALITY = 0.8;
export const IMAGE_MAX_DIMENSION = 1200;
export const THUMBNAIL_SIZE = 200;

export const TYPING_DEBOUNCE_TIME = 1000; // 1 second
export const MESSAGE_PAGE_SIZE = 20;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_GROUP_NAME_LENGTH = 30;
export const MAX_GROUP_DESCRIPTION_LENGTH = 100;

export const DEFAULT_AVATAR_URL = '/assets/default-avatar.png';
export const DEFAULT_GROUP_AVATAR_URL = '/assets/default-group.png';

export const APP_NAME = process.env.REACT_APP_NAME || 'React Chat';
```

## Theme Configuration

The application supports theming through CSS variables. You can modify the default themes or add new ones:

```css
/* src/styles/themes.css */
:root {
  /* Light theme (default) */
  --color-primary: #4a6fdc;
  --color-primary-dark: #3b5cb8;
  --color-primary-light: #6f8fe5;
  --color-secondary: #48bb78;
  --color-secondary-dark: #38a169;
  --color-secondary-light: #68d391;
  --color-background: #ffffff;
  --color-background-secondary: #f7fafc;
  --color-text: #2d3748;
  --color-text-secondary: #718096;
  --color-border: #e2e8f0;
  --color-success: #38a169;
  --color-error: #e53e3e;
  --color-warning: #dd6b20;
  --color-info: #3182ce;
  --message-bubble-self: #4a6fdc;
  --message-bubble-self-text: #ffffff;
  --message-bubble-other: #f2f2f2;
  --message-bubble-other-text: #2d3748;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* Dark theme */
[data-theme="dark"] {
  --color-primary: #63b3ed;
  --color-primary-dark: #4299e1;
  --color-primary-light: #90cdf4;
  --color-secondary: #68d391;
  --color-secondary-dark: #48bb78;
  --color-secondary-light: #9ae6b4;
  --color-background: #1a202c;
  --color-background-secondary: #2d3748;
  --color-text: #f7fafc;
  --color-text-secondary: #a0aec0;
  --color-border: #4a5568;
  --color-success: #48bb78;
  --color-error: #f56565;
  --color-warning: #ed8936;
  --color-info: #4299e1;
  --message-bubble-self: #3182ce;
  --message-bubble-self-text: #ffffff;
  --message-bubble-other: #2d3748;
  --message-bubble-other-text: #e2e8f0;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
}
```

## Feature Configuration

You can enable or disable features in the application by modifying the respective contexts:

### Chat Feature Configuration

```jsx
// src/contexts/ChatContext.jsx
// ...

// Feature flags
const FEATURES = {
  messageReactions: true,      // Enable/disable emoji reactions
  readReceipts: true,          // Enable/disable read receipts
  typingIndicators: true,      // Enable/disable typing indicators
  messageSearch: true,         // Enable/disable message search
  voiceMessages: true,         // Enable/disable voice messages
  imageCompression: true,      // Enable/disable image compression before upload
  userBlocking: true,          // Enable/disable user blocking
  messageEditing: true,        // Enable/disable message editing
  messageDeletion: true,       // Enable/disable message deletion
  groupChats: true,            // Enable/disable group chat functionality
  chatHistory: true,           // Enable/disable loading message history
  mediaPreview: true,          // Enable/disable file preview for images
};

// ...

// Make feature flags available through context
const chatContextValue = {
  // ...other context values
  features: FEATURES,
};

return (
  <ChatContext.Provider value={chatContextValue}>
    {children}
  </ChatContext.Provider>
);
```

### Notification Configuration

```jsx
// src/contexts/NotificationContext.jsx
// ...

// Notification settings
const NOTIFICATION_SETTINGS = {
  browserNotifications: true,    // Enable/disable browser notifications
  soundEnabled: true,            // Enable/disable notification sounds
  notifyInFocus: false,          // Notify even when app is in focus
  showSenderName: true,          // Show sender name in notification
  showMessagePreview: true,      // Show message content in notification
  notificationDuration: 5000,    // Auto-dismiss after 5 seconds
  groupNotifications: true,      // Group multiple notifications
  mentionNotifications: true,    // Special notification for @mentions
};

// ...
```

## Firebase Security Rules

To secure your Firebase data, configure your security rules in the Firebase Console:

### Realtime Database Rules

```json
{
  "rules": {
    "users": {
      ".read": "auth !== null",
      "$userId": {
        ".write": "auth !== null && auth.uid === $userId"
      }
    },
    "chats": {
      "$chatId": {
        ".read": "auth !== null && (data.child('participants').child(auth.uid).exists() || data.child('members').child(auth.uid).exists())",
        ".write": "auth !== null && (data.child('participants').child(auth.uid).exists() || (data.child('members').child(auth.uid).exists() && data.child('members').child(auth.uid).child('role').val() === 'admin'))"
      }
    },
    "messages": {
      "$chatId": {
        ".read": "auth !== null && root.child('chats').child($chatId).child('participants').child(auth.uid).exists() || root.child('chats').child($chatId).child('members').child(auth.uid).exists()",
        "$messageId": {
          ".write": "auth !== null && (newData.child('sender').val() === auth.uid || data.child('sender').val() === auth.uid)"
        }
      }
    },
    "userChats": {
      "$userId": {
        ".read": "auth !== null && auth.uid === $userId",
        ".write": "auth !== null && auth.uid === $userId"
      }
    },
    "typing": {
      "$chatId": {
        ".read": "auth !== null && root.child('chats').child($chatId).child('participants').child(auth.uid).exists() || root.child('chats').child($chatId).child('members').child(auth.uid).exists()",
        "$userId": {
          ".write": "auth !== null && auth.uid === $userId"
        }
      }
    }
  }
}
```

### Storage Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /user/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /chat/{chatId}/{allPaths=**} {
      allow read: if request.auth != null && (
        exists(/databases/$(database)/documents/chats/$(chatId)/participants/$(request.auth.uid)) || 
        exists(/databases/$(database)/documents/chats/$(chatId)/members/$(request.auth.uid))
      );
      allow write: if request.auth != null && (
        exists(/databases/$(database)/documents/chats/$(chatId)/participants/$(request.auth.uid)) || 
        exists(/databases/$(database)/documents/chats/$(chatId)/members/$(request.auth.uid))
      );
    }
  }
}
```

## Performance Optimization Settings

You can tune performance-related settings in the application:

```jsx
// src/config/performance.js
export const PERFORMANCE_SETTINGS = {
  messageBatchSize: 20,           // Number of messages to load at once
  messageScrollThreshold: 0.95,   // Scroll position threshold for loading more messages
  imageCompressionQuality: 0.8,   // JPEG compression quality (0-1)
  maxImageDimension: 1200,        // Max image dimension in pixels
  userPresenceInterval: 60000,    // How often to update user presence (ms)
  typingDebounceTime: 1000,       // Debounce time for typing indicator (ms)
  messageCacheTime: 3600000,      // Message cache expiration time (1 hour)
  offlineSupport: true,           // Enable Firebase offline persistence
  serviceWorkerEnabled: true,     // Enable service worker for offline support
  lazyLoadImages: true            // Lazy load images in messages
};
```

## Customizing Components

You can customize the appearance and behavior of UI components by modifying their CSS modules:

### Chat Message Styles

```css
/* src/components/chat/ChatMessage.module.css */
.messageContainer {
  display: flex;
  margin-bottom: var(--spacing-md);
  animation: fadeIn 0.3s ease-in-out;
}

.messageSelf {
  justify-content: flex-end;
}

.messageOther {
  justify-content: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-right: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.messageContent {
  max-width: 70%;
}

.bubble {
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  position: relative;
  word-wrap: break-word;
}

.bubbleSelf {
  background-color: var(--message-bubble-self);
  color: var(--message-bubble-self-text);
  border-top-right-radius: var(--border-radius-sm);
}

.bubbleOther {
  background-color: var(--message-bubble-other);
  color: var(--message-bubble-other-text);
  border-top-left-radius: var(--border-radius-sm);
}

.timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  text-align: right;
}

/* Add custom animation */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Advanced Configuration

### Firebase Cloud Functions

For advanced features like push notifications or message processing, you can deploy Firebase Cloud Functions:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Notify users when they receive a new message
exports.sendNotification = functions.database.ref('/messages/{chatId}/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.val();
    const { chatId } = context.params;
    
    // Skip notifications for system messages
    if (message.type === 'system') return null;
    
    try {
      // Get chat data to find participants
      const chatRef = admin.database().ref(`/chats/${chatId}`);
      const chatSnapshot = await chatRef.once('value');
      const chat = chatSnapshot.val();
      
      if (!chat) return null;
      
      let recipientIds = [];
      
      if (chat.type === 'private') {
        // For private chats, notify the other participant
        recipientIds = Object.keys(chat.participants || {})
          .filter(uid => uid !== message.sender);
      } else if (chat.type === 'group') {
        // For group chats, notify all members except sender
        recipientIds = Object.keys(chat.members || {})
          .filter(uid => uid !== message.sender);
      }
      
      // Get sender data
      const senderRef = admin.database().ref(`/users/${message.sender}`);
      const senderSnapshot = await senderRef.once('value');
      const sender = senderSnapshot.val() || {};
      
      // Send notification to each recipient
      const notifications = recipientIds.map(async (recipientId) => {
        // Check if the recipient has blocked the sender
        const blockedRef = admin.database().ref(`/users/${recipientId}/blockedUsers/${message.sender}`);
        const blockedSnapshot = await blockedRef.once('value');
        
        if (blockedSnapshot.exists() && blockedSnapshot.val() === true) {
          // Skip notification if recipient has blocked sender
          return null;
        }
        
        // Get recipient's FCM token
        const fcmTokenRef = admin.database().ref(`/users/${recipientId}/fcmToken`);
        const fcmTokenSnapshot = await fcmTokenRef.once('value');
        const fcmToken = fcmTokenSnapshot.val();
        
        if (!fcmToken) return null;
        
        // Create notification
        const notification = {
          title: chat.type === 'private' 
            ? sender.displayName || 'New message' 
            : `${sender.displayName || 'Someone'} in ${chat.name || 'group'}`,
          body: message.type === 'file' 
            ? 'Sent a file' 
            : message.type === 'voice'
              ? 'Sent a voice message'
              : message.content || 'New message',
          icon: sender.photoURL || '/assets/default-avatar.png',
          click_action: `https://your-app-url.com/chat/${chatId}`,
          sound: 'default'
        };
        
        // Send FCM message
        return admin.messaging().sendToDevice(fcmToken, {
          notification,
          data: {
            chatId,
            messageId: context.params.messageId,
            senderId: message.sender,
            type: message.type || 'text'
          }
        });
      });
      
      return Promise.all(notifications);
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  });
```

### Progressive Web App Configuration

Configure the Progressive Web App (PWA) features by modifying the `manifest.json` file:

```json
{
  "short_name": "Chat App",
  "name": "React Firebase Chat App",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#4a6fdc",
  "background_color": "#ffffff",
  "description": "A real-time chat application built with React and Firebase",
  "orientation": "portrait-primary",
  "categories": ["social", "communication"],
  "shortcuts": [
    {
      "name": "Open Messages",
      "short_name": "Messages",
      "description": "View your messages",
      "url": "/messages",
      "icons": [{ "src": "/icons/message.png", "sizes": "192x192" }]
    },
    {
      "name": "Open Profile",
      "short_name": "Profile",
      "description": "View your profile",
      "url": "/profile",
      "icons": [{ "src": "/icons/profile.png", "sizes": "192x192" }]
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/chat.png",
      "type": "image/png",
      "sizes": "320x640",
      "platform": "narrow",
      "label": "Chat Interface"
    },
    {
      "src": "/screenshots/home.png",
      "type": "image/png",
      "sizes": "320x640",
      "platform": "narrow",
      "label": "Home Screen"
    }
  ]
}
```

## White-labeling

To white-label the application for your brand, update these key files:

1. **Environment variables**: Update the app name and description
2. **Theme colors**: Modify the CSS variables to match your brand colors
3. **Assets**: Replace default images in the `public/assets` directory
4. **Logo**: Replace the logo in the header component
5. **Text content**: Update text in main components like welcome screens and headers

## Debugging and Testing

Enable debugging tools and test configurations by setting environment variables:

```
# For development
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=verbose
REACT_APP_MOCK_FIREBASE=false
REACT_APP_TEST_ACCOUNT_EMAIL=test@example.com
REACT_APP_TEST_ACCOUNT_PASSWORD=testpassword123
```

## Conclusion

This configuration guide provides an overview of the many ways you can customize the React Firebase Chat Application. For more specific customization needs, refer to the relevant component and context documentation, or explore the source code directly. 