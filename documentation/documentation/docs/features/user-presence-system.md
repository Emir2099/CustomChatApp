---
sidebar_position: 16
---

# User Presence System

Building a reliable user presence system was essential to create a responsive and engaging chat experience. I wanted users to know who's currently online, who's typing, and when someone has read their messages.

## Core Presence Architecture

I designed the presence system around Firebase's Realtime Database because it's perfect for this use case - it handles real-time updates and automatically cleans up when connections drop:

```jsx
// src/contexts/PresenceContext.jsx
const PresenceContext = createContext();

export function PresenceProvider({ children }) {
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [lastSeen, setLastSeen] = useState({});
  
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (!currentUser) return;
    
    // Setup user presence monitoring
    const userStatusRef = ref(db, `status/${currentUser.uid}`);
    const connectedRef = ref(db, '.info/connected');
    
    const handleConnectionChange = (snapshot) => {
      if (snapshot.val() === true) {
        // User is connected
        
        // When I disconnect, remove this device from online devices
        // and store the last time I was seen
        onDisconnect(userStatusRef).update({
          state: 'offline',
          lastSeen: serverTimestamp(),
          online: false
        });
        
        // Register my current online state
        update(userStatusRef, {
          state: 'online',
          lastSeen: serverTimestamp(),
          online: true
        });
      }
    };
    
    // Listen for connection state changes
    onValue(connectedRef, handleConnectionChange);
    
    // Listen for online users
    const allStatusRef = ref(db, 'status');
    
    const handleStatusChange = (snapshot) => {
      if (snapshot.exists()) {
        const statuses = snapshot.val();
        const onlineUsersData = {};
        const lastSeenData = {};
        
        Object.keys(statuses).forEach(userId => {
          const userStatus = statuses[userId];
          if (userStatus.online) {
            onlineUsersData[userId] = true;
          }
          
          if (userStatus.lastSeen) {
            lastSeenData[userId] = userStatus.lastSeen;
          }
        });
        
        setOnlineUsers(onlineUsersData);
        setLastSeen(lastSeenData);
      }
    };
    
    onValue(allStatusRef, handleStatusChange);
    
    return () => {
      off(connectedRef);
      off(allStatusRef);
    };
  }, [currentUser]);
  
  // Handle typing indicators
  const setUserTyping = (chatId, isTyping) => {
    if (!currentUser || !chatId) return;
    
    const typingRef = ref(db, `typing/${chatId}/${currentUser.uid}`);
    
    if (isTyping) {
      set(typingRef, {
        displayName: currentUser.displayName,
        timestamp: serverTimestamp()
      });
      
      // Auto-clear typing indicator after 10 seconds of inactivity
      setTimeout(() => {
        const lastTyped = Date.now();
        if (lastTyped - Date.now() >= 10000) {
          remove(typingRef);
        }
      }, 10000);
    } else {
      remove(typingRef);
    }
  };
  
  // Listen for typing indicators in a specific chat
  const listenToTypingUsers = (chatId) => {
    if (!chatId) return () => {};
    
    const typingRef = ref(db, `typing/${chatId}`);
    
    const handleTypingChange = (snapshot) => {
      if (snapshot.exists()) {
        const typingData = snapshot.val();
        
        // Filter out stale typing indicators (older than 10 seconds)
        const now = Date.now();
        const activeTyping = {};
        Object.keys(typingData).forEach(userId => {
          const userData = typingData[userId];
          if (userId !== currentUser?.uid && userData.timestamp && 
              now - userData.timestamp < 10000) {
            activeTyping[userId] = userData;
          }
        });
        
        setTypingUsers(prev => ({
          ...prev,
          [chatId]: activeTyping
        }));
      } else {
        setTypingUsers(prev => ({
          ...prev,
          [chatId]: {}
        }));
      }
    };
    
    onValue(typingRef, handleTypingChange);
    
    return () => off(typingRef);
  };
  
  return (
    <PresenceContext.Provider value={{
      onlineUsers,
      lastSeen,
      typingUsers,
      setUserTyping,
      listenToTypingUsers,
      isUserOnline: (userId) => !!onlineUsers[userId],
      getUserLastSeen: (userId) => lastSeen[userId] || null,
      getTypingUsers: (chatId) => typingUsers[chatId] || {}
    }}>
      {children}
    </PresenceContext.Provider>
  );
}

export const usePresence = () => useContext(PresenceContext);
```

## Online Indicators

I implemented visual indicators for online status within the user interface:

```jsx
// src/components/common/UserAvatar.jsx
function UserAvatar({ userId, size = "medium", showPresence = true }) {
  const { getUserData } = useUsers();
  const { isUserOnline } = usePresence();
  
  const user = getUserData(userId);
  const isOnline = isUserOnline(userId);
  
  const sizeClassMap = {
    small: styles.smallAvatar,
    medium: styles.mediumAvatar,
    large: styles.largeAvatar
  };
  
  return (
    <div className={styles.avatarContainer}>
      <div className={`${styles.avatar} ${sizeClassMap[size] || sizeClassMap.medium}`}>
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user.displayName || 'User'} />
        ) : (
          <div className={styles.defaultAvatar}>
            {(user?.displayName?.charAt(0) || userId?.charAt(0) || '?').toUpperCase()}
          </div>
        )}
      </div>
      
      {showPresence && (
        <div className={`${styles.presenceIndicator} ${isOnline ? styles.online : styles.offline}`} />
      )}
    </div>
  );
}

// src/components/chat/ContactsList.jsx
function ContactsList() {
  const { users, userChats, createOrOpenChat } = useUsers();
  const { onlineUsers, getUserLastSeen } = usePresence();
  const { formatDistanceToNow } = useDate();
  
  const sortedUsers = useMemo(() => {
    return Object.values(users)
      .sort((a, b) => {
        // Online users first
        if (onlineUsers[a.uid] && !onlineUsers[b.uid]) return -1;
        if (!onlineUsers[a.uid] && onlineUsers[b.uid]) return 1;
        
        // Then by last seen (most recent first)
        const aLastSeen = getUserLastSeen(a.uid) || 0;
        const bLastSeen = getUserLastSeen(b.uid) || 0;
        
        return bLastSeen - aLastSeen;
      });
  }, [users, onlineUsers, getUserLastSeen]);

  return (
    <div className={styles.contactsList}>
      <h3>Contacts</h3>
      
      {sortedUsers.length === 0 ? (
        <div className={styles.emptyState}>No contacts found</div>
      ) : (
        <ul className={styles.contactItems}>
          {sortedUsers.map(user => (
            <li 
              key={user.uid}
              className={styles.contactItem}
              onClick={() => createOrOpenChat(user.uid)}
            >
              <UserAvatar userId={user.uid} size="small" showPresence={true} />
              
              <div className={styles.contactInfo}>
                <div className={styles.contactName}>
                  {user.displayName}
                </div>
                
                <div className={styles.contactStatus}>
                  {onlineUsers[user.uid] ? (
                    <span className={styles.onlineStatus}>Online</span>
                  ) : getUserLastSeen(user.uid) ? (
                    <span className={styles.lastSeenStatus}>
                      Last seen {formatDistanceToNow(getUserLastSeen(user.uid))} ago
                    </span>
                  ) : (
                    <span className={styles.unknownStatus}>Offline</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Typing Indicators

I implemented typing indicators to show when users are composing messages:

```jsx
// src/components/chat/MessageInput.jsx
function MessageInput() {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const { currentChat, sendMessage } = useChat();
  const { setUserTyping } = usePresence();
  
  // Track typing state and notify other users
  useEffect(() => {
    const typingTimeout = setTimeout(() => {
      if (isTyping && message.length === 0) {
        setIsTyping(false);
        setUserTyping(currentChat?.id, false);
      }
    }, 2000);
    
    return () => clearTimeout(typingTimeout);
  }, [message, isTyping, currentChat?.id, setUserTyping]);
  
  const handleInputChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Update typing indicator state
    if (newMessage.length > 0 && !isTyping) {
      setIsTyping(true);
      setUserTyping(currentChat?.id, true);
    } else if (newMessage.length === 0 && isTyping) {
      setIsTyping(false);
      setUserTyping(currentChat?.id, false);
    }
  };
  
  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage({
        content: message.trim(),
        type: 'text'
      });
      
      setMessage("");
      setIsTyping(false);
      setUserTyping(currentChat?.id, false);
    }
  };
  
  // Rest of component...
}

