---
sidebar_position: 13
---

# Announcements Feature

I added the announcements feature to help group owners and admins communicate important information to all members. Unlike regular messages, announcements stand out visually and can be pinned to the top of chats.

## How Announcements Work

The announcements system follows this basic flow:

1. An admin creates an announcement with special formatting
2. The announcement is sent to the chat as a special message type
3. The announcement can optionally be pinned to stay visible
4. Users can acknowledge announcements (optional feature)

## Announcement Data Structure

I store announcements as special message types in the chat:

```json
{
  "id": "message-123456",
  "type": "announcement", 
  "sender": "userABC",
  "senderName": "Admin User",
  "senderPhotoURL": "https://example.com/photo.jpg",
  "content": "The system will be down for maintenance tomorrow from 2-4pm",
  "timestamp": 1650120000000,
  "isPinned": true,
  "priority": "high", 
  "styling": {
    "backgroundColor": "#FFF4E5",
    "icon": "warning"
  },
  "acknowledgements": {
    "user1": 1650120500000,
    "user2": 1650120800000
  }
}
```

## Creating Announcements

I implemented announcements as a special message function in the ChatContext:

```jsx
// In ChatContext.jsx
const sendAnnouncement = async (content, options = {}) => {
  if (!currentChat?.id || !user?.uid || !content.trim()) {
    return null;
  }
  
  try {
    // Check if user has permission to send announcements
    if (!isCurrentUserAdmin()) {
      throw new Error('Only admins can send announcements');
    }
    
    const messageRef = push(ref(db, `messages/${currentChat.id}`));
    const messageId = messageRef.key;
    
    const { isPinned = false, priority = 'normal' } = options;
    
    // Set styling based on priority
    let styling = {};
    switch (priority) {
      case 'high':
        styling = {
          backgroundColor: '#FFF4E5',
          icon: 'warning'
        };
        break;
      case 'medium':
        styling = {
          backgroundColor: '#E8F4FD',
          icon: 'info'
        };
        break;
      default:
        styling = {
          backgroundColor: '#F0F0F0',
          icon: 'bell'
        };
    }
    
    const announcement = {
      id: messageId,
      type: 'announcement',
      sender: user.uid,
      senderName: user.displayName,
      senderPhotoURL: user.photoURL,
      content,
      timestamp: serverTimestamp(),
      isPinned,
      priority,
      styling,
      acknowledgements: {},
      readBy: {
        [user.uid]: serverTimestamp()
      }
    };
    
    await set(messageRef, announcement);
    
    // If pinned, update chat with reference to this announcement
    if (isPinned) {
      await update(ref(db, `chats/${currentChat.id}`), {
        pinnedAnnouncement: messageId
      });
    }
    
    // Update last message in chat
    await update(ref(db, `chats/${currentChat.id}`), {
      lastMessage: {
        content: `📣 Announcement: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        sender: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      },
      lastMessageTime: serverTimestamp()
    });
    
    return messageId;
  } catch (error) {
    console.error('Error sending announcement:', error);
    return null;
  }
};
```

## Admin Announcement UI

I created a special UI for admins to create announcements:

```jsx
// src/components/chat/AnnouncementCreator.jsx
import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './AnnouncementCreator.module.css';

