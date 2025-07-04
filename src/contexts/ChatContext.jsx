import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../config/firebase';
import { ref, onValue, push, set, update, get, serverTimestamp, onChildAdded, onChildChanged, onChildRemoved } from 'firebase/database';
import { useAuth } from './AuthContext';
import PropTypes from 'prop-types';

const ChatContext = createContext();

// Add file size limit constant
const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB
// Define allowed file types
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg'
];

// Helper function to check if objects are deeply equal
const isEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => {
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      return isEqual(val1, val2);
    }
    return val1 === val2;
  });
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

export function ChatProvider({ children }) {
  const [currentChat, setCurrentChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [polls, setPolls] = useState([]);
  const [inviteLink, setInviteLink] = useState('');
  const [fileUploads, setFileUploads] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loading, setLoading] = useState(true);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState({});
  const [logs, setLogs] = useState([]);
  
  // Use refs to track previous values and listeners
  const chatListenersRef = useRef([]);
  const prevChatsRef = useRef({});
  const markingChatAsReadRef = useRef(false);
  const currentChatRef = useRef(null);
  const membersCache = useRef(new Map());
  const prevMembersRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const messagesMapRef = useRef(new Map());
  const messagesLimitRef = useRef(20);
  
  // Load more messages function - initialize it outside useEffect
  const loadMoreMessages = useCallback((count) => {
    // Get all messages sorted by timestamp
    const allMessages = Array.from(messagesMapRef.current.values())
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    const totalMessages = allMessages.length;
    
    // If we already show all messages, nothing more to load
    // Make this check more strict to ensure we properly detect when all messages are loaded
    if (messagesLimitRef.current >= totalMessages) {
      setHasMoreMessages(false);
      return Promise.resolve(false);
    }
    
    // Track the previous limit to detect if we actually loaded more messages
    const previousLimit = messagesLimitRef.current;
    
    // Increase the limit, but don't exceed total message count
    const newLimit = Math.min(messagesLimitRef.current + count, totalMessages);
    messagesLimitRef.current = newLimit;
    
    // Check if we've loaded all messages or if the limit didn't increase
    // (which would indicate we've reached the top)
    const hasMore = newLimit < totalMessages && newLimit > previousLimit;
    
    // If we've loaded all messages or didn't load any new ones, set hasMore to false
    if (!hasMore || totalMessages - newLimit < 5) {
      setHasMoreMessages(false);
    } else {
      setHasMoreMessages(true);
    }
    
    // IMPORTANT FIX: Get the current messages first to avoid flickering
    // and maintain message continuity when scrolling
    const currentMessages = [...messages];
    
    // Get messages to show - using the simple slice approach
    const messagesToShow = allMessages.slice(0, newLimit);
    
    // Log diagnostic info
    console.log(`Messages loaded: ${messagesToShow.length}, Total: ${totalMessages}, Has more: ${hasMore}`);
    
    // IMPORTANT FIX: Only update if we have more messages than before
    // This prevents message flickering when scrolling
    if (messagesToShow.length >= currentMessages.length) {
      setMessages(messagesToShow);
    }
    
    return Promise.resolve(hasMore);
  }, [messages]);
  
  // Memoize functions to prevent them from changing on each render
  const clearInviteLink = useCallback(() => {
    setInviteLink('');
  }, []);

  // Memoize markChatAsRead to avoid dependency loops
  const markChatAsRead = useCallback(async (chatId) => {
    if (!user || !chatId || markingChatAsReadRef.current) return;
    
    try {
      markingChatAsReadRef.current = true;
      
      const updates = {};
      updates[`users/${user.uid}/chats/${chatId}/lastRead`] = serverTimestamp();
      await update(ref(db), updates);
      
      setChats(prev => {
        const newChats = prev.map(chat => 
          chat.id === chatId 
            ? { 
                ...chat, 
                unreadMessages: 0, 
                unreadAnnouncements: 0, 
                unreadPolls: 0 
              } 
            : chat
        );
        return newChats;
      });
    } catch (error) {
      console.error('Error marking chat as read:', error);
    } finally {
      markingChatAsReadRef.current = false;
    }
  }, [user]);

  // Memoize handleChatSelect
  const handleChatSelect = useCallback(async (chat) => {
    if (!chat) return;
    
    // Deep clone the chat object to ensure we break reference equality
    const chatClone = JSON.parse(JSON.stringify(chat));
    
    // Only update if the chat is different from current one
    if (isEqual(chatClone, currentChatRef.current)) return;
    
    // Store a clone to avoid reference comparisons
    currentChatRef.current = chatClone;
    setCurrentChat(chatClone);
    
    if (chat && chat.id) {
      // Debounce the markChatAsRead call to prevent race conditions
      const timeoutId = setTimeout(() => {
        markChatAsRead(chat.id);
      }, 100);
      
      // Store the timeout ID to clear it if needed
      return () => clearTimeout(timeoutId);
    }
  }, [markChatAsRead]);

  // Memoize the generateInviteLink function
  const generateInviteLink = useCallback(async (chatId) => {
    try {
      const linkId = Math.random().toString(36).substring(2, 15);
      
      await update(ref(db, `chats/${chatId}/info`), {
        inviteLink: linkId,
        lastUpdated: Date.now()
      });
      
      const linkUrl = `${window.location.origin}/invite/${chatId}/${linkId}`;
      setInviteLink(linkUrl);
      return linkUrl;
    } catch (error) {
      console.error('Error generating invite link:', error);
      throw error;
    }
  }, []);

  // Listen to user's chats
  useEffect(() => {
    if (!user) return;
    
    // Set loading to true when user changes
    setLoading(true);
    setChatsLoading(true);
    
    // Clean up previous listeners
    const cleanupListeners = () => {
      chatListenersRef.current.forEach(listener => listener());
      chatListenersRef.current = [];
    };

    const userChatsRef = ref(db, `users/${user.uid}/chats`);
    
    const unsubscribe = onValue(userChatsRef, (snapshot) => {
      // Clean up existing listeners
      cleanupListeners();
      
      const chatIds = snapshot.val() || {};
      
      if (Object.keys(chatIds).length === 0) {
        // No chat IDs, set loading to false immediately
        setLoading(false);
        setChatsLoading(false);
      }
      
      // Track how many chats have been processed
      let processedChats = 0;
      const totalChats = Object.keys(chatIds).length;
      
      Object.keys(chatIds).forEach(chatId => {
        const chatRef = ref(db, `chats/${chatId}`);
        const userLastReadRef = ref(db, `users/${user.uid}/chats/${chatId}/lastRead`);
        
        const chatListener = onValue(chatRef, async (chatSnapshot) => {
          try {
            const chatData = chatSnapshot.val();
            if (!chatData) {
              processedChats++;
              if (processedChats >= totalChats) {
                setLoading(false);
                setChatsLoading(false);
              }
              return;
            }
            
            const userLastReadSnapshot = await get(userLastReadRef);
            const lastRead = userLastReadSnapshot.val() || 0;
            
            // Count different types of unread items
            let unreadMessages = 0;
            let unreadAnnouncements = 0;
            let unreadPolls = 0;

            if (chatData.messages) {
              Object.values(chatData.messages).forEach(msg => {
                if (msg.timestamp > lastRead && msg.sender !== user.uid) {
                  if (msg.type === 'announcement') {
                    unreadAnnouncements++;
                  } else if (msg.type === 'poll') {
                    unreadPolls++;
                  } else {
                    unreadMessages++;
                  }
                }
              });
            }

            const newChatData = { 
              id: chatId, 
              ...chatData.info,
              unreadMessages,
              unreadAnnouncements,
              unreadPolls,
              memberCount: Object.keys(chatData.members || {}).length
            };
            
            // Only update if the data has actually changed
            const prevChatData = prevChatsRef.current[chatId];
            if (prevChatData && isEqual(prevChatData, newChatData)) {
              processedChats++;
              if (processedChats >= totalChats) {
                setLoading(false);
                setChatsLoading(false);
              }
              return;
            }
            
            // Save the new chat data for future comparison
            prevChatsRef.current[chatId] = newChatData;
            
            // Update state with immutable pattern
            setChats(prev => {
              const updated = [
                ...prev.filter(c => c.id !== chatId),
                newChatData
              ];
              return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            });
            
            processedChats++;
            if (processedChats >= totalChats) {
              setLoading(false);
              setChatsLoading(false);
            }
          } catch (error) {
            console.error('Error handling chat update:', error);
            processedChats++;
            if (processedChats >= totalChats) {
              setLoading(false);
              setChatsLoading(false);
            }
          }
        });
        
        chatListenersRef.current.push(chatListener);
      });
    });
    
    return () => {
      unsubscribe();
      cleanupListeners();
    };
  }, [user]);

  // Listen to messages for the current chat
  useEffect(() => {
    if (!currentChat?.id || !user) return;
    
    let isMounted = true;
    const messagesRef = ref(db, `chats/${currentChat.id}/messages`);
    
    // Track connection state to handle reconnections properly
    let reconnectHandler = null;
    
    // Check if we're reconnecting to avoid resetting message state
    let isReconnecting = false;
    
    // Setup connection monitoring for this specific feature
    const connectedRef = ref(db, '.info/connected');
    const connectionListener = onValue(connectedRef, (snapshot) => {
      // If we're reconnecting and the component is still mounted
      if (snapshot.val() && isReconnecting && isMounted) {
        // Set a flag to avoid clearing messages on reconnect
        isReconnecting = false;
        
        // After reconnection, make sure message state is synced properly
        clearTimeout(reconnectHandler);
        reconnectHandler = setTimeout(() => {
          // If we have existing messages in map, refresh from there instead of clearing
          if (messagesMapRef.current.size > 0 && isMounted) {
            const allMessages = Array.from(messagesMapRef.current.values())
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            if (allMessages.length > 0) {
              // Only update if we have something to show
              const messageLimit = messagesLimitRef.current;
              const hasMore = allMessages.length > messageLimit;
              setHasMoreMessages(hasMore);
              
              // Get recent messages based on current limit
              const messageSlice = allMessages.slice(0, messageLimit);
              setMessages(messageSlice);
            }
          }
        }, 1000);
      } else if (!snapshot.val()) {
        // If we lost connection, mark as reconnecting
        isReconnecting = true;
      }
    });
    
    // Reset message state when changing chats - IMPORTANT FIX
    if (!isReconnecting) {
      // IMPORTANT FIX: Only clear messages immediately if we don't have any
      // current messages or if this is a new chat. Otherwise, keep the old messages
      // until new messages are loaded to prevent flickering
      const shouldClearImmediately = messages.length === 0 || 
        messages[0]?.chatId !== currentChat.id;
      
      if (shouldClearImmediately) {
        setMessages([]);
      }
      
      // Clear all message-related state without affecting the chat list
      messagesMapRef.current.clear();
      messagesLimitRef.current = 20;
      setHasMoreMessages(true);
    }
    
    let initialLoadComplete = false;
    
    // First time load of this chat - mark as read
    setTimeout(() => {
      if (isMounted && currentChat?.id && !markingChatAsReadRef.current) {
        markChatAsRead(currentChat.id);
      }
    }, 100);

    // Set initial limit for messages (pagination)
    const MESSAGES_PER_PAGE = 20;
    
    // Use child_added for more efficient updates
    const messageAddedListener = onChildAdded(messagesRef, (snapshot) => {
      if (!isMounted) return;
      
      const messageData = snapshot.val();
      if (!messageData) return;
      
      const messageId = snapshot.key;
      const newMessage = {
        id: messageId,
        chatId: currentChat.id, // IMPORTANT FIX: Add chatId to messages for better tracking
        ...messageData
      };
      
      // Store all messages in map for efficient lookup
      messagesMapRef.current.set(messageId, newMessage);
      
      // After we've finished collecting messages, update the state once
      if (!initialLoadComplete) {
        // After a small delay, consider initial load complete and trigger rendering
        setTimeout(() => {
          if (!isMounted) return;
          
          initialLoadComplete = true;
          
          // Sort all messages by timestamp
          const allMessages = Array.from(messagesMapRef.current.values())
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          // For initial load, show the most recent messages based on limit
          messagesLimitRef.current = MESSAGES_PER_PAGE;
          
          // Check if we have more messages than the initial page
          setHasMoreMessages(allMessages.length > MESSAGES_PER_PAGE);
          
          // Get the most recent messages for initial display
          const recentMessages = allMessages.slice(-MESSAGES_PER_PAGE);
          
          // IMPORTANT FIX: Only update if we have messages to show or if we previously
          // cleared the messages. This prevents flickering.
          if (recentMessages.length > 0 || messages.length === 0) {
            setMessages(recentMessages);
          }
        }, 300); // Reduced timeout for faster loading
      } else {
        // After initial load, add new messages as they come in
        setMessages(prevMessages => {
          // Check if this message already exists in our list
          const exists = prevMessages.some(msg => msg.id === messageId);
          if (exists) {
            // Update existing message
            return prevMessages.map(msg => 
              msg.id === messageId ? newMessage : msg
            );
          } else {
            // For new messages, add them to the end and maintain sorting
            const updated = [...prevMessages, newMessage];
            return updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          }
        });
      }
    });
    
    // Use child_changed for updated messages
    const messageChangedListener = onChildChanged(messagesRef, (snapshot) => {
      if (!isMounted) return;
      
      const messageId = snapshot.key;
      const messageData = snapshot.val();
      if (!messageData) return;
      
      const updatedMessage = {
        id: messageId,
        ...messageData
      };
      
      // Update the message in the map
      messagesMapRef.current.set(messageId, updatedMessage);
      
      // Update the messages array
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? updatedMessage : msg
        )
      );
    });
    
    // Use child_removed for deleted messages
    const messageRemovedListener = onChildRemoved(messagesRef, (snapshot) => {
      if (!isMounted) return;
      
      const messageId = snapshot.key;
      
      // Remove message from map
      messagesMapRef.current.delete(messageId);
      
      // Remove message from array
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== messageId)
      );
    });
    
    return () => {
      isMounted = false;
      if (reconnectHandler) {
        clearTimeout(reconnectHandler);
      }
      connectionListener();
      messageAddedListener();
      if (messageChangedListener) messageChangedListener();
      if (messageRemovedListener) messageRemovedListener();
    };
  }, [currentChat?.id, user, markChatAsRead]);

  // Memoize the sendMessage function
  const sendMessage = useCallback(async (content, replyToMessageId = null) => {
    if (!currentChat?.id || !user) return;

    try {
      // Check if this is a direct message chat
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

      const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
      const message = {
        content,
        sender: user.uid,
        senderName: user.displayName || user.email,
        timestamp: serverTimestamp(),
      };
      
      // Add reply information if replying to a message
      if (replyToMessageId) {
        // Get the message being replied to
        const repliedMessageRef = ref(db, `chats/${currentChat.id}/messages/${replyToMessageId}`);
        const repliedMessageSnapshot = await get(repliedMessageRef);
        
        if (repliedMessageSnapshot.exists()) {
          const repliedMessage = repliedMessageSnapshot.val();
          message.replyTo = {
            id: replyToMessageId,
            content: repliedMessage.content?.substring(0, 100) || 'Attachment',
            senderName: repliedMessage.senderName,
            type: repliedMessage.type || 'text'
          };
        }
      }

      await set(messageRef, message);
      
      // Update chat info
      const updates = {};
      updates[`chats/${currentChat.id}/info/lastMessage`] = content;
      updates[`chats/${currentChat.id}/info/lastMessageTime`] = serverTimestamp();
      updates[`chats/${currentChat.id}/info/lastMessageSender`] = user.uid;
      updates[`chats/${currentChat.id}/info/lastMessageSenderName`] = user.displayName || user.email;
      
      // Update sender's lastRead
      updates[`users/${user.uid}/chats/${currentChat.id}/lastRead`] = serverTimestamp();
      
      await update(ref(db), updates);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [currentChat, user]);

  // Send a file message with optimizations
  const sendFileMessage = useCallback(async (file, progressCallback, replyToMessageId = null) => {
    if (!currentChat?.id || !user || !file) return null;
    
    // Check file size
    if (file.size > FILE_SIZE_LIMIT) {
      throw new Error(`File size exceeds ${FILE_SIZE_LIMIT / (1024 * 1024)}MB limit`);
    }
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error('File type not supported');
    }

    // Check if this is a direct message chat and the recipient has blocked the sender
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
          // If the recipient has blocked the sender, don't allow sending the file
          throw new Error("Cannot send file: recipient has blocked you");
        }
      }
    }

    // Generate a unique ID for this upload
    const uploadId = Math.random().toString(36).substring(2, 15);

    try {
      // Add to uploads tracking
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: { progress: 0, filename: file.name }
      }));
      
      // For images, we'll compress them client-side before converting to base64
      // The compression is handled in the ChatArea component
      
      // Convert file to base64 (simulating upload)
      const base64 = await fileToBase64(file);
      
      // Update progress to simulate upload
      for (let i = 10; i <= 90; i += 10) {
        setFileUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: i }
        }));
        if (progressCallback) progressCallback(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create the message with file data
      const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
      const message = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileCategory: getFileCategory(file.type),
        fileData: base64,
        sender: user.uid,
        senderName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        type: 'file'
      };
      
      // Add reply information if replying to a message
      if (replyToMessageId) {
        // Get the message being replied to
        const repliedMessageRef = ref(db, `chats/${currentChat.id}/messages/${replyToMessageId}`);
        const repliedMessageSnapshot = await get(repliedMessageRef);
        
        if (repliedMessageSnapshot.exists()) {
          const repliedMessage = repliedMessageSnapshot.val();
          message.replyTo = {
            id: replyToMessageId,
            content: repliedMessage.content?.substring(0, 100) || 'Attachment',
            senderName: repliedMessage.senderName,
            type: repliedMessage.type || 'text'
          };
        }
      }

      await set(messageRef, message);
      
      // Complete progress
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 100 }
      }));
      if (progressCallback) progressCallback(100);
      
      // Update chat info
      const updates = {};
      updates[`chats/${currentChat.id}/info/lastMessage`] = `${user.displayName || 'User'} sent a file: ${file.name}`;
      updates[`chats/${currentChat.id}/info/lastMessageTime`] = serverTimestamp();
      updates[`chats/${currentChat.id}/info/lastMessageSender`] = user.uid;
      updates[`chats/${currentChat.id}/info/lastMessageSenderName`] = user.displayName || user.email;
      
      // Update sender's lastRead
      updates[`users/${user.uid}/chats/${currentChat.id}/lastRead`] = serverTimestamp();
      
      await update(ref(db), updates);
      
      // Clear upload from state after a delay
      setTimeout(() => {
        setFileUploads(prev => {
          const newState = { ...prev };
          delete newState[uploadId];
          return newState;
        });
      }, 2000);
      
      return message;
    } catch (error) {
      console.error('Error sending file:', error);
      
      // Update uploads tracking with error
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], error: error.message }
      }));
      
      throw error;
    }
  }, [currentChat, user]);

  const createGroup = useCallback(async (name, members) => {
    if (!user) {
      throw new Error('You must be logged in to create a group');
    }

    const chatRef = push(ref(db, 'chats'));
    const chatId = chatRef.key;

    const memberCount = members.length + 1; // +1 for the creator

    const chatData = {
      info: {
        name,
        type: 'group',
        createdAt: Date.now(),
        lastMessage: 'Group created',
        lastMessageTime: Date.now(),
        createdBy: user.uid,
        memberCount,
        admins: {
          [user.uid]: true
        }
      },
      members: {
        [user.uid]: {
          role: 'admin',
          joinedAt: Date.now(),
          addedBy: user.uid
        },
        ...members.reduce((acc, uid) => ({ 
          ...acc, 
          [uid]: {
            role: 'member',
            joinedAt: Date.now(),
            addedBy: user.uid
          }
        }), {})
      },
      // Initialize an empty messages object to create the collection
      messages: {
        initialMessage: {
          content: 'Chat created',
          sender: user.uid,
          senderName: user.displayName || user.email,
          timestamp: Date.now(),
          type: 'system'
        }
      }
    };

    try {
      // Create the chat document
      await set(ref(db, `chats/${chatId}`), chatData);

      // Add chat to all members' chat lists
      const updates = {};
      [...members, user.uid].forEach(uid => {
        updates[`users/${uid}/chats/${chatId}`] = {
          joinedAt: Date.now(),
          role: uid === user.uid ? 'admin' : 'member'
        };
      });
      
      await update(ref(db), updates);
      
      // Update current chat via the memoized function to avoid loops
      handleChatSelect({ id: chatId, ...chatData.info });
      
      return chatId;
    } catch (error) {
      console.error('Error creating group:', error);
      throw new Error('Failed to create group: ' + error.message);
    }
  }, [user, handleChatSelect]);

  // Function to create a private chat (direct message) between two users
  const createPrivateChat = useCallback(async (otherUserId) => {
    if (!user) {
      throw new Error('You must be logged in to start a direct message');
    }

    if (otherUserId === user.uid) {
      throw new Error('Cannot create a chat with yourself');
    }

    // Get the other user's data
    const otherUserRef = ref(db, `users/${otherUserId}`);
    const otherUserSnapshot = await get(otherUserRef);
    const otherUserData = otherUserSnapshot.val();

    if (!otherUserData) {
      throw new Error('User not found');
    }

    // Check if a chat already exists between these users
    const userChatsRef = ref(db, `users/${user.uid}/chats`);
    const userChatsSnapshot = await get(userChatsRef);
    const userChats = userChatsSnapshot.val() || {};

    // Loop through existing chats to find if there's already a private chat with this user
    const existingChats = Object.entries(userChats);
    for (const [chatId] of existingChats) {
      // Get full chat data
      const chatRef = ref(db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      const fullChatData = chatSnapshot.val();

      // If this is a private chat with just these two users, return it
      if (fullChatData && 
          fullChatData.info.type === 'private' && 
          Object.keys(fullChatData.members || {}).length === 2 &&
          fullChatData.members[otherUserId]) {
        // Return existing chat
        return handleChatSelect({ id: chatId, ...fullChatData.info });
      }
    }

    // If no existing chat was found, create a new one
    const chatRef = push(ref(db, 'chats'));
    const chatId = chatRef.key;

    // Determine chat name (for the current user, it should show the other user's name)
    const chatName = otherUserData.displayName || otherUserData.email;

    const chatData = {
      info: {
        name: chatName,
        type: 'private',
        createdAt: Date.now(),
        lastMessage: 'Chat started',
        lastMessageTime: Date.now(),
        createdBy: user.uid,
        memberCount: 2,
        // Store both user IDs in the chat for easy lookup
        participants: {
          [user.uid]: true,
          [otherUserId]: true
        }
      },
      members: {
        [user.uid]: {
          role: 'member',
          joinedAt: Date.now()
        },
        [otherUserId]: {
          role: 'member',
          joinedAt: Date.now()
        }
      },
      // Initialize an empty messages object to create the collection
      messages: {
        initialMessage: {
          content: 'Chat started',
          sender: user.uid,
          senderName: user.displayName || user.email,
          timestamp: Date.now(),
          type: 'system'
        }
      }
    };

    try {
      // Create the chat document
      await set(ref(db, `chats/${chatId}`), chatData);

      // Add chat to both users' chat lists
      const updates = {};
      updates[`users/${user.uid}/chats/${chatId}`] = {
        joinedAt: Date.now(),
        role: 'member'
      };
      updates[`users/${otherUserId}/chats/${chatId}`] = {
        joinedAt: Date.now(),
        role: 'member'
      };
      
      await update(ref(db), updates);
      
      // Switch to the new chat
      handleChatSelect({ id: chatId, ...chatData.info });
      
      return chatId;
    } catch (error) {
      console.error('Error creating private chat:', error);
      throw new Error('Failed to create private chat: ' + error.message);
    }
  }, [user, handleChatSelect]);

  // Fetch users once when user changes
  useEffect(() => {
    if (!user) return;
    
    const fetchUsers = async () => {
      try {
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) return;
        
        const usersData = snapshot.val();
        
        // Update the allUsers object
        setAllUsers(usersData);
        
        const usersList = Object.entries(usersData)
          .map(([uid, data]) => ({
            uid,
            ...data
          }))
          .filter(u => u.uid !== user.uid); // Exclude current user
        
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [user]);

  // Listen to current chat members
  useEffect(() => {
    if (!currentChat) {
      setMembers([]);
      prevMembersRef.current = [];
      return;
    }
    
    let isMounted = true;

    const membersRef = ref(db, `chats/${currentChat.id}/members`);
    
    const membersListener = onValue(membersRef, async (snapshot) => {
      if (!isMounted) return;
      
      try {
        const membersData = snapshot.val() || {};
        
        const membersList = await Promise.all(
          Object.entries(membersData).map(async ([uid, data]) => {
            // Check cache first to avoid unnecessary database reads
            if (membersCache.current.has(uid)) {
              const cachedUserData = membersCache.current.get(uid);
              // Combine with the latest member data
              return {
                uid,
                ...cachedUserData,
                ...data
              };
            }
            
            const userSnapshot = await get(ref(db, `users/${uid}`));
            const userData = userSnapshot.val() || {};
            
            // Cache the user data
            membersCache.current.set(uid, userData);
            
            return {
              uid,
              ...userData,
              ...data
            };
          })
        );
        
        // Use structural equality to prevent unnecessary updates
        const membersListJSON = JSON.stringify(membersList);
        const prevMembersJSON = JSON.stringify(prevMembersRef.current);
        
        if (membersListJSON !== prevMembersJSON) {
          prevMembersRef.current = membersList;
          setMembers(membersList);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    });
    
    return () => {
      isMounted = false;
      membersListener();
    };
  }, [currentChat]);

  // Listen to polls
  useEffect(() => {
    if (!currentChat) return;
    
    let isMounted = true;
    
    const pollsRef = ref(db, `chats/${currentChat.id}/polls`);
    
    const pollsListener = onValue(pollsRef, (snapshot) => {
      if (!isMounted) return;
      
      const pollsData = snapshot.val() || {};
      const pollsList = Object.entries(pollsData).map(([id, data]) => ({
        id,
        ...data
      }));
      
      setPolls(pollsList);
    });
    
    return () => {
      isMounted = false;
      pollsListener();
    };
  }, [currentChat]);

  // Listen to announcements
  useEffect(() => {
    if (!currentChat) return;
    
    let isMounted = true;
    
    const announcementsRef = ref(db, `chats/${currentChat.id}/announcements`);
    
    const announcementsListener = onValue(announcementsRef, (snapshot) => {
      if (!isMounted) return;
      
      const announcementsData = snapshot.val() || {};
      const announcementsList = Object.entries(announcementsData).map(([id, data]) => ({
        id,
        ...data
      }));
      
      setAnnouncements(announcementsList);
    });
    
    return () => {
      isMounted = false;
      announcementsListener();
    };
  }, [currentChat]);

  // Memoize the update, add and remove functions
  const updateGroupInfo = useCallback(async (chatId, updates) => {
    await update(ref(db, `chats/${chatId}/info`), updates);
  }, []);

  const removeMember = useCallback(async (chatId, memberId) => {
    try {
      const chatRef = ref(db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      const currentMembers = chatSnapshot.val()?.members || {};
      const memberCount = Object.keys(currentMembers).length;

      const updates = {
        [`chats/${chatId}/members/${memberId}`]: null,
        [`users/${memberId}/chats/${chatId}`]: null,
        [`chats/${chatId}/info/memberCount`]: memberCount - 1
      };
      await update(ref(db), updates);
    } catch (error) {
      console.error('Error removing member:', error);
    }
  }, []);

  const addMember = useCallback(async (chatId, userId) => {
    if (!user) return;
    
    try {
      const chatRef = ref(db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      const currentMembers = chatSnapshot.val()?.members || {};
      const memberCount = Object.keys(currentMembers).length;

      const updates = {
        [`chats/${chatId}/members/${userId}`]: {
          role: 'member',
          joinedAt: Date.now(),
          addedBy: user.uid
        },
        [`users/${userId}/chats/${chatId}`]: {
          joinedAt: Date.now(),
          role: 'member'
        },
        [`chats/${chatId}/info/memberCount`]: memberCount + 1
      };
      await update(ref(db), updates);
    } catch (error) {
      console.error('Error adding member:', error);
    }
  }, [user]);

  const createAnnouncement = useCallback(async (content) => {
    if (!currentChat?.id || !user) return;
    
    const messageRef = ref(db, `chats/${currentChat.id}/messages`);
    await push(messageRef, {
      content,
      sender: user.uid,
      senderName: user.displayName,
      timestamp: serverTimestamp(),
      type: 'announcement'
    });
  }, [currentChat, user]);

  const createPoll = useCallback(async (question, options) => {
    if (!currentChat?.id || !user) return;
    
    const messageRef = ref(db, `chats/${currentChat.id}/messages`);
    await push(messageRef, {
      type: 'poll',
      question,
      options: options.reduce((acc, text) => ({
        ...acc,
        [push(ref(db)).key]: { text, votes: {} }
      }), {}),
      sender: user.uid,
      senderName: user.displayName,
      timestamp: serverTimestamp()
    });
  }, [currentChat, user]);

  const handleVote = useCallback(async (messageId, optionId) => {
    if (!currentChat?.id || !user) return;
    
    try {
      const updates = {};
      updates[`chats/${currentChat.id}/messages/${messageId}/options/${optionId}/votes/${user.uid}`] = true;
      await update(ref(db), updates);
    } catch (error) {
      console.error('Error voting:', error);
    }
  }, [currentChat, user]);

  // Add or remove a reaction to a message
  const handleReaction = useCallback(async (messageId, reaction) => {
    if (!currentChat?.id || !user) return;
    
    try {
      // First, get the current message to ensure it exists
      const messageRef = ref(db, `chats/${currentChat.id}/messages/${messageId}`);
      const messageSnapshot = await get(messageRef);
      
      if (!messageSnapshot.exists()) {
        console.error('Message does not exist');
        return;
      }
      
      // Then get the specific reaction data
      const reactionRef = ref(db, `chats/${currentChat.id}/messages/${messageId}/reactions/${reaction}`);
      const reactionSnapshot = await get(reactionRef);
      const reactions = reactionSnapshot.val() || {};
      
      const updates = {};
      
      // Toggle reaction: remove if exists, add if doesn't
      if (reactions && reactions[user.uid]) {
        // User already reacted with this emoji, so remove it
        updates[`chats/${currentChat.id}/messages/${messageId}/reactions/${reaction}/${user.uid}`] = null;
      } else {
        // User hasn't reacted with this emoji yet, so add it
        updates[`chats/${currentChat.id}/messages/${messageId}/reactions/${reaction}/${user.uid}`] = {
          timestamp: Date.now(),
          displayName: user.displayName || user.email
        };
      }
      
      // Update the database
      await update(ref(db), updates);
      
      console.log(`Reaction ${reaction} toggled for message ${messageId}`);
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }, [currentChat, user]);

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Get file type category
  const getFileCategory = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'spreadsheet';
    if (mimeType === 'text/plain') return 'text';
    return 'file';
  };

  // Add function to set typing status
  const setTypingStatus = useCallback((isTyping) => {
    if (!user || !currentChat?.id) return;
    
    try {
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Update typing status in Firebase
      const typingRef = ref(db, `chats/${currentChat.id}/typing/${user.uid}`);
      
      if (isTyping) {
        // Set typing status with user info
        set(typingRef, {
          uid: user.uid,
          displayName: user.displayName || user.email,
          timestamp: Date.now()
        });
        
        // Auto clear typing status after 5 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          set(typingRef, null);
        }, 5000);
      } else {
        // Clear typing status immediately
        set(typingRef, null);
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [user, currentChat]);

  // Listen for typing indicators
  useEffect(() => {
    if (!currentChat?.id) return;
    
    const typingRef = ref(db, `chats/${currentChat.id}/typing`);
    
    const typingListener = onValue(typingRef, (snapshot) => {
      const typingData = snapshot.val() || {};
      
      // Filter out stale typing indicators (older than 6 seconds)
      const now = Date.now();
      const activeTypingUsers = Object.entries(typingData)
        .filter(([uid, data]) => {
          // Don't show current user as typing
          if (uid === user?.uid) return false;
          
          // Filter out stale typing data
          return data.timestamp && (now - data.timestamp < 6000);
        })
        .reduce((acc, [uid, data]) => {
          acc[uid] = data;
          return acc;
        }, {});
      
      setTypingUsers(activeTypingUsers);
    });
    
    return () => {
      typingListener();
      setTypingUsers({});
      
      // When changing chats, clear the typing status for the user in the previous chat
      if (user?.uid) {
        const userTypingRef = ref(db, `chats/${currentChat.id}/typing/${user.uid}`);
        set(userTypingRef, null).catch(err => console.error('Error clearing typing status:', err));
      }
    };
  }, [currentChat?.id, user?.uid]);

  // Send voice message
  const sendVoiceMessage = useCallback(async (audioBlob, duration, replyToMessageId = null) => {
    if (!currentChat?.id || !user || !audioBlob) return null;
    
    // Check file size
    if (audioBlob.size > FILE_SIZE_LIMIT) {
      throw new Error(`File size exceeds ${FILE_SIZE_LIMIT / (1024 * 1024)}MB limit`);
    }

    // Check if this is a direct message chat and the recipient has blocked the sender
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
          // If the recipient has blocked the sender, don't allow sending the voice message
          throw new Error("Cannot send voice message: recipient has blocked you");
        }
      }
    }

    // Generate a unique ID for this upload
    const uploadId = Math.random().toString(36).substring(2, 15);

    try {
      // Add to uploads tracking
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: { progress: 0, filename: 'Voice message' }
      }));
      
      // Convert audio blob to base64
      const base64 = await fileToBase64(audioBlob);
      
      // Update progress to simulate upload
      for (let i = 10; i <= 90; i += 10) {
        setFileUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: i }
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Create the message with voice data
      const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
      const message = {
        fileData: base64,
        fileType: audioBlob.type,
        fileSize: audioBlob.size,
        fileCategory: 'audio',
        duration: duration, // Duration in seconds
        sender: user.uid,
        senderName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        type: 'voice'
      };
      
      // Add reply information if replying to a message
      if (replyToMessageId) {
        // Get the message being replied to
        const repliedMessageRef = ref(db, `chats/${currentChat.id}/messages/${replyToMessageId}`);
        const repliedMessageSnapshot = await get(repliedMessageRef);
        
        if (repliedMessageSnapshot.exists()) {
          const repliedMessage = repliedMessageSnapshot.val();
          message.replyTo = {
            id: replyToMessageId,
            content: repliedMessage.content?.substring(0, 100) || 'Attachment',
            senderName: repliedMessage.senderName,
            type: repliedMessage.type || 'text'
          };
        }
      }

      await set(messageRef, message);
      
      // Complete progress
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 100 }
      }));
      
      // Update chat info
      const updates = {};
      updates[`chats/${currentChat.id}/info/lastMessage`] = `${user.displayName || 'User'} sent a voice message`;
      updates[`chats/${currentChat.id}/info/lastMessageTime`] = serverTimestamp();
      updates[`chats/${currentChat.id}/info/lastMessageSender`] = user.uid;
      updates[`chats/${currentChat.id}/info/lastMessageSenderName`] = user.displayName || user.email;
      
      // Update sender's lastRead
      updates[`users/${user.uid}/chats/${currentChat.id}/lastRead`] = serverTimestamp();
      
      await update(ref(db), updates);
      
      // Clear upload from state after a delay
      setTimeout(() => {
        setFileUploads(prev => {
          const newState = { ...prev };
          delete newState[uploadId];
          return newState;
        });
      }, 2000);
      
      return message;
    } catch (error) {
      console.error('Error sending voice message:', error);
      
      // Update uploads tracking with error
      setFileUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], error: error.message }
      }));
      
      throw error;
    }
  }, [currentChat, user, fileToBase64]);

  // Function to check if the current user is an admin of the current chat
  const isCurrentUserAdmin = useCallback(() => {
    if (!currentChat?.id || !user?.uid) return false;
    
    // For group chats, check admin status
    if (currentChat.type === 'group') {
      // Check if user is in the admins list
      return currentChat.admins && currentChat.admins[user.uid] === true;
    }
    
    return false;
  }, [currentChat, user]);

  // Function to fetch chat logs
  const fetchChatLogs = useCallback(async () => {
    if (!currentChat?.id) return;
    
    try {
      const logsRef = ref(db, `chats/${currentChat.id}/logs`);
      const logsSnapshot = await get(logsRef);
      
      if (!logsSnapshot.exists()) {
        setLogs([]);
        return;
      }
      
      const logsData = logsSnapshot.val();
      const logsList = Object.entries(logsData).map(([id, data]) => ({
        id,
        ...data
      }));
      
      // Sort logs by timestamp (newest first)
      logsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      setLogs(logsList);
    } catch (error) {
      console.error('Error fetching chat logs:', error);
    }
  }, [currentChat]);

  // Modify the editMessage function to log changes
  const editMessage = useCallback(async (messageId, newContent) => {
    if (!currentChat?.id || !user || !messageId) return;

    try {
      // Get the existing message
      const messageRef = ref(db, `chats/${currentChat.id}/messages/${messageId}`);
      const messageSnapshot = await get(messageRef);
      
      if (!messageSnapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = messageSnapshot.val();
      
      // Check if current user is the sender
      if (message.sender !== user.uid) {
        throw new Error('You can only edit your own messages');
      }
      
      // Store the original content for logging
      const originalContent = message.content;
      
      // Update the message
      const updates = {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp()
      };
      
      await update(messageRef, updates);
      
      // Log the edit action
      const logRef = push(ref(db, `chats/${currentChat.id}/logs`));
      await set(logRef, {
        type: 'edit',
        messageId,
        originalContent,
        newContent,
        userId: user.uid,
        userName: user.displayName || user.email,
        timestamp: serverTimestamp()
      });
      
      // If this was the last message in the chat, update the chat info
      const chatInfoRef = ref(db, `chats/${currentChat.id}/info`);
      const chatInfoSnapshot = await get(chatInfoRef);
      
      if (chatInfoSnapshot.exists()) {
        const chatInfo = chatInfoSnapshot.val();
        
        if (chatInfo.lastMessageSender === user.uid && 
            chatInfo.lastMessage === message.content) {
          await update(chatInfoRef, {
            lastMessage: newContent,
            lastUpdated: serverTimestamp()
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }, [currentChat, user]);

  // Modify the deleteMessage function to log deletions
  const deleteMessage = useCallback(async (messageId) => {
    if (!currentChat?.id || !user || !messageId) return;

    try {
      // Get the existing message
      const messageRef = ref(db, `chats/${currentChat.id}/messages/${messageId}`);
      const messageSnapshot = await get(messageRef);
      
      if (!messageSnapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = messageSnapshot.val();
      
      // Check if current user is the sender
      if (message.sender !== user.uid) {
        throw new Error('You can only delete your own messages');
      }
      
      // Store the original content for logging
      const originalContent = message.content;
      
      // Update the message as deleted instead of actually removing it
      // This preserves the chat history but hides the content
      const updates = {
        content: "This message was deleted",
        deleted: true,
        deletedAt: serverTimestamp(),
        // If it's a file message, remove the file data to save space
        ...(message.type === 'file' ? { fileData: null } : {})
      };
      
      await update(messageRef, updates);
      
      // Log the deletion action
      const logRef = push(ref(db, `chats/${currentChat.id}/logs`));
      await set(logRef, {
        type: 'delete',
        messageId,
        originalContent,
        userId: user.uid,
        userName: user.displayName || user.email,
        timestamp: serverTimestamp()
      });
      
      // If this was the last message in the chat, update the chat info
      const chatInfoRef = ref(db, `chats/${currentChat.id}/info`);
      const chatInfoSnapshot = await get(chatInfoRef);
      
      if (chatInfoSnapshot.exists()) {
        const chatInfo = chatInfoSnapshot.val();
        
        if (chatInfo.lastMessageSender === user.uid && 
            chatInfo.lastMessage === message.content) {
          await update(chatInfoRef, {
            lastMessage: "This message was deleted",
            lastUpdated: serverTimestamp()
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }, [currentChat, user]);

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

  // Provide context with all memoized values and functions
  const contextValue = {
    currentChat,
    setCurrentChat,
    chats,
    messages,
    setMessages,
    sendMessage,
    sendFileMessage,
    sendVoiceMessage,
    fileUploads,
    createGroup,
    createPrivateChat,
    members,
    users,
    updateGroupInfo,
    removeMember,
    addMember,
    createAnnouncement,
    createPoll,
    handleVote,
    handleReaction,
    announcements,
    polls,
    inviteLink,
    setInviteLink,
    clearInviteLink,
    generateInviteLink,
    markChatAsRead,
    handleChatSelect,
    FILE_SIZE_LIMIT,
    ALLOWED_FILE_TYPES,
    typingUsers,
    setTypingStatus,
    loadMoreMessages,
    hasMoreMessages,
    loading,
    chatsLoading,
    allUsers,
    editMessage,
    deleteMessage,
    isCurrentUserAdmin,
    logs,
    fetchChatLogs,
    blockUser,
    unblockUser,
    isUserBlocked
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 