// src/components/chat/TypingIndicator.jsx
function TypingIndicator({ chatId }) {
  const { getTypingUsers } = usePresence();
  const typingUsers = getTypingUsers(chatId);
  
  if (Object.keys(typingUsers).length === 0) {
    return null;
  }
  
  return (
    <div className={styles.typingIndicator}>
      <div className={styles.dots}>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
      </div>
      
      <div className={styles.typingText}>
        {Object.values(typingUsers).length === 1 ? (
          <span>{Object.values(typingUsers)[0].displayName} is typing...</span>
        ) : Object.values(typingUsers).length === 2 ? (
          <span>{Object.values(typingUsers)[0].displayName} and {Object.values(typingUsers)[1].displayName} are typing...</span>
        ) : (
          <span>Several people are typing...</span>
        )}
      </div>
    </div>
  );
}
```

## Read Receipts

To let users know when their messages have been seen, I implemented read receipts:

```jsx
// src/contexts/ChatContext.jsx
export function ChatProvider({ children }) {
  // ... existing context code ...
  
  // Mark messages as read when viewed
  const markMessagesAsRead = useCallback((chatId) => {
    if (!currentUser || !chatId) return;
    
    const chatReadRef = ref(db, `chats/${chatId}/participants/${currentUser.uid}/lastRead`);
    
    set(chatReadRef, serverTimestamp())
      .catch(error => {
        console.error("Error marking messages as read:", error);
      });
  }, [currentUser]);
  
  // Exposing to consumers
  const value = {
    // ... other values
    markMessagesAsRead
  };
  
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

// src/components/chat/MessageList.jsx
function MessageList() {
  const { currentChat, messages, loadMessages, markMessagesAsRead } = useChat();
  const listRef = useRef(null);
  
  useEffect(() => {
    if (currentChat?.id) {
      loadMessages(currentChat.id);
      
      // Mark messages as read when component mounts or chat changes
      markMessagesAsRead(currentChat.id);
    }
  }, [currentChat?.id, loadMessages, markMessagesAsRead]);

  // Also mark as read when scrolling through messages
  useEffect(() => {
    const handleScroll = debounce(() => {
      if (currentChat?.id) {
        markMessagesAsRead(currentChat.id);
      }
    }, 300);
    
    const listElement = listRef.current;
    
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (listElement) {
        listElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [currentChat?.id, markMessagesAsRead]);

  // Rest of component...
}

// src/components/chat/MessageItem.jsx
function MessageItem({ message }) {
  const { currentUser } = useAuth();
  const { currentChat } = useChat();
  const fromMe = message.senderId === currentUser?.uid;
  
  // Determine if message has been read by other participants
  const getReadStatus = () => {
    if (!fromMe || !currentChat?.participants) return null;
    
    const otherParticipants = Object.entries(currentChat.participants)
      .filter(([uid]) => uid !== currentUser.uid);
    
    if (otherParticipants.length === 0) return null;
    
    const readByCount = otherParticipants.filter(([, data]) => {
      return data.lastRead && data.lastRead > message.timestamp;
    }).length;
    
    if (readByCount === 0) {
      return "Sent";
    } else if (readByCount < otherParticipants.length) {
      return "Read by some";
    } else {
      return "Read by all";
    }
  };
  
  const readStatus = getReadStatus();
  
  return (
    <div className={`${styles.messageItem} ${fromMe ? styles.sentByMe : styles.receivedMessage}`}>
      {/* Message content */}
      <div className={styles.messageContent}>
        {message.content}
      </div>
      
      {/* Message metadata */}
      <div className={styles.messageMetadata}>
        <span className={styles.messageTime}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        
        {fromMe && readStatus && (
          <span className={styles.readStatus}>
            {readStatus === "Sent" && <SendIcon className={styles.sentIcon} />}
            {readStatus === "Read by some" && <ReadIcon className={styles.partialReadIcon} />}
            {readStatus === "Read by all" && <ReadIcon className={styles.readIcon} />}
          </span>
        )}
      </div>
    </div>
  );
}
```

## User Activity Tracking

To enhance the presence information, I added activity tracking functionality:

```jsx
// src/utils/activityTracker.js
export const setupActivityTracking = (userId) => {
  if (!userId) return () => {};
  
  const activityRef = ref(db, `activity/${userId}`);
  let activityTimeout = null;
  
  const recordActivity = () => {
    update(activityRef, {
      lastActive: serverTimestamp(),
      browser: getBrowserInfo(),
      platform: getPlatformInfo(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    // Clear previous timeout and set a new one
    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }
    
    // Update activity every 5 minutes to avoid too many writes
    activityTimeout = setTimeout(recordActivity, 5 * 60 * 1000);
  };
  
  // Track common user interactions
  const activityEvents = [
    'mousedown', 'keydown', 'touchstart', 'scroll'
  ];
  
  const handleUserActivity = debounce(recordActivity, 2000);
  
  activityEvents.forEach(event => {
    window.addEventListener(event, handleUserActivity, { passive: true });
  });
  
  // Initial activity record
  recordActivity();
  
  // Clean up
  return () => {
    activityEvents.forEach(event => {
      window.removeEventListener(event, handleUserActivity);
    });
    
    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }
  };
};

// Integrated into the PresenceProvider
useEffect(() => {
  if (!currentUser) return;
  
  const cleanupActivityTracking = setupActivityTracking(currentUser.uid);
  
  return () => {
    cleanupActivityTracking();
  };
}, [currentUser]);
```

## Performance Considerations

The presence system can generate a lot of database operations, so I implemented several optimizations:

```jsx
// src/contexts/PresenceContext.jsx

// Batching updates to minimize writes
const batchedSetUserTyping = (() => {
  let pendingUpdates = {};
  let timeout = null;
  
  return (chatId, isTyping) => {
    if (!currentUser || !chatId) return;
    
    // Add to pending batch
    pendingUpdates[chatId] = isTyping;
    
    if (!timeout) {
      timeout = setTimeout(() => {
        // Apply all pending updates at once
        const updates = {};
        Object.entries(pendingUpdates).forEach(([chatId, isTyping]) => {
          if (isTyping) {
            updates[`typing/${chatId}/${currentUser.uid}`] = {
              displayName: currentUser.displayName,
              timestamp: serverTimestamp()
            };
          } else {
            updates[`typing/${chatId}/${currentUser.uid}`] = null;
          }
        });
        
        update(ref(db), updates);
        
        pendingUpdates = {};
        timeout = null;
      }, 300);
    }
  };
})();

// Limit presence subscription to active chats
const subscribeToPresence = (userIds) => {
  if (!userIds || userIds.length === 0) return;
  
  const userStatusRefs = userIds.map(uid => ref(db, `status/${uid}`));
  
  userStatusRefs.forEach(statusRef => {
    onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const userId = statusRef.key;
        const userData = snapshot.val();
        
        setOnlineUsers(prev => ({
          ...prev,
          [userId]: userData.online || false
        }));
        
        if (userData.lastSeen) {
          setLastSeen(prev => ({
            ...prev,
            [userId]: userData.lastSeen
          }));
        }
      }
    });
  });
  
  return () => {
    userStatusRefs.forEach(statusRef => {
      off(statusRef);
    });
  };
};
```

## Technical Challenges

### Connection Reliability

One of the biggest challenges was handling unreliable connections and ensuring presence data stayed accurate:

1. **Connection Lost Detection**:

```jsx
// Integrated into PresenceProvider
useEffect(() => {
  let connectionLostTime = null;
  
  const connectedRef = ref(db, '.info/connected');
  const handleConnectionChange = (snapshot) => {
    if (snapshot.val() === false && !connectionLostTime) {
      // Connection lost
      connectionLostTime = Date.now();
    } else if (snapshot.val() === true && connectionLostTime) {
      // Reconnected
      const offlineDuration = Date.now() - connectionLostTime;
      
      // If offline for more than 1 minute, consider it a significant disconnect
      if (offlineDuration > 60000 && currentUser) {
        // Re-establish presence
        const userStatusRef = ref(db, `status/${currentUser.uid}`);
        update(userStatusRef, {
          state: 'online',
          lastSeen: serverTimestamp(),
          online: true,
          reconnected: true,
          offlineDuration
        });
      }
      
      connectionLostTime = null;
    }
  };
  
  onValue(connectedRef, handleConnectionChange);
  
  return () => off(connectedRef);
}, [currentUser]);
```

### Data Consistency

Ensuring consistent presence information across multiple devices was another challenge:

```jsx
// In user-presence.js utility
export const manageMultiDevicePresence = (userId) => {
  if (!userId) return () => {};
  
  const deviceId = generateDeviceId(); // Unique ID for this device instance
  const userStatusRef = ref(db, `status/${userId}`);
  const deviceStatusRef = ref(db, `status/${userId}/devices/${deviceId}`);
  
  // Register this device
  set(deviceStatusRef, {
    online: true,
    lastSeen: serverTimestamp(),
    userAgent: navigator.userAgent
  });
  
  // When this device disconnects
  onDisconnect(deviceStatusRef).remove();
  
  // Listen to all devices for this user
  const devicesRef = ref(db, `status/${userId}/devices`);
  
  onValue(devicesRef, (snapshot) => {
    if (snapshot.exists()) {
      // User is online if any device is online
      const devices = snapshot.val();
      const anyDeviceOnline = Object.values(devices).some(device => device.online);
      
      // Update the aggregate status
      update(userStatusRef, {
        online: anyDeviceOnline,
        deviceCount: Object.keys(devices).length,
        lastSeen: anyDeviceOnline ? null : serverTimestamp()
      });
    } else {
      // No devices online
      update(userStatusRef, {
        online: false,
        deviceCount: 0,
        lastSeen: serverTimestamp()
      });
    }
  });
  
  // Clean up
  return () => {
    off(devicesRef);
    remove(deviceStatusRef);
  };
};
```

## Future Improvements

I have several ideas to enhance the presence system:

1. **Invisible Mode** - Allow users to appear offline while still using the app.

2. **Selective Presence** - Let users choose who can see their online status.

3. **Activity Status** - Show more granular status like "Away" or "Busy" based on activity patterns.

4. **Cross-Platform Sync** - Better synchronization of presence information across web and mobile apps.

5. **Presence Analytics** - Track user engagement patterns to improve the application.

The presence system has been one of the most appreciated features by users, as it brings the chat experience closer to real-life interactions. People especially love the typing indicators as they create anticipation and make conversations feel more dynamic. 