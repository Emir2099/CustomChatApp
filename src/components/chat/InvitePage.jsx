import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDatabase, ref, get, update, push, set } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './InvitePage.module.css';

export default function InvitePage() {
  const { inviteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);

  useEffect(() => {
    const checkInvite = async () => {
      try {
        const db = getDatabase();
        const chatsRef = ref(db, 'chats');
        const snapshot = await get(chatsRef);
        
        let foundChat = null;
        snapshot.forEach((child) => {
          const chat = child.val();
          if (chat.inviteLink === inviteId) {
            foundChat = { ...chat, id: child.key };
          }
        });

        if (!foundChat) {
          setError('Invalid or expired invite link');
          return;
        }

        setChatInfo(foundChat);
      } catch (err) {
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    };

    checkInvite();
  }, [inviteId]);

  const handleJoin = async () => {
    try {
      const db = getDatabase();
      await update(ref(db, `chats/${chatInfo.id}/members/${user.uid}`), {
        role: 'member',
        joinedAt: Date.now()
      });
      await update(ref(db, `users/${user.uid}/chats/${chatInfo.id}`), {
        lastRead: Date.now()
      });
      const messageRef = ref(db, `chats/${chatInfo.id}/messages`);
      const newMessageRef = push(messageRef);
      await set(newMessageRef, {
        type: 'system',
        content: `${user.displayName || 'A new user'} joined the chat`,
        timestamp: Date.now()
      });
      navigate(`/chat/${chatInfo.id}`);
    } catch (err) {
      setError('Failed to join the chat');
    }
  };

  if (loading) return <div className={styles.container}>Loading...</div>;
  if (error) return <div className={styles.container}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Join {chatInfo.name}</h1>
        <p>You've been invited to join this group chat</p>
        <button onClick={handleJoin} className={styles.joinButton}>
          Join Chat
        </button>
      </div>
    </div>
  );
} 