export default function AnnouncementCreator({ onClose }) {
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { sendAnnouncement } = useChat();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!content.trim()) {
      setError('Announcement content is required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await sendAnnouncement(content, { isPinned, priority });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send announcement');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={styles.announcementCreator}>
      <h3>Create Announcement</h3>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="content">Announcement</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter important information to announce..."
            rows={4}
            maxLength={500}
            required
          />
          <div className={styles.charCount}>
            {content.length}/500
          </div>
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <div className={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="isPinned"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
          />
          <label htmlFor="isPinned">
            Pin this announcement to the top of the chat
          </label>
        </div>
        
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button
            type="submit"
            className={styles.createButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

## Displaying Announcements

I created a special component to display announcements in the chat:

```jsx
// src/components/chat/AnnouncementMessage.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import UserAvatar from '../common/UserAvatar';
import { formatDate } from '../../utils/dateUtils';
import styles from './AnnouncementMessage.module.css';

export default function AnnouncementMessage({ message, isPinned }) {
  const { user } = useAuth();
  const { acknowledgeAnnouncement, updatePinnedAnnouncement } = useChat();
  
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  
  const {
    id,
    content,
    senderName,
    senderPhotoURL,
    timestamp,
    priority,
    styling,
    acknowledgements = {}
  } = message;
  
  const isAdmin = useChat().isCurrentUserAdmin();
  
  // Check if the current user has acknowledged this announcement
  const hasAcknowledged = Object.prototype.hasOwnProperty.call(
    acknowledgements, 
    user?.uid
  );
  
  // Count acknowledgements
  const acknowledgementsCount = Object.keys(acknowledgements).length;
  
  // Icon based on priority
  const getIcon = () => {
    switch (priority) {
      case 'high':
        return '⚠️';
      case 'medium':
        return 'ℹ️';
      default:
        return '🔔';
    }
  };
  
  // Handle acknowledgement
  const handleAcknowledge = async () => {
    if (isAcknowledging || hasAcknowledged) return;
    
    setIsAcknowledging(true);
    
    try {
      await acknowledgeAnnouncement(message.id);
    } catch (error) {
      console.error('Error acknowledging announcement:', error);
    } finally {
      setIsAcknowledging(false);
    }
  };
  
  // Handle pin/unpin for admins
  const handleTogglePin = async () => {
    try {
      await updatePinnedAnnouncement(message.id, !isPinned);
    } catch (error) {
      console.error('Error updating pinned status:', error);
    }
  };
  
  return (
    <div 
      className={`${styles.announcement} ${styles[priority]} ${isPinned ? styles.pinned : ''}`}
      style={{ backgroundColor: styling?.backgroundColor }}
    >
      {isPinned && (
        <div className={styles.pinnedIndicator}>
          📌 Pinned Announcement
        </div>
      )}
      
      <div className={styles.announcementIcon}>
        {getIcon()}
      </div>
      
      <div className={styles.announcementContent}>
        <div className={styles.announcementHeader}>
          <div className={styles.senderInfo}>
            <UserAvatar src={senderPhotoURL} name={senderName} size="small" />
            <span className={styles.senderName}>{senderName}</span>
          </div>
          
          <div className={styles.timestamp}>
            {timestamp ? formatDate(timestamp) : 'Sending...'}
          </div>
        </div>
        
        <div className={styles.announcementBody}>
          {content}
        </div>
        
        <div className={styles.announcementFooter}>
          <div className={styles.acknowledgements}>
            {acknowledgementsCount > 0 && (
              <span>
                {acknowledgementsCount} acknowledgement{acknowledgementsCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className={styles.actionButtons}>
            {isAdmin && (
              <button 
                className={styles.pinButton}
                onClick={handleTogglePin}
              >
                {isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
            
            {!hasAcknowledged && (
              <button
                className={styles.acknowledgeButton}
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
              >
                {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Pinned Announcements

To ensure important announcements stay visible, I added a pinning feature:

```jsx
// In ChatArea.jsx
const [pinnedAnnouncement, setPinnedAnnouncement] = useState(null);

// Fetch pinned announcement when chat changes
useEffect(() => {
  if (!currentChat?.id) return;
  
  const fetchPinnedAnnouncement = async () => {
    try {
      const chatRef = ref(db, `chats/${currentChat.id}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) return;
      
      const chatData = chatSnapshot.val();
      
      if (chatData.pinnedAnnouncement) {
        // Fetch the announcement message
        const messageRef = ref(db, `messages/${currentChat.id}/${chatData.pinnedAnnouncement}`);
        const messageSnapshot = await get(messageRef);
        
        if (messageSnapshot.exists()) {
          const announcementData = {
            id: messageSnapshot.key,
            ...messageSnapshot.val()
          };
          
          setPinnedAnnouncement(announcementData);
        } else {
          // The pinned announcement was deleted, clear the reference
          await update(chatRef, { pinnedAnnouncement: null });
          setPinnedAnnouncement(null);
        }
      } else {
        setPinnedAnnouncement(null);
      }
    } catch (error) {
      console.error('Error fetching pinned announcement:', error);
    }
  };
  
  fetchPinnedAnnouncement();
}, [currentChat?.id]);

// Render the pinned announcement in the chat area
return (
  <div className={styles.chatArea}>
    {pinnedAnnouncement && (
      <div className={styles.pinnedContainer}>
        <AnnouncementMessage
          message={pinnedAnnouncement}
          isPinned={true}
        />
      </div>
    )}
    
    <div className={styles.messagesContainer}>
      {renderMessages()}
    </div>
  </div>
);
```

## Acknowledgement System

I added functionality for users to acknowledge they've read important announcements:

```jsx
// In ChatContext.jsx
const acknowledgeAnnouncement = async (announcementId) => {
  if (!currentChat?.id || !user?.uid || !announcementId) return;
  
  try {
    const messageRef = ref(db, `messages/${currentChat.id}/${announcementId}`);
    
    // Update the acknowledgements list
    await update(messageRef, {
      [`acknowledgements/${user.uid}`]: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error acknowledging announcement:', error);
    return false;
  }
};

const updatePinnedAnnouncement = async (announcementId, shouldPin) => {
  if (!currentChat?.id || !user?.uid || !announcementId) return;
  
  try {
    // Check permissions
    if (!isCurrentUserAdmin()) {
      throw new Error('Only admins can pin/unpin announcements');
    }
    
    // Update the announcement pinned status
    await update(ref(db, `messages/${currentChat.id}/${announcementId}`), {
      isPinned: shouldPin
    });
    
    // Update the chat's pinnedAnnouncement reference
    if (shouldPin) {
      await update(ref(db, `chats/${currentChat.id}`), {
        pinnedAnnouncement: announcementId
      });
    } else {
      // Check if this is the currently pinned announcement
      const chatRef = ref(db, `chats/${currentChat.id}`);
      const chatSnapshot = await get(chatRef);
      
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();
        
        if (chatData.pinnedAnnouncement === announcementId) {
          await update(chatRef, {
            pinnedAnnouncement: null
          });
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating pinned status:', error);
    return false;
  }
};
```

## Integration with Message Input

I added an announcement button for admins in the message input:

```jsx
// In MessageInput.jsx
const { isCurrentUserAdmin } = useChat();
const [showAnnouncementCreator, setShowAnnouncementCreator] = useState(false);

// In the JSX
<div className={styles.messageInputContainer}>
  {/* Other input elements */}
  
  {isCurrentUserAdmin() && (
    <button
      type="button"
      className={styles.announcementButton}
      onClick={() => setShowAnnouncementCreator(true)}
      aria-label="Create announcement"
    >
      📣
    </button>
  )}
  
  {showAnnouncementCreator && (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <AnnouncementCreator onClose={() => setShowAnnouncementCreator(false)} />
      </div>
    </div>
  )}
</div>
```

## Technical Challenges

### Maintaining Pinned State

One challenge was making sure pinned announcements stay correctly synced:

```jsx
// In ChatContext.jsx - Add listener for pinned status changes
useEffect(() => {
  if (!currentChat?.id) return;
  
  const chatRef = ref(db, `chats/${currentChat.id}`);
  
  const unsubscribe = onValue(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      const chatData = snapshot.val();
      
      if (chatData.pinnedAnnouncement) {
        // Check if we need to fetch the pinned announcement
        if (
          !pinnedAnnouncement || 
          pinnedAnnouncement.id !== chatData.pinnedAnnouncement
        ) {
          const fetchPinnedMessage = async () => {
            try {
              const messageRef = ref(
                db, 
                `messages/${currentChat.id}/${chatData.pinnedAnnouncement}`
              );
              const messageSnapshot = await get(messageRef);
              
              if (messageSnapshot.exists()) {
                setPinnedAnnouncement({
                  id: messageSnapshot.key,
                  ...messageSnapshot.val()
                });
              } else {
                // The pinned message was deleted
                setPinnedAnnouncement(null);
                
                // Update the chat to clear the pinned reference
                await update(chatRef, { pinnedAnnouncement: null });
              }
            } catch (error) {
              console.error('Error fetching pinned announcement:', error);
            }
          };
          
          fetchPinnedMessage();
        }
      } else if (pinnedAnnouncement) {
        // Clear pinned announcement if reference was removed
        setPinnedAnnouncement(null);
      }
    }
  });
  
  return () => unsubscribe();
}, [currentChat?.id, pinnedAnnouncement]);
```

### Handling Deleted Announcements

I needed to handle cases where a pinned announcement gets deleted:

```jsx
// In ChatContext.jsx - Delete message function
const deleteMessage = async (messageId) => {
  if (!currentChat?.id || !messageId || !user?.uid) return;
  
  try {
    const messageRef = ref(db, `messages/${currentChat.id}/${messageId}`);
    const snapshot = await get(messageRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const messageData = snapshot.val();
    
    // Check permissions
    if (messageData.sender !== user.uid && !isCurrentUserAdmin()) {
      throw new Error("You don't have permission to delete this message");
    }
    
    // Special handling for announcements
    if (messageData.type === 'announcement') {
      // Check if this is a pinned announcement
      const chatRef = ref(db, `chats/${currentChat.id}`);
      const chatSnapshot = await get(chatRef);
      
      if (
        chatSnapshot.exists() && 
        chatSnapshot.val().pinnedAnnouncement === messageId
      ) {
        // Remove pinned reference
        await update(chatRef, { pinnedAnnouncement: null });
      }
    }
    
    // Actually delete the message
    await remove(messageRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
};
```

### Styling for Different Priorities

Creating distinct visual styles for different priority announcements:

```css
/* AnnouncementMessage.module.css */
.announcement {
  margin: 10px 0;
  padding: 12px;
  border-radius: 8px;
  position: relative;
  display: flex;
  border-left: 4px solid transparent;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.announcement.normal {
  background-color: #F0F0F0;
  border-left-color: #999;
}

.announcement.medium {
  background-color: #E8F4FD;
  border-left-color: #1890FF;
}

.announcement.high {
  background-color: #FFF4E5;
  border-left-color: #FA8C16;
}

.pinnedIndicator {
  position: absolute;
  top: -12px;
  left: 12px;
  background-color: #1890FF;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pinned {
  margin-top: 16px;
}

.announcementIcon {
  margin-right: 12px;
  font-size: 24px;
  display: flex;
  align-items: center;
}
```

## Future Improvements

If I had more time to work on the announcement feature, I'd add:

1. **Scheduled Announcements** - Set announcements to post at a specific time
2. **Announcement Categories** - Tag announcements by type (maintenance, update, etc.)
3. **Required Acknowledgements** - Block chat access until important announcements are acknowledged
4. **Announcement Templates** - Pre-made templates for common announcements
5. **Announcement History** - A special view to see all past announcements
6. **Notifications** - Special push notifications for high-priority announcements

The announcement feature has been really useful for group chats, especially for larger teams where important information can easily get lost in regular conversation. 