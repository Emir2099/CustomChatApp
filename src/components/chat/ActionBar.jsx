import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './ActionBar.module.css';

export default function ActionBar() {
  const { currentChat, createAnnouncement, createPoll } = useChat();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  if (!currentChat) return null;

  return (
    <div className={styles.actionBar}>
      <div className={styles.groupInfo}>
        <div className={styles.groupAvatar}>
          <svg viewBox="0 0 24 24">
            <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.51 2.61-.9 4.24-.9zM12 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
          </svg>
        </div>
        <div className={styles.info}>
          <h2>{currentChat.name}</h2>
          <span>{currentChat.members?.length || 0} members</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.actionButton}
          onClick={() => setShowAnnouncementModal(true)}
          title="Make Announcement"
        >
          <svg viewBox="0 0 24 24">
            <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.71 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/>
          </svg>
        </button>
        <button 
          className={styles.actionButton}
          onClick={() => setShowPollModal(true)}
          title="Create Poll"
        >
          <svg viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        </button>
        <button 
          className={styles.actionButton}
          onClick={() => setShowActionMenu(!showActionMenu)}
          title="More Actions"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>

      {showActionMenu && (
        <div className={styles.actionMenu}>
          <button onClick={() => {/* Add functionality */}}>
            Share Group
          </button>
          <button onClick={() => {/* Add functionality */}}>
            Pin Important Messages
          </button>
          <button onClick={() => {/* Add functionality */}}>
            Group Settings
          </button>
        </div>
      )}

      {showPollModal && (
        <PollModal onClose={() => setShowPollModal(false)} />
      )}

      {showAnnouncementModal && (
        <AnnouncementModal onClose={() => setShowAnnouncementModal(false)} />
      )}
    </div>
  );
} 