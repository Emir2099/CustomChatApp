---
sidebar_position: 2
---

# Chat Context

The `ChatContext` is a central piece of the application that manages all chat-related state and functionality. This document explains how the Chat Context is implemented and how to use it in components.

## Overview

The Chat Context provides:

- Access to chat conversations and messages
- Methods for sending, editing, and deleting messages
- User presence and typing indicators
- File upload functionality
- Voice message recording
- Message reactions
- User blocking capabilities
- Read receipts

## Implementation

The Chat Context is implemented using React's Context API:

```jsx
// src/contexts/ChatContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ref, 
  onValue, 
  push, 
  set, 
  update, 
  remove,
  get,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp 
} from 'firebase/database';
import { 
  ref as storageRef, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Create the context
const ChatContext = createContext();

// Constants
const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  // ... other allowed types
];

export function ChatProvider({ children }) {
  // State variables
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allUsers, setAllUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [fileUploads, setFileUploads] = useState({});
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  // Get the current user from AuthContext
  const { user } = useAuth();
  
  // Other refs and state
  // ...

  // Load user data
  useEffect(() => {
    if (!user?.uid) return;
    
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        setAllUsers(snapshot.val());
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // Load user's chats
  useEffect(() => {
    if (!user?.uid) return;
    
    setLoading(true);
    const userChatsRef = ref(db, `userChats/${user.uid}`);
    
    const unsubscribe = onValue(userChatsRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setChats([]);
          setLoading(false);
          return;
        }

        const userChatsData = snapshot.val();
        const chatIds = Object.keys(userChatsData);
        
        // Get details for each chat
        const chatsData = await Promise.all(
          chatIds.map(async (chatId) => {
            const chatRef = ref(db, `chats/${chatId}`);
            const chatSnapshot = await get(chatRef);
            
            if (!chatSnapshot.exists()) return null;
            
            const chatData = chatSnapshot.val();
            return {
              id: chatId,
              ...chatData,
              ...userChatsData[chatId]
            };
          })
        );
        
        // Filter out null values and sort by last message time
        const validChats = chatsData
          .filter(chat => chat !== null)
          .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        
        setChats(validChats);
      } catch (err) {
        console.error('Error loading chats:', err);
        setError('Failed to load chats');
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // Load messages for current chat
  useEffect(() => {
    if (!currentChat?.id) {
      setMessages([]);
      return;
    }
    
    setLoading(true);
    const messagesRef = ref(db, `messages/${currentChat.id}`);
    const messagesQuery = query(
      messagesRef,
      orderByChild('timestamp'),
      limitToLast(20)
    );
    
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setMessages([]);
          setHasMoreMessages(false);
          setLoading(false);
          return;
        }
        
        const messagesObj = snapshot.val();
        const messagesList = Object.keys(messagesObj).map(key => ({
          id: key,
          ...messagesObj[key]
        }));
        
        // Sort messages by timestamp
        messagesList.sort((a, b) => a.timestamp - b.timestamp);
        
        setMessages(messagesList);
        setHasMoreMessages(true);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    });
    
    // Mark chat as read when opened
    if (user?.uid) {
      markChatAsRead(currentChat.id);
    }
    
    return () => unsubscribe();
  }, [currentChat?.id, user?.uid]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async (count = 20) => {
    if (!currentChat?.id || !messages.length || !hasMoreMessages) {
      return false;
    }
    
    try {
      // Get the oldest message timestamp
      const oldestMessage = messages[0];
      const oldestTimestamp = oldestMessage.timestamp;
      
      // Query messages before the oldest one
      const messagesRef = ref(db, `messages/${currentChat.id}`);
      const olderMessagesQuery = query(
        messagesRef,
        orderByChild('timestamp'),
        /* endAt(oldestTimestamp - 1), */
        limitToLast(count)
      );
      
      const snapshot = await get(olderMessagesQuery);
      
      if (!snapshot.exists()) {
        setHasMoreMessages(false);
        return false;
      }
      
      const messagesObj = snapshot.val();
      const messagesList = Object.keys(messagesObj)
        .map(key => ({
          id: key,
          ...messagesObj[key]
        }))
        .filter(msg => msg.timestamp < oldestTimestamp); // Filter out messages we already have
      
      if (messagesList.length === 0) {
        setHasMoreMessages(false);
        return false;
      }
      
      // Sort messages by timestamp
      messagesList.sort((a, b) => a.timestamp - b.timestamp);
      
      // Add older messages to the beginning of the list
      setMessages(prevMessages => [...messagesList, ...prevMessages]);
      
      return messagesList.length >= count; // Return true if there might be more messages
    } catch (err) {
      console.error('Error loading more messages:', err);
      setError('Failed to load more messages');
      return false;
    }
  }, [currentChat?.id, messages, hasMoreMessages]);

  // Send a text message
  const sendMessage = useCallback(async (content, replyToId = null) => {
    if (!user?.uid || !currentChat?.id || !content.trim()) {
      return null;
    }
    
    try {
      const messagesRef = ref(db, `messages/${currentChat.id}`);
      const newMessageRef = push(messagesRef);
      const messageId = newMessageRef.key;
      
      const messageData = {
        content: content.trim(),
        sender: user.uid,
        timestamp: Date.now(),
        replyTo: replyToId,
        readBy: {
          [user.uid]: Date.now()
        }
      };
      
      await set(newMessageRef, messageData);
      
      // Update chat's last message
      const chatRef = ref(db, `chats/${currentChat.id}`);
      await update(chatRef, {
        lastMessage: {
          content: content.trim().substring(0, 50) + (content.length > 50 ? '...' : ''),
          sender: user.uid,
          timestamp: messageData.timestamp
        },
        lastMessageTime: messageData.timestamp
      });
      
      // Update unread counts for other participants
      if (currentChat.type === 'private') {
        const participants = Object.keys(currentChat.participants || {});
        const otherUserId = participants.find(id => id !== user.uid);
        
        if (otherUserId) {
          const userChatRef = ref(db, `userChats/${otherUserId}/${currentChat.id}`);
          const snapshot = await get(userChatRef);
          const userData = snapshot.val() || {};
          
          await update(userChatRef, {
            unreadCount: (userData.unreadCount || 0) + 1
          });
        }
      } else if (currentChat.type === 'group') {
        const members = Object.keys(currentChat.members || {});
        
        // Update unread count for all members except the sender
        for (const memberId of members) {
          if (memberId !== user.uid) {
            const userChatRef = ref(db, `userChats/${memberId}/${currentChat.id}`);
            const snapshot = await get(userChatRef);
            const userData = snapshot.val() || {};
            
            await update(userChatRef, {
              unreadCount: (userData.unreadCount || 0) + 1
            });
          }
        }
      }
      
      return messageId;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return null;
    }
  }, [user, currentChat]);

  // Send a file message
  const sendFileMessage = useCallback(async (file, progressCallback, replyToId = null) => {
    if (!user?.uid || !currentChat?.id || !file) {
      return null;
    }
    
    try {
      // Create a placeholder for the file message
      const messagesRef = ref(db, `messages/${currentChat.id}`);
      const newMessageRef = push(messagesRef);
      const messageId = newMessageRef.key;
      
      // Generate a unique file name
      const fileExtension = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `chat/${currentChat.id}/${fileName}`;
      
      // Create file upload entry
      const uploadId = uuidv4();
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: {
          id: uploadId,
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        }
      }));
      
      // Upload file to storage
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);
      
      // Monitor upload progress
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          
          setFileUploads(prev => ({
            ...prev,
            [uploadId]: {
              ...prev[uploadId],
              progress
            }
          }));
          
          if (progressCallback) {
            progressCallback(progress);
          }
        },
        (error) => {
          console.error('Error uploading file:', error);
          setFileUploads(prev => ({
            ...prev,
            [uploadId]: {
              ...prev[uploadId],
              status: 'error',
              error: error.message
            }
          }));
        },
        async () => {
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Create message with file data
            const messageData = {
              type: 'file',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileURL: downloadURL,
              sender: user.uid,
              timestamp: Date.now(),
              replyTo: replyToId,
              readBy: {
                [user.uid]: Date.now()
              }
            };
            
            // For image files, add dimensions and thumbnail
            if (file.type.startsWith('image/')) {
              messageData.isImage = true;
              
              // We could add image dimensions here if needed
              // messageData.imageDimensions = { width, height };
            }
            
            // Save message to database
            await set(newMessageRef, messageData);
            
            // Update chat's last message
            const chatRef = ref(db, `chats/${currentChat.id}`);
            await update(chatRef, {
              lastMessage: {
                content: `Sent a file: ${file.name}`,
                sender: user.uid,
                timestamp: messageData.timestamp,
                type: 'file'
              },
              lastMessageTime: messageData.timestamp
            });
            
            // Update file upload status
            setFileUploads(prev => ({
              ...prev,
              [uploadId]: {
                ...prev[uploadId],
                status: 'complete',
                progress: 100
              }
            }));
            
            return messageId;
          } catch (err) {
            console.error('Error completing file upload:', err);
            setFileUploads(prev => ({
              ...prev,
              [uploadId]: {
                ...prev[uploadId],
                status: 'error',
                error: err.message
              }
            }));
            return null;
          }
        }
      );
      
      return messageId;
    } catch (err) {
      console.error('Error sending file message:', err);
      setError('Failed to send file');
      return null;
    }
  }, [user, currentChat]);

  // Send a voice message
  const sendVoiceMessage = useCallback(async (audioBlob, duration, replyToId = null) => {
    if (!user?.uid || !currentChat?.id || !audioBlob) {
      return null;
    }
    
    try {
      // Create a placeholder for the voice message
      const messagesRef = ref(db, `messages/${currentChat.id}`);
      const newMessageRef = push(messagesRef);
      const messageId = newMessageRef.key;
      
      // Generate a unique file name
      const fileName = `voice_${uuidv4()}.mp3`;
      const filePath = `chat/${currentChat.id}/${fileName}`;
      
      // Create file upload entry
      const uploadId = uuidv4();
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: {
          id: uploadId,
          fileName,
          progress: 0,
          status: 'uploading'
        }
      }));
      
      // Upload audio to storage
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, audioBlob);
      
      // Monitor upload progress
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          
          setFileUploads(prev => ({
            ...prev,
            [uploadId]: {
              ...prev[uploadId],
              progress
            }
          }));
        },
        (error) => {
          console.error('Error uploading voice message:', error);
          setFileUploads(prev => ({
            ...prev,
            [uploadId]: {
              ...prev[uploadId],
              status: 'error',
              error: error.message
            }
          }));
        },
        async () => {
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Create message with voice data
            const messageData = {
              type: 'voice',
              fileURL: downloadURL,
              duration: duration || 0,
              sender: user.uid,
              timestamp: Date.now(),
              replyTo: replyToId,
              readBy: {
                [user.uid]: Date.now()
              }
            };
            
            // Save message to database
            await set(newMessageRef, messageData);
            
            // Update chat's last message
            const chatRef = ref(db, `chats/${currentChat.id}`);
            await update(chatRef, {
              lastMessage: {
                content: 'Sent a voice message',
                sender: user.uid,
                timestamp: messageData.timestamp,
                type: 'voice'
              },
              lastMessageTime: messageData.timestamp
            });
            
            // Update file upload status
            setFileUploads(prev => ({
              ...prev,
              [uploadId]: {
                ...prev[uploadId],
                status: 'complete',
                progress: 100
              }
            }));
            
            return messageId;
          } catch (err) {
            console.error('Error completing voice message upload:', err);
            setFileUploads(prev => ({
              ...prev,
              [uploadId]: {
                ...prev[uploadId],
                status: 'error',
                error: err.message
              }
            }));
            return null;
          }
        }
      );
      
      return messageId;
    } catch (err) {
      console.error('Error sending voice message:', err);
      setError('Failed to send voice message');
      return null;
    }
  }, [user, currentChat]);

  // Update typing status
  const setTypingStatus = useCallback((isTyping) => {
    if (!user?.uid || !currentChat?.id) {
      return;
    }
    
    const typingRef = ref(db, `typing/${currentChat.id}/${user.uid}`);
    
    update(typingRef, {
      isTyping,
      timestamp: Date.now()
    }).catch(err => {
      console.error('Error updating typing status:', err);
    });
  }, [user, currentChat]);

  // Listen for typing indicators
  useEffect(() => {
    if (!currentChat?.id) {
      setTypingUsers({});
      return;
    }
    
    const typingRef = ref(db, `typing/${currentChat.id}`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      if (!snapshot.exists()) {
        setTypingUsers({});
        return;
      }
      
      const typing = snapshot.val();
      setTypingUsers(typing);
    });
    
    return () => unsubscribe();
  }, [currentChat?.id]);

  // Edit a message
  const editMessage = useCallback(async (messageId, newContent) => {
    if (!user?.uid || !currentChat?.id || !messageId || !newContent.trim()) {
      return false;
    }
    
    try {
      const messageRef = ref(db, `messages/${currentChat.id}/${messageId}`);
      const snapshot = await get(messageRef);
      
      if (!snapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = snapshot.val();
      
      // Check if current user is the sender
      if (message.sender !== user.uid) {
        throw new Error('You can only edit your own messages');
      }
      
      // Update message content
      await update(messageRef, {
        content: newContent.trim(),
        edited: true,
        editedAt: Date.now()
      });
      
      // If this was the last message, update the chat preview
      const chatRef = ref(db, `chats/${currentChat.id}`);
      const chatSnapshot = await get(chatRef);
      
      if (chatSnapshot.exists()) {
        const chat = chatSnapshot.val();
        
        if (chat.lastMessage && chat.lastMessage.timestamp === message.timestamp) {
          await update(chatRef, {
            lastMessage: {
              ...chat.lastMessage,
              content: newContent.trim().substring(0, 50) + (newContent.length > 50 ? '...' : '')
            }
          });
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error editing message:', err);
      setError(err.message || 'Failed to edit message');
      return false;
    }
  }, [user, currentChat]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId) => {
    if (!user?.uid || !currentChat?.id || !messageId) {
      return false;
    }
    
    try {
      const messageRef = ref(db, `messages/${currentChat.id}/${messageId}`);
      const snapshot = await get(messageRef);
      
      if (!snapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = snapshot.val();
      
      // Check if current user is the sender
      if (message.sender !== user.uid) {
        // Also allow admins to delete messages in groups
        const isAdmin = currentChat.type === 'group' && 
          currentChat.members && 
          currentChat.members[user.uid] && 
          currentChat.members[user.uid].role === 'admin';
        
        if (!isAdmin) {
          throw new Error('You can only delete your own messages');
        }
      }
      
      // For file messages, delete the file from storage
      if (message.type === 'file' || message.type === 'voice') {
        const fileURL = message.fileURL;
        if (fileURL) {
          try {
            // Extract the file path from the URL
            const url = new URL(fileURL);
            const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
            const fileRef = storageRef(storage, path);
            
            await deleteObject(fileRef);
          } catch (fileErr) {
            console.error('Error deleting file:', fileErr);
            // Continue with message deletion even if file deletion fails
          }
        }
      }
      
      // Soft delete the message by updating it
      await update(messageRef, {
        deleted: true,
        content: message.type === 'file' || message.type === 'voice' 
          ? undefined 
          : 'This message has been deleted',
        fileURL: undefined,
        fileName: undefined,
        fileSize: undefined,
        fileThumbnail: undefined
      });
      
      // If this was the last message, update the chat preview
      const chatRef = ref(db, `chats/${currentChat.id}`);
      const chatSnapshot = await get(chatRef);
      
      if (chatSnapshot.exists()) {
        const chat = chatSnapshot.val();
        
        if (chat.lastMessage && chat.lastMessage.timestamp === message.timestamp) {
          await update(chatRef, {
            lastMessage: {
              content: 'This message has been deleted',
              sender: message.sender,
              timestamp: message.timestamp,
              type: 'deleted'
            }
          });
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      setError(err.message || 'Failed to delete message');
      return false;
    }
  }, [user, currentChat]);

  // Mark a chat as read
  const markChatAsRead = useCallback(async (chatId) => {
    if (!user?.uid || !chatId) {
      return;
    }
    
    try {
      // Update user chat data
      const userChatRef = ref(db, `userChats/${user.uid}/${chatId}`);
      await update(userChatRef, {
        unreadCount: 0,
        lastReadTime: Date.now()
      });
      
      // Mark all messages as read by this user
      const messagesRef = ref(db, `messages/${chatId}`);
      const snapshot = await get(messagesRef);
      
      if (snapshot.exists()) {
        const messages = snapshot.val();
        const updates = {};
        
        Object.keys(messages).forEach(messageId => {
          const message = messages[messageId];
          
          if (message.sender !== user.uid) {
            updates[`messages/${chatId}/${messageId}/readBy/${user.uid}`] = Date.now();
          }
        });
        
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }
    } catch (err) {
      console.error('Error marking chat as read:', err);
    }
  }, [user]);

  // Check if current user is admin in group chat
  const isCurrentUserAdmin = useCallback(() => {
    if (!user?.uid || !currentChat?.id || currentChat.type !== 'group') {
      return false;
    }
    
    return currentChat.members && 
      currentChat.members[user.uid] && 
      currentChat.members[user.uid].role === 'admin';
  }, [user, currentChat]);

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

  // Function to check if a user is blocked
  const isUserBlocked = useCallback((userId) => {
    if (!user?.uid || !userId || !allUsers?.[user.uid]?.blockedUsers) return false;
    
    // Check if userId is in current user's blocked list
    return !!allUsers[user.uid]?.blockedUsers?.[userId];
  }, [user, allUsers]);

  // Create the context value
  const contextValue = {
    chats,
    currentChat,
    setCurrentChat,
    messages,
    sendMessage,
    sendFileMessage,
    sendVoiceMessage,
    loading,
    error,
    allUsers,
    fileUploads,
    typingUsers,
    setTypingStatus,
    loadMoreMessages,
    hasMoreMessages,
    editMessage,
    deleteMessage,
    markChatAsRead,
    isCurrentUserAdmin,
    blockUser,
    unblockUser,
    isUserBlocked,
    FILE_SIZE_LIMIT,
    ALLOWED_FILE_TYPES
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// Custom hook to use the chat context
export function useChat() {
  return useContext(ChatContext);
}

## Using the Chat Context

Components can access the Chat Context through the `useChat` hook:

```jsx
import { useChat } from '../../contexts/ChatContext';

