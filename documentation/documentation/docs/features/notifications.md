---
sidebar_position: 5
---

# Notification System

The notification system keeps users informed about new messages and other important events, even when they're not actively viewing the chat application. This document explains how the notification system is implemented.

## Overview

The notification system provides:

- **Browser notifications** for new messages when the window is minimized or in the background
- **Visual indicators** within the application for unread messages
- **Sound alerts** for incoming messages (optional)
- **Notification permission management** to comply with browser requirements

![Notification Example](/img/notification-example.png)

## Implementation

The notification system is built using the Browser Notifications API and integrated with the chat functionality in the `ChatArea` component.

### Notification Permission

Before showing notifications, the application must request permission from the user:

```jsx
// Request notification permission
const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

// Request permission when user interacts with the app
const requestNotificationPermission = useCallback(async () => {
  try {
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    console.log('Notification permission:', permission);
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}, []);

// Prompt user to enable notifications on initial load
useEffect(() => {
  if (notificationPermission === 'default') {
    // Add a button or prompt to request permission
    // This is a user-friendly approach instead of requesting automatically
  }
}, [notificationPermission, requestNotificationPermission]);
```

### Detecting Window Focus

To show notifications only when the application is in the background, the system tracks window focus:

```jsx
// Track window focus state
const [windowFocused, setWindowFocused] = useState(document.hasFocus());

useEffect(() => {
  const handleFocus = () => setWindowFocused(true);
  const handleBlur = () => setWindowFocused(false);
  
  window.addEventListener('focus', handleFocus);
  window.addEventListener('blur', handleBlur);
  
  return () => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('blur', handleBlur);
  };
}, []);
```

### Showing Notifications

When a new message arrives, the application checks if a notification should be shown:

```jsx
// Function to show browser notification
const showNotification = (message, senderName) => {
  // Check notification eligibility
  const notificationEligible = (
    notificationPermission === 'granted' && 
    message && 
    message.sender !== user?.uid &&
    !windowFocused
  );
  
  // Debug notification eligibility
  console.log('Notification check:', {
    permission: notificationPermission,
    messageExists: !!message,
    windowFocused,
    currentUser: user?.uid,
    messageSender: message?.sender,
    eligible: notificationEligible
  });
  
  if (notificationEligible) {
    try {
      // Create notification title
      let title = senderName || 'New Message';
      if (currentChat?.name) {
        title = `${senderName} in ${currentChat.name}`;
      }
      
      // Create notification content
      let body = '';
      if (message.type === 'file') {
        body = `${senderName} sent a file: ${message.fileName || 'attachment'}`;
      } else if (message.type === 'voice') {
        body = `${senderName} sent a voice message`;
      } else {
        body = message.content || 'New message received';
      }
      
      // Set notification options
      const notificationOptions = {
        body,
        icon: '/img/notification-icon.png',
        badge: '/img/notification-badge.png',
        data: {
          url: window.location.href,
          chatId: currentChat?.id,
          messageId: message.id
        },
        tag: `chat-${currentChat?.id}`, // Group notifications by chat
        requireInteraction: false, // Auto-close after a time
        silent: false // Enable sound
      };
      
      // Try to use service worker for notification if available
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, notificationOptions);
        }).catch(() => {
          console.log('No service worker, using regular notification');
          // If no service worker, use regular notification
          new Notification(title, notificationOptions);
        });
      } else {
        // Fallback to regular notification
        new Notification(title, notificationOptions);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
};
```

### Integration with Message Receiving

The notification is triggered when new messages arrive:

```jsx
// Watch for new messages and show notifications
useEffect(() => {
  // Skip if no messages yet
  if (!messages || messages.length === 0) return;
  
  // Get the most recent message
  const latestMessage = messages[messages.length - 1];
  
  // Skip notifications for own messages
  if (latestMessage.sender === user?.uid) return;
  
  // Look up sender name
  const sender = allUsers?.[latestMessage.sender];
  const senderName = sender?.displayName || 'Someone';
  
  // Handle notification for new message
  showNotification(latestMessage, senderName);
}, [messages, showNotification]);
```

### Notification Click Handling

