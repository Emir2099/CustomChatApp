---
sidebar_position: 5
---

# Admin Features & Message Logs

I wanted the app to have some administrative capabilities, especially for monitoring message edits and deletions. This helps maintain accountability and provides a way to recover information if needed.

## Admin Privileges System

The admin privileges system is pretty straightforward. I store an `isAdmin` flag in the user object in Firebase:

```json
/users/{userId}: {
  // ... other user data
  "isAdmin": true
}
```

Then I added a helper function in the ChatContext to check if the current user has admin privileges:

```jsx
// In ChatContext.jsx
const isCurrentUserAdmin = useCallback(() => {
  return user && userData && userData.isAdmin === true;
}, [user, userData]);
```

This isn't exactly Fort Knox security-wise, but it's good enough for our purposes. In a production app, I'd use Firebase security rules to restrict certain operations based on admin status.

## Message Logs System

The message logs system tracks all edits and deletions in a dedicated collection:

```json
/logs/{chatId}/{logId}: {
  "messageId": "abc123",
  "type": "EDIT",        // or "DELETE"
  "performedBy": "userId",
  "timestamp": 1650120050000,
  "originalContent": "Hello there",
  "newContent": "Hello everyone" // Only for EDIT logs
}
```

### Implementing the Logs in ChatContext

I added several new functions to the ChatContext to handle logs:

```jsx
// src/contexts/ChatContext.jsx
const [logs, setLogs] = useState([]);

// Function to record a log when a message is edited
const logMessageEdit = async (chatId, messageId, originalContent, newContent) => {
  try {
    const logRef = push(ref(db, `logs/${chatId}`));
    
    await set(logRef, {
      messageId,
      type: 'EDIT',
      performedBy: user.uid,
      performedByName: user.displayName,
      timestamp: serverTimestamp(),
      originalContent,
      newContent
    });
    
    console.log('Edit log created');
  } catch (error) {
    console.error('Error creating edit log:', error);
  }
};

// Function to record a log when a message is deleted
const logMessageDelete = async (chatId, messageId, originalContent) => {
  try {
    const logRef = push(ref(db, `logs/${chatId}`));
    
    await set(logRef, {
      messageId,
      type: 'DELETE',
      performedBy: user.uid,
      performedByName: user.displayName,
      timestamp: serverTimestamp(),
      originalContent
    });
    
    console.log('Delete log created');
  } catch (error) {
    console.error('Error creating delete log:', error);
  }
};

// Function to fetch logs for a specific chat
const fetchChatLogs = useCallback(async (chatId) => {
  if (!isCurrentUserAdmin() || !chatId) {
    return [];
  }
  
  try {
    const logsRef = ref(db, `logs/${chatId}`);
    const snapshot = await get(logsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const logsData = snapshot.val();
    const logsList = Object.keys(logsData).map(key => ({
      id: key,
      ...logsData[key]
    }));
    
    // Sort logs by timestamp (newest first)
    return logsList.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}, [isCurrentUserAdmin]);

// Updated edit message function to include logging
const editMessage = async (chatId, messageId, newContent) => {
  if (!chatId || !messageId || !newContent.trim()) return;
  
  try {
    const messageRef = ref(db, `messages/${chatId}/${messageId}`);
    const snapshot = await get(messageRef);
    
    if (!snapshot.exists()) {
      throw new Error('Message does not exist');
    }
    
    const messageData = snapshot.val();
    
    // Check if the user can edit this message
    if (messageData.sender !== user.uid && !isCurrentUserAdmin()) {
      throw new Error('You cannot edit this message');
    }
    
    // Log the edit
    await logMessageEdit(chatId, messageId, messageData.content, newContent);
    
    // Update the message
    await update(messageRef, {
      content: newContent,
      edited: true,
      editedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error editing message:', error);
    return false;
  }
};

// Updated delete message function to include logging
const deleteMessage = async (chatId, messageId) => {
  if (!chatId || !messageId) return;
  
  try {
    const messageRef = ref(db, `messages/${chatId}/${messageId}`);
    const snapshot = await get(messageRef);
    
    if (!snapshot.exists()) {
      throw new Error('Message does not exist');
    }
    
    const messageData = snapshot.val();
    
    // Check if the user can delete this message
    if (messageData.sender !== user.uid && !isCurrentUserAdmin()) {
      throw new Error('You cannot delete this message');
    }
    
    // Log the deletion
    await logMessageDelete(chatId, messageId, messageData.content);
    
    // Mark as deleted rather than actually deleting
    await update(messageRef, {
      deleted: true,
      content: 'This message has been deleted',
      deletedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
};
```