function ChatComponent() {
  const { 
    currentChat, 
    messages, 
    sendMessage,
    loading 
  } = useChat();
  
  // Component logic using chat functionality
  // ...
}
```

## Key Functions

### Message Management

#### Send a Text Message

```jsx
// Send a new text message
const { sendMessage } = useChat();

const handleSend = (e) => {
  e.preventDefault();
  if (!newMessage.trim()) return;
  
  sendMessage(newMessage);
  setNewMessage('');
};
```

#### Send a File Message

```jsx
// Send a file message
const { sendFileMessage } = useChat();

const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const onProgress = (progress) => {
    console.log(`Upload progress: ${progress}%`);
  };
  
  await sendFileMessage(file, onProgress);
};
```

## Best Practices

When using the Chat Context, follow these best practices:

1. **Cleanup subscriptions**: Be sure to clean up any additional subscriptions or timers in useEffect cleanup functions
2. **Optimistic updates**: For better UX, update the UI optimistically before waiting for Firebase confirmations
3. **Debounce typing updates**: Debounce typing indicator updates to reduce database writes
4. **Error boundaries**: Wrap chat components in error boundaries to gracefully handle errors
5. **Loading states**: Show appropriate loading UI while data is being fetched or sent

## Customization

The Chat Context can be customized and extended:

1. **Add new message types**: Extend the message sending functions to support new types
2. **Modify storage paths**: Change where files are stored in Firebase Storage
3. **Add caching**: Implement local caching for faster loading and offline support
4. **Add analytics**: Track message sending and reading for analytics
5. **Enhance security**: Add additional checks and validations for message operations