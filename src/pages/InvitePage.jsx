import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { ref, get, update } from 'firebase/database';
import styles from './InvitePage.module.css';

export default function InvitePage() {
  const { chatId, linkId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const validateAndJoin = async () => {
      if (!user) {
        setError('Please sign in to join the group');
        return;
      }

      try {
        const chatRef = ref(db, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        const chatData = chatSnapshot.val();

        if (!chatData || !chatData.info) {
          setError('Group not found');
          return;
        }

        if (chatData.info.inviteLink !== linkId) {
          setError('Invalid or expired invite link');
          return;
        }

        if (chatData.members?.[user.uid]) {
          navigate(`/chat/${chatId}`);
          return;
        }

        const updates = {
          [`chats/${chatId}/members/${user.uid}`]: {
            role: 'member',
            joinedAt: Date.now()
          },
          [`users/${user.uid}/chats/${chatId}`]: {
            joinedAt: Date.now(),
            role: 'member'
          },
          [`chats/${chatId}/info/memberCount`]: (chatData.info.memberCount || 0) + 1
        };

        await update(ref(db), updates);
        navigate(`/chat/${chatId}`);
      } catch (error) {
        console.error('Error joining group:', error);
        setError('Failed to join group');
      } finally {
        setLoading(false);
      }
    };

    validateAndJoin();
  }, [chatId, linkId, user, navigate]);

  if (loading) {
    return (
      <>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={`${styles.statusIcon} ${styles.loadingIcon}`}>🔄</div>
            <h2>Joining group...</h2>
            <p>Please wait while we process your request</p>
            <div className={styles.loader}></div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={`${styles.statusIcon} ${styles.errorIcon}`}>⚠️</div>
            <h2>Oops!</h2>
            <div className={styles.error}>{error}</div>
            <button onClick={() => navigate('/')} className={styles.button}>
              Go to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
} 