---
sidebar_position: 7
---

# API Reference

I built this chat application using Firebase's Realtime Database as the backend. Here's a detailed reference of the API structure and the key functions I implemented.

## Database Structure

The database is organized into several main collections:

### Users Collection

```json
/users/{userId}: {
  "displayName": "John Doe",
  "email": "john@example.com",
  "photoURL": "https://example.com/photo.jpg",
  "bio": "Hello, I'm John!",
  "isOnline": true,
  "lastSeen": 1650120000000,
  "createdAt": 1649120000000,
  "isAdmin": false,
  "blockedUsers": {
    "userId1": true,
    "userId2": true
  }
}
```

### Chats Collection

```json
/chats/{chatId}: {
  "type": "private", // or "group"
  "createdAt": 1649120000000,
  "updatedAt": 1650120000000,
  "lastMessageTime": 1650120050000,
  
  // For private chats
  "participants": {
    "userId1": true,
    "userId2": true
  },
  
  // For group chats
  "name": "Project Team",
  "createdBy": "userId1",
  "members": {
    "userId1": {
      "role": "admin",
      "joinedAt": 1649120000000
    },
    "userId2": {
      "role": "member",
      "joinedAt": 1649120010000
    }
  },
  
  // Last message preview (for both types)
  "lastMessage": {
    "content": "Hello everyone!",
    "sender": "userId1",
    "senderName": "John Doe",
    "timestamp": 1650120050000
  }
}
```

### Messages Collection

```json
/messages/{chatId}/{messageId}: {
  "content": "Hello, how are you?",
  "sender": "userId1",
  "senderName": "John Doe",
  "senderPhotoURL": "https://example.com/photo.jpg",
  "timestamp": 1650120000000,
  "edited": false,
  "editedAt": null,
  "deleted": false,
  "deletedAt": null,
  "type": "text", // or "file", "voice"
  "readBy": {
    "userId1": 1650120000000,
    "userId2": 1650120010000
  },
  "replyTo": "messageId123", // Optional reference to another message
  
  // For file messages
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "fileType": "application/pdf",
  "fileCategory": "document",
  "fileData": "base64string...",
  
  // For voice messages
  "voiceData": "base64string...",
  "duration": 15, // in seconds
  
  // Reactions
  "reactions": {
    "userId1": "👍",
    "userId2": "❤️"
  }
}
```

### User Chats Collection

This is a mapping between users and their chats for quick access:

```json
/userChats/{userId}/{chatId}: {
  "timestamp": 1650120000000,
  "unreadCount": 5
}
```

### Typing Indicators Collection

```json
/typing/{chatId}/{userId}: {
  "isTyping": true,
  "displayName": "John Doe",
  "timestamp": 1650120000000
}
```

### Logs Collection

```json
/logs/{chatId}/{logId}: {
  "messageId": "messageId123",
  "type": "EDIT", // or "DELETE"
  "performedBy": "userId1",
  "performedByName": "John Doe",
  "timestamp": 1650120050000,
  "originalContent": "Hello there",
  "newContent": "Hello everyone" // Only for EDIT logs
}
```

## Core API Functions

### Authentication

```jsx
// Sign up a new user
const signup = async (email, password, displayName) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });
  await set(ref(db, `users/${userCredential.user.uid}`), {
    displayName,
    email,
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    isOnline: true
  });
  return userCredential.user;
};

// Sign in an existing user
const login = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Sign out
const logout = async () => {
  // Update user status before signing out
  if (user) {
    await update(ref(db, `users/${user.uid}`), {
      isOnline: false,
      lastSeen: serverTimestamp()
    });
  }
  return signOut(auth);
};

// Reset password
const resetPassword = (email) => {
  return sendPasswordResetEmail(auth, email);
};

// Update user profile
const updateUserProfile = async (data) => {
  if (!user) return;
  
  // Update Firebase Auth profile
  await updateProfile(user, {
    displayName: data.displayName || user.displayName,
    photoURL: data.photoURL || user.photoURL
  });
  
  // Update database user data
  await update(ref(db, `users/${user.uid}`), {
    displayName: data.displayName || user.displayName,
    photoURL: data.photoURL || user.photoURL,
    bio: data.bio || null,
    updatedAt: serverTimestamp()
  });
};
```

### Chat Management

