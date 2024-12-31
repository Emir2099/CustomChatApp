import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { ref, onValue, push, set, update, get } from 'firebase/database';
import { useAuth } from './AuthContext';
import PropTypes from 'prop-types';

const ChatContext = createContext();

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
        const chatRef = ref(db, `chats/${chatId}/info`);
        onValue(chatRef, (chatSnapshot) => {
          const chatData = chatSnapshot.val();
          if (chatData) {
            setChats(prev => {
              const updated = [...prev.filter(c => c.id !== chatId), { id: chatId, ...chatData }];
              return updated.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
            });
          }
        });
      });
    });
  }, [user]);

  // Listen to current chat messages
  useEffect(() => {
    if (!currentChat) return;

    const messagesRef = ref(db, `chats/${currentChat.id}/messages`);
    return onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val() || {};
      const messagesList = Object.entries(messagesData).map(([id, data]) => ({
        id,
        ...data
      }));
      setMessages(messagesList.sort((a, b) => a.timestamp - b.timestamp));
    });
  }, [currentChat]);

  const sendMessage = async (content, type = 'text', fileUrl = null) => {
    if (!currentChat || !user) return;

    const messageRef = push(ref(db, `chats/${currentChat.id}/messages`));
    const message = {
      content,
      sender: user.uid,
      timestamp: Date.now(),
      type,
      ...(fileUrl && { fileUrl })
    };

    await set(messageRef, message);
    await update(ref(db, `chats/${currentChat.id}/info`), {
      lastMessage: content,
      lastMessageTime: Date.now()
    });
  };

  const createGroup = async (name, members) => {
    if (!user) {
      throw new Error('You must be logged in to create a group');
    }

    const chatRef = push(ref(db, 'chats'));
    const chatId = chatRef.key;

    const chatData = {
      info: {
        name,
        type: 'group',
        createdAt: Date.now(),
        lastMessage: 'Group created',
        lastMessageTime: Date.now(),
        createdBy: user.uid,
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
    if (!currentChat) return;
    
    const membersRef = ref(db, `chats/${currentChat.id}/members`);
    return onValue(membersRef, async (snapshot) => {
      const membersData = snapshot.val() || {};
      const membersList = await Promise.all(
        Object.entries(membersData).map(async ([uid, data]) => {
          const userSnapshot = await get(ref(db, `users/${uid}`));
          return {
            uid,
            ...userSnapshot.val(),
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
    await update(ref(db), {
      [`chats/${chatId}/members/${memberId}`]: null,
      [`users/${memberId}/chats/${chatId}`]: null
    });
  };

  const addMember = async (chatId, userId) => {
    const updates = {
      [`chats/${chatId}/members/${userId}`]: {
        role: 'member',
        joinedAt: Date.now(),
        addedBy: user.uid
      },
      [`users/${userId}/chats/${chatId}`]: {
        joinedAt: Date.now(),
        role: 'member'
      }
    };
    await update(ref(db), updates);
  };

  const createAnnouncement = async (content) => {
    if (!currentChat || !user) return;

    const announcementRef = push(ref(db, `chats/${currentChat.id}/announcements`));
    const announcement = {
      content,
      creator: user.uid,
      timestamp: Date.now()
    };

    await set(announcementRef, announcement);
    await update(ref(db, `chats/${currentChat.id}/info`), {
      lastMessage: `📢 ${content}`,
      lastMessageTime: Date.now(),
      lastMessageType: 'announcement'
    });
  };

  const createPoll = async (question, options) => {
    if (!currentChat || !user) return;

    const pollRef = push(ref(db, `chats/${currentChat.id}/polls`));
    const poll = {
      question,
      options: options.reduce((acc, opt) => ({ ...acc, [opt]: {} }), {}),
      creator: user.uid,
      timestamp: Date.now()
    };

    await set(pollRef, poll);
    await update(ref(db, `chats/${currentChat.id}/info`), {
      lastMessage: `📊 ${question}`,
      lastMessageTime: Date.now(),
      lastMessageType: 'poll'
    });
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
    }}>
      {children}
    </ChatContext.Provider>
  );
}

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export const useChat = () => useContext(ChatContext); 