## LogViewer Component

I created a simple UI component to view the logs:

```jsx
// src/components/chat/LogViewer.jsx
import { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './LogViewer.module.css';

export default function LogViewer({ chatId, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { fetchChatLogs } = useChat();
  
  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      const chatLogs = await fetchChatLogs(chatId);
      setLogs(chatLogs);
      setLoading(false);
    };
    
    loadLogs();
  }, [chatId, fetchChatLogs]);
  
  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  return (
    <div className={styles.logViewer}>
      <div className={styles.header}>
        <h2>Message Logs</h2>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          aria-label="Close log viewer"
        >
          ×
        </button>
      </div>
      
      {loading ? (
        <div className={styles.loading}>Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className={styles.noLogs}>No logs found for this chat</div>
      ) : (
        <div className={styles.logList}>
          {logs.map(log => (
            <div key={log.id} className={styles.logItem}>
              <div className={styles.logHeader}>
                <span className={styles.logType}>
                  {log.type === 'EDIT' ? '✏️ Edit' : '🗑️ Delete'}
                </span>
                <span className={styles.logTime}>{formatDate(log.timestamp)}</span>
              </div>
              
              <div className={styles.logUser}>
                <strong>By:</strong> {log.performedByName || 'Unknown user'}
              </div>
              
              <div className={styles.logContent}>
                <div className={styles.originalContent}>
                  <strong>Original:</strong> {log.originalContent}
                </div>
                
                {log.type === 'EDIT' && (
                  <div className={styles.newContent}>
                    <strong>Changed to:</strong> {log.newContent}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Adding the "View Logs" Button

I added a button to the chat header that's only visible to admins:

```jsx
// In ChatArea.jsx
const renderChatHeader = () => {
  return (
    <div className={styles.header}>
      {/* Other header elements */}
      
      {isCurrentUserAdmin() && (
        <button 
          className={styles.viewLogsButton}
          onClick={() => setShowLogViewer(true)}
          title="View message logs"
        >
          📋 Logs
        </button>
      )}
    </div>
  );
};

// Later in the component
return (
  <div className={styles.chatArea}>
    {renderChatHeader()}
    
    {/* Rest of the component */}
    
    {showLogViewer && (
      <LogViewer 
        chatId={currentChat.id} 
        onClose={() => setShowLogViewer(false)} 
      />
    )}
  </div>
);
```

## Styling the Log Viewer

I wanted the LogViewer to have a distinct "admin" feel:

```css
/* LogViewer.module.css */
.logViewer {
  position: absolute;
  top: 0;
  right: 0;
  width: 350px;
  height: 100%;
  background-color: #f8f9fa;
  border-left: 1px solid #dee2e6;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow-y: auto;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.header h2 {
  margin: 0;
  color: #343a40;
}

.closeButton {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.logList {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.logItem {
  background-color: white;
  border-radius: 8px;
  padding: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.logHeader {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.logType {
  font-weight: 500;
}

.logTime {
  font-size: 0.8rem;
  color: #6c757d;
}

.logUser {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.logContent {
  background-color: #f1f3f5;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.originalContent {
  margin-bottom: 0.5rem;
}

.originalContent strong,
.newContent strong {
  color: #495057;
}
```

## Technical Challenges

### Deciding What to Log

I had to think carefully about what information to include in the logs. Too much, and it would be unwieldy; too little, and it wouldn't be useful. I settled on:
- Who made the change
- When it happened
- The original content
- The new content (for edits)

This gives admins enough context without overwhelming them with details.

### Soft Deletes vs. Hard Deletes

I went with soft deletes (marking messages as deleted rather than actually removing them) for a few reasons:
1. It preserves the conversation flow
2. It allows for potential message recovery
3. It's consistent with how other chat apps handle deleted messages

### Security Considerations

I wanted to make sure that only admins could see the logs. I implemented this at multiple levels:
1. Only showing the "View Logs" button to admins
2. Checking admin status before fetching logs in the `fetchChatLogs` function
3. Planning to add Firebase security rules to restrict access to the logs collection

## Future Improvements

If I had more time, I'd enhance this feature with:
1. More detailed filtering options for logs (by user, action type, date range)
2. Ability to revert message edits or restore deleted messages
3. Export logs to CSV/PDF for record-keeping
4. More detailed admin analytics (message frequency, peak usage times)
5. Additional log types (user joins/leaves, file uploads, etc.)

Working on this feature has taught me a lot about balancing transparency and privacy. While we want to track changes for moderation purposes, we also need to respect user privacy and not log unnecessary information. 