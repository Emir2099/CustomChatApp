---
sidebar_position: 4
---

# Message Status Features

One of the most annoying things in chat apps is when messages seem to disappear or take forever to send. I decided to improve the user experience by implementing a proper message status system with optimistic updates and visual indicators.

## Optimistic Updates

Optimistic UI updates are a technique where we update the UI immediately before waiting for server confirmation. This makes the app feel super responsive. Here's how I implemented it:

```jsx
// In ChatContext.jsx
const sendMessage = async (content, replyToId = null) => {
  if (!currentChat?.id || !user?.uid || !content.trim()) return;
  
  // Create a temporary message ID
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create the message object
  const message = {
    id: tempId,
    content: content.trim(),
    sender: user.uid,
    senderName: user.displayName,
    senderPhotoURL: user.photoURL,
    timestamp: Date.now(),
    readBy: {
      [user.uid]: Date.now()
    },
    replyTo: replyToId,
    pending: true // Mark as pending initially
  };
  
  // Optimistically add the message to our state
  setMessages(prev => [...prev, message]);
  
  try {
    // Send to Firebase
    const messageRef = push(ref(db, `messages/${currentChat.id}`));
    
    // Replace the temp ID with the real one from Firebase
    const realId = messageRef.key;
    message.id = realId;
    message.pending = false; // No longer pending
    
    await set(messageRef, message);
    
    // Update the message in our state to remove pending status
    setMessages(prev => 
      prev.map(msg => 
        msg.id === tempId ? { ...msg, id: realId, pending: false } : msg
      )
    );
    
    // Update last message in chat
    await update(ref(db, `chats/${currentChat.id}`), {
      lastMessage: {
        content: content.trim(),
        sender: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      },
      lastMessageTime: serverTimestamp()
    });
    
    return realId;
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Update UI to show send failure
    setMessages(prev => 
      prev.map(msg => 
        msg.id === tempId ? { ...msg, sendFailed: true } : msg
      )
    );
    
    return null;
  }
};
```

## Pending Message Indicators

I wanted users to know when their message is still being sent, so I added visual indicators:

```jsx
// In MessageItem.jsx
function MessageItem({ message, isOwnMessage }) {
  // Determine message status
  const renderMessageStatus = () => {
    if (message.pending) {
      return <span className={styles.pending}>Sending...</span>;
    }
    
    if (message.sendFailed) {
      return (
        <span className={styles.failed}>
          Failed to send
          <button 
            onClick={() => retrySend(message)} 
            className={styles.retryButton}
          >
            Retry
          </button>
        </span>
      );
    }
    
    // Message sent successfully
    const readByCount = Object.keys(message.readBy || {}).length;
    if (readByCount > 1) {
      return <span className={styles.read}>Read</span>;
    } else {
      return <span className={styles.sent}>Sent</span>;
    }
  };
  
  return (
    <div className={`
      ${styles.messageItem}
      ${isOwnMessage ? styles.ownMessage : ''}
      ${message.pending ? styles.pendingMessage : ''}
      ${message.sendFailed ? styles.failedMessage : ''}
    `}>
      {/* Message content */}
      <div className={styles.content}>{message.content}</div>
      
      {/* Message footer with timestamp and status */}
      <div className={styles.footer}>
        <span className={styles.timestamp}>
          {formatTimestamp(message.timestamp)}
        </span>
        
        {isOwnMessage && renderMessageStatus()}
      </div>
    </div>
  );
}
```

## CSS Styling for Message States

I added some subtle styling to indicate different message states:

```css
/* MessageItem.module.css */
.messageItem {
  /* Base message styling */
  margin-bottom: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  max-width: 70%;
  position: relative;
}

.ownMessage {
  background-color: #0084ff;
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

/* Pending message styling */
.pendingMessage {
  opacity: 0.8;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.8; }
  100% { opacity: 0.6; }
}

/* Failed message styling */
.failedMessage {
  border: 1px solid #ff4d4f;
  background-color: rgba(255, 77, 79, 0.1);
}

/* Status indicators */
.pending, .sent, .read, .failed {
  font-size: 11px;
  margin-left: 4px;
  display: inline-block;
}

.pending {
  color: #a0a0a0;
}

.sent {
  color: #a0a0a0;
}

.read {
  color: #52c41a;
}

.failed {
  color: #ff4d4f;
  display: flex;
  align-items: center;
  gap: 4px;
}

.retryButton {
  background: none;
  border: none;
  color: #1890ff;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: 11px;
}
```

## Message Queue for Offline Support

One tricky problem was handling message sending when the user goes offline. I created a queue system to store messages and try sending them when connection is restored:

```jsx
// In ChatContext.jsx
const [messageQueue, setMessageQueue] = useState([]);
const [isConnected, setIsConnected] = useState(true);

// Monitor connection status
useEffect(() => {
  const connectedRef = ref(db, '.info/connected');
  const unsubscribe = onValue(connectedRef, (snap) => {
    const connected = snap.val() === true;
    setIsConnected(connected);
    
    if (connected && messageQueue.length > 0) {
      processMessageQueue();
    }
  });
  
  return () => unsubscribe();
}, [messageQueue]);

// Process queued messages when back online
const processMessageQueue = async () => {
  if (messageQueue.length === 0) return;
  
  const queueCopy = [...messageQueue];
  setMessageQueue([]);
  
  for (const queuedMessage of queueCopy) {
    try {
      await sendMessage(queuedMessage.content, queuedMessage.replyToId);
    } catch (error) {
      console.error('Failed to send queued message:', error);
      // Add back to queue if still failing
      setMessageQueue(prev => [...prev, queuedMessage]);
      break;
    }
  }
};

// Modified send function to handle offline state
const sendMessage = async (content, replyToId = null) => {
  if (!currentChat?.id || !user?.uid || !content.trim()) return;
  
  // If offline, add to queue
  if (!isConnected) {
    setMessageQueue(prev => [...prev, { content, replyToId }]);
    
    // Create an optimistic message marked as queued
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      id: tempId,
      content: content.trim(),
      sender: user.uid,
      senderName: user.displayName,
      senderPhotoURL: user.photoURL,
      timestamp: Date.now(),
      readBy: {
        [user.uid]: Date.now()
      },
      replyTo: replyToId,
      pending: true,
      queued: true
    };
    
    setMessages(prev => [...prev, message]);
    return tempId;
  }
  
  // Normal online flow continues here
  // ...
};
```

## Message Status Workflow

The full message workflow I implemented is:

1. **Composing** - User is typing the message
2. **Sending** - Message has been sent but not confirmed by the server (pending)
3. **Sent** - Server has confirmed receipt
4. **Read** - Other chat participants have seen the message

For each state, I provide appropriate visual feedback to the user.

## Technical Challenges

### Race Conditions

One issue I had to handle was race conditions with optimistic updates. For example, if a user sends multiple messages quickly, the order can get mixed up:

```jsx
// In ChatContext.jsx - Ensuring message order
const sendMessage = async (content, replyToId = null) => {
  // ...
  
  // Use client-side timestamp for optimistic updates
  const clientTimestamp = Date.now();
  
  const message = {
    // ...
    timestamp: clientTimestamp,
    // ...
  };
  
  // Sort messages by timestamp after adding the new one
  setMessages(prev => [...prev, message].sort((a, b) => a.timestamp - b.timestamp));
  
  try {
    // ...
    
    // When updating with the real message, preserve our client timestamp
    // This keeps the message in the same position in the list
    await set(messageRef, {
      ...message,
      serverTimestamp: serverTimestamp() // Add server timestamp separately
    });
    
    // ...
  } catch (error) {
    // ...
  }
};
```

### Connection Status Edge Cases

Another challenge was handling various edge cases with connectivity:

```jsx
// Handling reconnection edge cases
useEffect(() => {
  let reconnectTimer;
  
  const handleOnline = () => {
    // Clear any reconnect timers
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    // Wait a bit for Firebase to reconnect before processing queue
    reconnectTimer = setTimeout(() => {
      if (messageQueue.length > 0) {
        processMessageQueue();
      }
    }, 2000);
  };
  
  const handleOffline = () => {
    // Update connection status immediately for better UX
    setIsConnected(false);
  };
  
  // Listen for browser online/offline events as backup
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}, [messageQueue]);
```

### Message Deduplication

With optimistic updates, you can end up with duplicate messages if you're not careful:

```jsx
// Prevent duplicate messages - helper function I added to ChatContext
const deduplicateMessages = (messages) => {
  const messageMap = new Map();
  
  // Process messages in reverse (newer first)
  // This ensures we keep the most recent version of each message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const key = msg.id.startsWith('temp-') ? msg.content + msg.timestamp : msg.id;
    
    if (!messageMap.has(key)) {
      messageMap.set(key, msg);
    }
  }
  
  // Convert back to array and sort by timestamp
  return Array.from(messageMap.values())
    .sort((a, b) => a.timestamp - b.timestamp);
};

// Use this when merging new messages with existing ones
setMessages(prevMessages => {
  const allMessages = [...prevMessages, ...newMessages];
  return deduplicateMessages(allMessages);
});
```

## User Experience Benefits

These message status features have dramatically improved the user experience:

1. **Instant Feedback**: Users see their messages appear immediately
2. **Clear Status**: Users always know if their message was sent successfully
3. **Offline Support**: Messages don't get lost when connection drops
4. **Less Frustration**: No more wondering if a message was sent or not

## Future Improvements

If I were to enhance this further, I'd add:

1. Message delivery confirmation (double check marks like WhatsApp)
2. Per-user read status for group chats
3. More sophisticated offline persistence with IndexedDB
4. Background sync using Service Workers
5. More detailed error messages for different failure types 