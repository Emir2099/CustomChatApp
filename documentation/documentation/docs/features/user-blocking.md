---
sidebar_position: 4
---

# User Blocking System

The user blocking feature allows users to prevent unwanted communication by blocking specific users. This document explains how the blocking system is implemented in the chat application.

## Overview

When a user blocks another user:

1. The blocked user can no longer send messages to the blocker
2. The blocker will see a "blocked" indicator in the UI
3. Messages from blocked users are hidden (optional configuration)

## User Interface

The blocking feature is accessible from two main locations:

### Direct Message Panel

In the direct message panel (right sidebar), users can find the block/unblock button:

![Block Button UI](/img/block-button-ui.png)

The UI changes based on the current blocking state:
- For unblocked users: Shows a "Block User" button
- For blocked users: Shows "You've blocked this user" banner and an "Unblock User" button

### Chat Area

The chat area displays a banner when viewing a conversation with a blocked user:

![Blocked Banner](/img/blocked-banner.png)

The message input area is disabled when viewing a chat with a blocked user, with a message indicating "You can't send messages to blocked users".

## Implementation

### Database Structure

Blocked users are stored in the Firebase Realtime Database under the user's profile:

```
/users/{userId}/blockedUsers/{blockedUserId}: true
```

This structure allows for quick lookups to check if a user is blocked.

### Core Functions

The blocking functionality is implemented in the `ChatContext.jsx` file with three main functions:

#### 1. Block User

```jsx
// Function to block a user
const blockUser = useCallback(async (userIdToBlock) => {
  if (!user?.uid || !userIdToBlock) return;

  try {
    // Add the user to the blocked list
    const updates = {};
    updates[`users/${user.uid}/blockedUsers/${userIdToBlock}`] = true;
    await update(ref(db), updates);
    
    // Update local state
    console.log(`User ${userIdToBlock} has been blocked`);
    
    return true;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}, [user]);
```

#### 2. Unblock User

```jsx
// Function to unblock a user
const unblockUser = useCallback(async (userIdToUnblock) => {
  if (!user?.uid || !userIdToUnblock) return;

  try {
    // Remove the user from the blocked list
    const updates = {};
    updates[`users/${user.uid}/blockedUsers/${userIdToUnblock}`] = null;
    await update(ref(db), updates);
    
    // Update local state
    console.log(`User ${userIdToUnblock} has been unblocked`);
    
    return true;
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}, [user]);
```

#### 3. Check If User Is Blocked

```jsx
// Function to check if a user is blocked
const isUserBlocked = useCallback((userId) => {
  if (!user?.uid || !userId || !allUsers?.[user.uid]?.blockedUsers) return false;
  
  // Check if userId is in current user's blocked list
  return !!allUsers[user.uid]?.blockedUsers?.[userId];
}, [user, allUsers]);
```

### Message Sending Prevention

The application prevents messages from being sent to users who have blocked the sender by checking the blocking status before allowing message transmission:

```jsx
// In the sendMessage function
if (currentChat.type === 'private') {
  // Find the other user's ID
  let otherUserId = null;
  
  if (currentChat.participants) {
    otherUserId = Object.keys(currentChat.participants).find(id => id !== user.uid);
  } else if (currentChat.members) {
    otherUserId = Object.keys(currentChat.members).find(id => id !== user.uid);
  }
  
  if (otherUserId) {
    // Check if the recipient has blocked the sender
    const otherUserRef = ref(db, `users/${otherUserId}/blockedUsers/${user.uid}`);
    const blockedSnapshot = await get(otherUserRef);
    
    if (blockedSnapshot.exists() && blockedSnapshot.val() === true) {
      // If the recipient has blocked the sender, don't allow sending the message
      console.log("Cannot send message: recipient has blocked you");
      return;
    }
  }
}
```

Similar checks are implemented for file messages and voice messages.

## User Experience Considerations

The blocking system is designed with these UX principles:

1. **Clear Feedback**: Users receive immediate feedback when blocking/unblocking
2. **Reversible Actions**: Blocking can always be undone by unblocking
3. **Privacy**: Users are not notified when they are blocked
4. **Transparency**: Blocked users see a clear error message if they try to send messages

## Integration with Other Features

The blocking system integrates with:

- **Message Display**: Optionally filtering out messages from blocked users
- **User Search**: Preventing blocked users from appearing in search results
- **Group Chats**: Still allowing blocked users to interact in shared group contexts
- **Notifications**: Preventing notifications from blocked users

## Security Considerations

The blocking system includes these security measures:

1. **Database Rules**: Firebase security rules prevent unauthorized access to blocking data
2. **Client-Side Validation**: UI prevents attempts to send messages to blocking users
3. **Server-Side Validation**: Database rules validate blocking status during message sending

## Customization Options

The blocking system can be customized by:

1. **Modifying the UI**: Changing the appearance of blocking indicators
2. **Adjusting Behavior**: Configuring whether to hide or show messages from blocked users
3. **Extending Functionality**: Adding block reporting or abuse notification features 