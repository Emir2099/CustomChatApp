import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import styles from './GroupInfo.module.css';
import { getDatabase, ref, update } from 'firebase/database';

export default function GroupInfo() {
  const { currentChat, updateGroupInfo, inviteLink, setInviteLink } = useChat();
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(currentChat?.name || '');
  
  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (groupName.trim() && groupName !== currentChat.name) {
      await updateGroupInfo(currentChat.id, { name: groupName.trim() });
      setIsEditing(false);
    }
  };

  const generateInviteLink = async () => {
    const linkId = Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/invite/${currentChat.id}/${linkId}`;
    
    await update(ref(getDatabase(), `chats/${currentChat.id}`), {
      inviteLink: linkId,
      groupId: currentChat.id,
      lastUpdated: Date.now()
    });
    
    setInviteLink(link);
  };

  if (!currentChat) return null;

  return (
    <div className={styles.groupInfo}>
      <div className={styles.header}>
        <div className={styles.groupAvatar}>
          <svg viewBox="0 0 24 24">
            <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.51 2.61-.9 4.24-.9zM12 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
          </svg>
        </div>
        
        {isEditing ? (
          <form onSubmit={handleSubmit} className={styles.editForm}>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
            <div className={styles.actions}>
              <button type="submit">Save</button>
              <button type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.groupName}>
            <h2>{currentChat.name}</h2>
            {isAdmin && (
              <button 
                onClick={() => setIsEditing(true)}
                className={styles.editButton}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.infoItem}>
          <span className={styles.label}>Created</span>
          <span className={styles.value}>
            {new Date(currentChat.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.label}>Created by</span>
          <span className={styles.value}>
            {currentChat.createdBy === auth.currentUser?.uid ? 'You' : 'Another user'}
          </span>
        </div>
      </div>

      <div className={styles.inviteSection}>
        <button onClick={generateInviteLink}>
          Generate Invite Link
        </button>
        {inviteLink && (
          <div className={styles.inviteLinkContainer}>
            <input type="text" readOnly value={inviteLink} />
            <button onClick={() => navigator.clipboard.writeText(inviteLink)}>
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 