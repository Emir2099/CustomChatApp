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
  const [currentChat, setCurrent] = useState(null);
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
        onValue(chatRef, (chatSnapshot) => {
          const chatData = chatSnapshot.val();
          if (chatData) {
            const memberCount = Object.keys(chatData.members || {}).length;
            setChats(prev => {
              const updated = [...prev.filter(c => c.id !== chatId), { 
                id: chatId, 
                ...chatData.info,
                memberCount
              }];
              return updated.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
            });
          }
        });
      });
    });
  }, [user]);

  // Listen to current chat messages
  useEffect(() => {
    if (!currentChat?.id) return;

    const messagesRef = ref(db, `chats/${currentChat.id}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        const messagesList = Object.entries(messagesData).map(([id, data]) => ({
          id,
          ...data,
          // Ensure we have a fallback for sender name
          senderName: data.senderName || 
                     users.find(u => u.uid === data.sender)?.displayName || 
                     users.find(u => u.uid === data.sender)?.email?.split('@')[0] ||
                     'User'
        }));
        setMessages(messagesList.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [currentChat?.id, users]);

  const sendMessage = async (content) => {
    if (!currentChat?.id || !user) return;

    try {
      const messageRef = ref(db, `chats/${currentChat.id}/messages`);
      const newMessageRef = push(messageRef);
      
      await set(newMessageRef, {
        content,
        sender: user.uid,
        senderName: user.displayName || user.email?.split('@')[0],
        timestamp: serverTimestamp(),
      });

      // Update last message in chat info
      const chatRef = ref(db, `chats/${currentChat.id}/info`);
      await update(chatRef, {
        lastMessage: content,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: user.uid,
        lastMessageSenderName: user.displayName || user.email?.split('@')[0]
      });
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
      setCurrent({ id: chatId, ...chatData.info });
      
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
    if (!currentChat?.id || !user) return;

    try {
      const announcementRef = push(ref(db, `chats/${currentChat.id}/announcements`));
      await set(announcementRef, {
        content,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });

      // Add system message about new announcement
      const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
      await set(messageRef, {
        type: 'announcement',
        content,
        sender: user.uid,
        senderName: user.displayName || 'Unknown',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  };

  const createPoll = async (question, options) => {
    if (!currentChat?.id || !user) return;

    try {
      const pollRef = push(ref(db, `chats/${currentChat.id}/polls`));
      await set(pollRef, {
        question,
        options: options.reduce((acc, opt) => ({...acc, [push(ref(db)).key]: opt}), {}),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        votes: {}
      });

      // Add system message about new poll
      const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
      await set(messageRef, {
        type: 'system',
        content: `${user.displayName || 'Someone'} created a poll: ${question}`,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  };

  const votePoll = async (pollId, optionKey) => {
    if (!currentChat || !user) return;

    const updates = {};
    updates[`chats/${currentChat.id}/polls/${pollId}/options/${optionKey}/${user.uid}`] = true;
    await update(ref(db), updates);
  };

  const clearInviteLink = () => {
    setInviteLink('');
  };

  const setCurrentChat = async (chat) => {
    if (chat) {
      const chatRef = ref(db, `chats/${chat.id}`);
      try {
        const snapshot = await get(chatRef);
        const chatData = snapshot.val();
        if (chatData) {
          const memberCount = Object.keys(chatData.members || {}).length;
          setCurrent({
            ...chat,
            memberCount
          });
        }
      } catch (error) {
        console.error('Error setting current chat:', error);
        setCurrent(null);
      }
    } else {
      setCurrent(null);
    }
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
      votePoll,
      announcements,
      polls,
      inviteLink,
      setInviteLink,
      clearInviteLink,
      generateInviteLink,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 