When a user clicks on a notification, they should be directed to the relevant conversation:

```jsx
// Handle notification clicks
useEffect(() => {
  const handleNotificationClick = (event) => {
    // Ensure the window is focused when notification is clicked
    window.focus();
    
    // Get data from notification
    const data = event.notification?.data;
    if (data?.chatId) {
      // Navigate to the specific chat
      // This could be implemented using React Router or context
      console.log('Navigate to chat:', data.chatId);
    }
    
    // Close the notification
    event.notification.close();
  };
  
  // Add event listener if service worker is available
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('notificationclick', handleNotificationClick);
  }
  
  return () => {
    // Clean up event listener
    if (navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('notificationclick', handleNotificationClick);
    }
  };
}, []);
```

## In-App Notification Indicators

Besides browser notifications, the application shows visual indicators for unread messages:

```jsx
// ChatSidebar.jsx - Unread message indicator
const UnreadIndicator = ({ count }) => {
  if (!count || count <= 0) return null;
  
  return (
    <div className={styles.unreadBadge}>
      {count > 99 ? '99+' : count}
    </div>
  );
};

// In the chat list
{chats.map(chat => (
  <div 
    key={chat.id} 
    className={`${styles.chatItem} ${currentChat?.id === chat.id ? styles.active : ''}`}
    onClick={() => selectChat(chat)}
  >
    <div className={styles.chatAvatar}>
      {getChatAvatar(chat)}
      {chat.online && <div className={styles.onlineIndicator} />}
    </div>
    <div className={styles.chatInfo}>
      <div className={styles.chatNameRow}>
        <h3 className={styles.chatName}>{getChatName(chat)}</h3>
        <span className={styles.timeStamp}>{formatTime(chat.lastMessageTime)}</span>
      </div>
      <div className={styles.chatPreviewRow}>
        <p className={styles.messagePreview}>{getLastMessagePreview(chat)}</p>
        <UnreadIndicator count={chat.unreadCount} />
      </div>
    </div>
  </div>
))}
```

## Message Read Status

The application tracks read status for messages to show appropriate indicators:

```jsx
// Mark messages as read when chat is viewed
useEffect(() => {
  if (currentChat?.id && user?.uid) {
    markChatAsRead(currentChat.id);
  }
}, [currentChat?.id, user?.uid, messages]);

// Check if a message is read
const isMessageRead = (message) => {
  return message.readBy && message.readBy[user.uid];
};

// Render read indicators
const renderReadStatus = (message) => {
  if (message.sender !== user.uid) return null;
  
  if (isMessageRead(message)) {
    return <div className={styles.readIndicator}>✓✓</div>;
  } else {
    return <div className={styles.sentIndicator}>✓</div>;
  }
};
```

## Sound Notifications

The application can play sounds for different notification events:

```jsx
// Audio files for notifications
const messageSound = new Audio('/sounds/message.mp3');
const mentionSound = new Audio('/sounds/mention.mp3');

// Play sound for new message
const playMessageSound = (message) => {
  if (!message || message.sender === user?.uid) return;
  
  // Check if the message contains a mention of the user
  const isMentioned = message.content?.includes(`@${user.displayName}`);
  
  // Play the appropriate sound
  if (isMentioned) {
    mentionSound.play().catch(err => console.error('Error playing sound:', err));
  } else {
    messageSound.play().catch(err => console.error('Error playing sound:', err));
  }
};

// Add sound effect to the message notification effect
useEffect(() => {
  if (!messages || messages.length === 0) return;
  
  const latestMessage = messages[messages.length - 1];
  
  // Play sound for new messages
  if (latestMessage && latestMessage.timestamp > lastNotificationTime) {
    setLastNotificationTime(latestMessage.timestamp);
    playMessageSound(latestMessage);
  }
}, [messages, lastNotificationTime]);
```

## User Preferences

The application can allow users to customize their notification preferences:

```jsx
// Notification preferences in user profile
const [notificationPreferences, setNotificationPreferences] = useState({
  browserNotifications: true,
  soundEnabled: true,
  mentionAlerts: true,
  emailNotifications: false,
  // More preference options...
});

// Save preferences to user profile
const saveNotificationPreferences = async (preferences) => {
  try {
    await set(ref(db, `users/${user.uid}/preferences/notifications`), preferences);
    setNotificationPreferences(preferences);
  } catch (error) {
    console.error('Error saving notification preferences:', error);
    throw error;
  }
};

// Load preferences on component mount
useEffect(() => {
  if (!user?.uid) return;
  
  const userPreferencesRef = ref(db, `users/${user.uid}/preferences/notifications`);
  get(userPreferencesRef).then(snapshot => {
    if (snapshot.exists()) {
      setNotificationPreferences(snapshot.val());
    }
  }).catch(error => {
    console.error('Error loading notification preferences:', error);
  });
}, [user?.uid]);
```

## Blocking Integration

The notification system integrates with the user blocking feature to prevent notifications from blocked users:

```jsx
// Check if sender is blocked before showing notification
const isNotificationAllowed = (senderId) => {
  if (!senderId || !user?.uid) return true;
  
  // Check if sender is blocked
  const isBlocked = allUsers?.[user.uid]?.blockedUsers?.[senderId];
  
  return !isBlocked;
};

// Update notification function to check blocking
const showNotification = (message, senderName) => {
  // Add blocking check to notification eligibility
  const notificationEligible = (
    notificationPermission === 'granted' && 
    message && 
    message.sender !== user?.uid &&
    !windowFocused &&
    isNotificationAllowed(message.sender)
  );
  
  // Rest of notification logic...
};
```

## Mobile Device Support

For mobile device support, the application adapts the notification behavior:

```jsx
// Detect mobile devices
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Adjust notification behavior for mobile
const showNotification = (message, senderName) => {
  // On mobile, only show notifications when app is in background
  // as mobile platforms handle their own notification UI
  const notificationEligible = (
    notificationPermission === 'granted' && 
    message && 
    message.sender !== user?.uid &&
    (!windowFocused || document.hidden) &&
    isNotificationAllowed(message.sender) &&
    (!isMobile || document.hidden) // Only notify on mobile when in background
  );
  
  // Rest of notification logic...
};
```

## Progressive Web App (PWA) Integration

For PWA support, the application can register a service worker for better notification handling:

```jsx
// Register service worker for PWA and notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed:', error);
      });
  });
}
```

The service worker handles notification clicks and background synchronization:

```javascript
// service-worker.js
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;
  
  // Close the notification
  notification.close();
  
  // Handle click action
  if (action === 'reply') {
    // Handle reply action
    // This would typically open the app and focus the message input
  } else {
    // Default action - open the chat
    if (data?.url) {
      clients.openWindow(data.url);
    } else {
      clients.openWindow('/');
    }
  }
});
```

## Troubleshooting

Common notification issues and solutions:

1. **Notifications not appearing**:
   - Check browser permission status (`Notification.permission`)
   - Verify window focus state (`document.hasFocus()`)
   - Ensure notification code is running properly (add console logs)
   - Check if the browser supports notifications

2. **Notification permission denied**:
   - Provide UI to explain the benefits of enabling notifications
   - Guide users to reset permissions in browser settings
   - Don't repeatedly ask for permission if denied

3. **Notification sounds not playing**:
   - Browsers may block autoplay of audio
   - Ensure sounds are triggered by a user interaction
   - Check if the audio files are properly loaded

4. **Duplicate notifications**:
   - Use the `tag` option to group similar notifications
   - Track shown notifications to prevent duplicates
   - Handle race conditions in notification code

## Performance Considerations

For optimal notification performance:

1. **Notification throttling**: Limit the frequency of notifications to avoid overwhelming users
2. **Payload size**: Keep notification content small for quick processing
3. **Image optimization**: Use appropriately sized and compressed images for notification icons
4. **Battery impact**: Be mindful of battery usage on mobile devices
5. **Offline support**: Handle notification queue when device is offline

## Best Practices

1. **User control**: Always give users control over notification preferences
2. **Relevant content**: Only send notifications for information users care about
3. **Clear actions**: Include clear actions users can take from notifications
4. **Respectful timing**: Consider time zones and user activity patterns
5. **Accessible design**: Ensure notifications are accessible to all users 