```jsx
// Create a direct chat between two users
const createChat = async (otherUserId) => {
  // Implementation details in ChatContext section
};

// Create a group chat
const createGroupChat = async (name, members) => {
  // Implementation details in ChatContext section
};

// Leave a chat
const leaveChat = async (chatId) => {
  if (!chatId || !user?.uid) return false;
  
  try {
    const chatRef = ref(db, `chats/${chatId}`);
    const snapshot = await get(chatRef);
    
    if (!snapshot.exists()) {
      throw new Error('Chat does not exist');
    }
    
    const chatData = snapshot.val();
    
    if (chatData.type === 'private') {
      // For private chats, remove the chat reference from userChats
      await set(ref(db, `userChats/${user.uid}/${chatId}`), null);
    } else if (chatData.type === 'group') {
      // For group chats, remove the user from members
      await update(ref(db, `chats/${chatId}/members/${user.uid}`), null);
      await set(ref(db, `userChats/${user.uid}/${chatId}`), null);
    }
    
    return true;
  } catch (error) {
    console.error('Error leaving chat:', error);
    return false;
  }
};

// Update chat metadata (for group chats)
const updateChatMeta = async (chatId, data) => {
  if (!chatId || !user?.uid) return false;
  
  try {
    // Check if user has permission (is admin)
    const chatRef = ref(db, `chats/${chatId}`);
    const snapshot = await get(chatRef);
    
    if (!snapshot.exists()) {
      throw new Error('Chat does not exist');
    }
    
    const chatData = snapshot.val();
    
    if (
      chatData.type !== 'group' || 
      !chatData.members?.[user.uid]?.role === 'admin'
    ) {
      throw new Error('Not authorized to update this chat');
    }
    
    // Update allowed fields
    const updates = {};
    if (data.name) updates.name = data.name;
    if (data.photoURL) updates.photoURL = data.photoURL;
    updates.updatedAt = serverTimestamp();
    
    await update(chatRef, updates);
    return true;
  } catch (error) {
    console.error('Error updating chat:', error);
    return false;
  }
};
```

### Message Operations

```jsx
// Send a text message
const sendMessage = async (content, replyToId = null) => {
  // Implementation details in ChatContext section
};

// Edit a message
const editMessage = async (chatId, messageId, newContent) => {
  // Implementation details in ChatContext section
};

// Delete a message
const deleteMessage = async (chatId, messageId) => {
  // Implementation details in ChatContext section
};

// Mark messages as read
const markChatAsRead = async (chatId) => {
  // Implementation details in ChatContext section
};

// Add reaction to a message
const handleVote = async (chatId, messageId, reaction) => {
  // Implementation details in ChatContext section
};
```

## Error Handling

I implemented comprehensive error handling throughout the application:

```jsx
// Example of error handling in message sending
try {
  // Send message logic
} catch (error) {
  // Check error type
  if (error.code === 'PERMISSION_DENIED') {
    // Handle permission errors
    showToast('You do not have permission to send messages in this chat');
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network errors
    queueMessageForLaterSending(message);
    showToast('Message will be sent when you reconnect');
  } else {
    // Generic error handling
    console.error('Error sending message:', error);
    showToast('Failed to send message. Please try again.');
  }
}
```

## Performance Considerations

When building this API, I focused on several performance aspects:

1. **Pagination**: Messages are loaded in batches of 20-50 to avoid loading the entire chat history at once
2. **Selective Updates**: Using Firebase's update() method to modify only specific fields
3. **Indexing**: Ensuring proper indexing in the database for common queries
4. **Optimistic UI Updates**: Updating the UI before server confirmation to improve perceived performance
5. **Data Denormalization**: Strategic duplication of data (like lastMessage in chats) to reduce query complexity

## Security Rules

I implemented Firebase security rules to protect the data:

```
// Example Firebase security rules
{
  "rules": {
    "users": {
      "$uid": {
        // Users can read any user profile
        ".read": "auth !== null",
        // Users can only write to their own profile
        ".write": "auth !== null && auth.uid === $uid"
      }
    },
    "chats": {
      "$chatId": {
        // Users can read chats they are part of
        ".read": "auth !== null && data.child('participants').hasChild(auth.uid)",
        // Chat creation and updates
        ".write": "auth !== null && (
          // New chat
          !data.exists() || 
          // Existing chat participant
          data.child('participants').hasChild(auth.uid) ||
          // Group chat admin
          (data.child('type').val() === 'group' && 
           data.child('members').child(auth.uid).child('role').val() === 'admin')
        )"
      }
    },
    "messages": {
      "$chatId": {
        // Users can read messages from chats they are part of
        ".read": "auth !== null && 
                 root.child('chats').child($chatId).child('participants').hasChild(auth.uid)",
        // Users can write messages to chats they are part of
        ".write": "auth !== null && 
                  root.child('chats').child($chatId).child('participants').hasChild(auth.uid)"
      }
    }
  }
}
```

## Rate Limiting

To prevent abuse, I implemented rate limiting for certain operations:

```jsx
// Example rate limiting for message sending
const sendMessage = async (content, replyToId = null) => {
  // Check if user has sent too many messages recently
  const recentMessagesRef = query(
    ref(db, `messages/${currentChat.id}`),
    orderByChild('sender'),
    equalTo(user.uid),
    limitToLast(10)
  );
  
  const snapshot = await get(recentMessagesRef);
  
  if (snapshot.exists()) {
    const messages = Object.values(snapshot.val());
    const now = Date.now();
    const recentCount = messages.filter(msg => 
      now - msg.timestamp < 10000 // Last 10 seconds
    ).length;
    
    if (recentCount >= 5) {
      throw new Error('You are sending messages too quickly. Please wait a moment.');
    }
  }
  
  // Continue with sending message
  // ...
};
```

## Future API Enhancements

I have several ideas for enhancing the API in the future:

1. **WebSocket Integration**: Move from Firebase Realtime Database to a custom WebSocket solution for more control
2. **GraphQL API**: Implement a GraphQL layer for more efficient data fetching
3. **Caching Layer**: Add a Redis caching layer for frequently accessed data
4. **Microservices**: Split functionality into microservices for better scalability
5. **Analytics API**: Add endpoints for collecting usage statistics and user engagement metrics 