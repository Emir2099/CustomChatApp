import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './ActionBar.module.css';

export default function ActionBar() {
  const { currentChat, createAnnouncement, createPoll } = useChat();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [announcement, setAnnouncement] = useState('');
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (pollQuestion.trim() && pollOptions.every(opt => opt.trim())) {
      await createPoll(pollQuestion, pollOptions.filter(opt => opt.trim()));
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollModal(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (announcement.trim()) {
      await createAnnouncement(announcement.trim());
      setAnnouncement('');
      setShowAnnouncementModal(false);
    }
  };

  const openPollModal = () => {
    if (!currentChat) {
      setValidationMessage("You need to be in a group to create a poll.");
      setShowValidationDialog(true);
      return;
    }
    setShowPollModal(true);
  };

  const openAnnouncementModal = () => {
    if (!currentChat) {
      setValidationMessage("You need to be in a group to make an announcement.");
      setShowValidationDialog(true);
      return;
    }
    setShowAnnouncementModal(true);
  };

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
          onClick={openAnnouncementModal}
          title="Make Announcement"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </button>
        <button 
          className={styles.actionButton}
          onClick={openPollModal}
          title="Create Poll"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
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

      {/* Validation Dialog */}
      {showValidationDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowValidationDialog(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>No Group Selected</h2>
              <button className={styles.closeButton} onClick={() => setShowValidationDialog(false)}>×</button>
            </div>
            <div className={styles.modalContent}>
              <p>{validationMessage}</p>
              <p>Please join or select a group first.</p>
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.primaryButton} 
                onClick={() => setShowValidationDialog(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showPollModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPollModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create Poll</h2>
              <button className={styles.closeButton} onClick={() => setShowPollModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreatePoll}>
              <input
                type="text"
                placeholder="Poll question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
              />
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...pollOptions];
                    newOptions[index] = e.target.value;
                    setPollOptions(newOptions);
                  }}
                />
              ))}
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className={styles.secondaryButton}
                >
                  Add Option
                </button>
                <button type="submit" className={styles.primaryButton}>Create Poll</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAnnouncementModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAnnouncementModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Make Announcement</h2>
              <button className={styles.closeButton} onClick={() => setShowAnnouncementModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAnnouncement}>
              <textarea
                placeholder="Write your announcement..."
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button type="submit" className={styles.primaryButton}>Post Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 