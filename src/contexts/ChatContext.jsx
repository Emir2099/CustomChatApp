import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { ref, onValue, push, set, update, get, serverTimestamp } from 'firebase/database';
import { useAuth } from './AuthContext';
import PropTypes from 'prop-types';

const ChatContext = createContext();

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

  // Listen to user's chats
  useEffect(() => {
    if (!user) return;

    const userChatsRef = ref(db, `users/${user.uid}/chats`);
    return onValue(userChatsRef, (snapshot) => {
      const chatIds = snapshot.val() || {};
      
      // Fetch chat details for each chat
      Object.keys(chatIds).forEach(chatId => {
        const chatRef = ref(db, `chats/${chatId}`);
        const userLastReadRef = ref(db, `users/${user.uid}/chats/${chatId}/lastRead`);
        
        onValue(chatRef, async (chatSnapshot) => {
          const chatData = chatSnapshot.val();
          if (chatData) {
            const userLastReadSnapshot = await get(userLastReadRef);
            const lastRead = userLastReadSnapshot.val() || 0;
            
            // Count unread messages
            let unreadCount = 0;
            if (chatData.messages) {
              Object.values(chatData.messages).forEach(msg => {
                if (msg.timestamp > lastRead && msg.sender !== user.uid) {
                  unreadCount++;
                }
              });
            }

            setChats(prev => {
              const updated = [...prev.filter(c => c.id !== chatId), { 
                id: chatId, 
                ...chatData.info,
                unreadCount,
                memberCount: Object.keys(chatData.members || {}).length
              }];
              return updated.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
            });
          }
        });
      });
    });
  }, [user]);

  // Listen to messages for the current chat
  useEffect(() => {
    if (!currentChat?.id || !user) return;

    const messagesRef = ref(db, `chats/${currentChat.id}/messages`);
    return onValue(messagesRef, async (snapshot) => {
      const messages = snapshot.val() || {};
      
      // Mark messages as read when loaded
      await markChatAsRead(currentChat.id);
      
      setMessages(Object.entries(messages).map(([id, message]) => ({
        id,
        ...message
      })).sort((a, b) => a.timestamp - b.timestamp));
    });
  }, [currentChat?.id, user]);

  const sendMessage = async (content) => {
    if (!currentChat?.id || !user) return;

    try {
      const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
      const message = {
        content,
        sender: user.uid,
        senderName: user.displayName || user.email,
        timestamp: serverTimestamp(),
      };

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
  };

  const createGroup = async (name, members) => {
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
      setCurrentChat({ id: chatId, ...chatData.info });
      
      console.log('Group created successfully:', chatId);
      return chatId;
    } catch (error) {
      console.error('Error creating group:', error);
      throw new Error('Failed to create group: ' + error.message);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = Object.entries(usersData)
          .map(([uid, data]) => ({
            uid,
            ...data
          }))
          .filter(u => u.uid !== user.uid); // Exclude current user
        setUsers(usersList);
      }
    };

    fetchUsers();
  }, [user]);

  // Listen to current chat members
  useEffect(() => {
    if (!currentChat) {
      setMembers([]);
      return;
    }

    const membersRef = ref(db, `chats/${currentChat.id}/members`);
    return onValue(membersRef, async (snapshot) => {
      const membersData = snapshot.val() || {};
      const membersList = await Promise.all(
        Object.entries(membersData).map(async ([uid, data]) => {
          const userSnapshot = await get(ref(db, `users/${uid}`));
          const userData = userSnapshot.val() || {};
          return {
            uid,
            ...userData,
            ...data
          };
        })
      );
      setMembers(membersList);
    });
  }, [currentChat]);

  // Listen to polls
  useEffect(() => {
    if (!currentChat) return;
    
    const pollsRef = ref(db, `chats/${currentChat.id}/polls`);
    return onValue(pollsRef, (snapshot) => {
      const pollsData = snapshot.val() || {};
      const pollsList = Object.entries(pollsData).map(([id, data]) => ({
        id,
        ...data
      }));
      setPolls(pollsList);
    });
  }, [currentChat]);

  // Listen to announcements
  useEffect(() => {
    if (!currentChat) return;
    
    const announcementsRef = ref(db, `chats/${currentChat.id}/announcements`);
    return onValue(announcementsRef, (snapshot) => {
      const announcementsData = snapshot.val() || {};
      const announcementsList = Object.entries(announcementsData).map(([id, data]) => ({
        id,
        ...data
      }));
      setAnnouncements(announcementsList);
    });
  }, [currentChat]);

  const updateGroupInfo = async (chatId, updates) => {
    await update(ref(db, `chats/${chatId}/info`), updates);
  };

  const removeMember = async (chatId, memberId) => {
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
  };

  const addMember = async (chatId, userId) => {
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
  };

  const createAnnouncement = async (content) => {
    if (!currentChat) return;
    
    const messageRef = ref(db, `chats/${currentChat.id}/messages`);
    await push(messageRef, {
      content,
      sender: user.uid,
      senderName: user.displayName,
      timestamp: serverTimestamp(),
      type: 'announcement'
    });
  };

  const createPoll = async (question, options) => {
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
  };

  const handleVote = async (messageId, optionId) => {
    if (!currentChat?.id || !user) return;
    
    try {
      const updates = {};
      updates[`chats/${currentChat.id}/messages/${messageId}/options/${optionId}/votes/${user.uid}`] = true;
      await update(ref(db), updates);
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const clearInviteLink = () => {
    setInviteLink('');
  };

  const generateInviteLink = async (chatId) => {
    try {
      const linkId = Math.random().toString(36).substring(2, 15);
      
      // Store the invite link in the chat's info object
      await update(ref(db, `chats/${chatId}/info`), {
        inviteLink: linkId,
        lastUpdated: Date.now()
      });
      
      return `${window.location.origin}/invite/${chatId}/${linkId}`;
    } catch (error) {
      console.error('Error generating invite link:', error);
      throw error;
    }
  };

  // Update markChatAsRead function
  const markChatAsRead = async (chatId) => {
    if (!user || !chatId) return;
    
    try {
      const updates = {};
      updates[`users/${user.uid}/chats/${chatId}/lastRead`] = serverTimestamp();
      await update(ref(db), updates);
      
      // Update local state to reflect read status
      setChats(prev => 
        prev.map(chat => 
          chat.id === chatId 
            ? { ...chat, unreadCount: 0 }
            : chat
        )
      );
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  };

  // Update handleChatSelect function
  const handleChatSelect = async (chat) => {
    setCurrentChat(chat);
    if (chat) {
      await markChatAsRead(chat.id);
    }
  };

  return (
    <ChatContext.Provider value={{
      currentChat,
      setCurrentChat,
      chats,
      messages,
      sendMessage,
      createGroup,
      members,
      users,
      updateGroupInfo,
      removeMember,
      addMember,
      createAnnouncement,
      createPoll,
      handleVote,
      announcements,
      polls,
      inviteLink,
      setInviteLink,
      clearInviteLink,
      generateInviteLink,
      markChatAsRead,
      handleChatSelect,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 