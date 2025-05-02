import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import UserProfile from './UserProfile';
import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './ChatLayout.module.css';
import GroupInfo from './GroupInfo';
import MembersList from './MembersList';
import { getDatabase, ref, update } from 'firebase/database';

export default function ChatLayout() {
  const [showProfile, setShowProfile] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const iconInputRef = useRef(null);
  const { user } = useAuth();
  const { currentChat, updateChat, createPoll, createAnnouncement, setCurrentChat } = useChat();
  const [currentView, setCurrentView] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['']);
  const [announcement, setAnnouncement] = useState('');

  const handleServerIconChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingIcon(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const img = new Image();
        img.src = reader.result;
        await new Promise(resolve => img.onload = resolve);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const MAX_SIZE = 200;
        const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const iconURL = canvas.toDataURL('image/jpeg', 0.5);
        
        const chatRef = ref(getDatabase(), `chats/${currentChat.id}`);
        await update(chatRef, {
          "info/iconURL": iconURL,
          "info/lastUpdated": Date.now()
        });
        
        if (currentChat) {
          setCurrentChat(prevChat => ({
            ...prevChat,
            iconURL
          }));
        }
      };
    } catch (error) {
      console.error('Error updating server icon:', error);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleCreatePoll = async (pollData) => {
    if (!currentChat) return;
    await createPoll(pollData.question, pollData.options);
    setShowPollModal(false);
  };

  const handleCreateAnnouncement = async (announcement) => {
    if (!currentChat) return;
    await createAnnouncement(announcement);
    setShowAnnouncementModal(false);
  };

  return (
    <>
      <div className={`${styles.layout} ${showProfile ? styles.blurred : ''}`}>
        <nav className={styles.nav}>
          <input
            type="file"
            ref={iconInputRef}
            onChange={handleServerIconChange}
            accept=".jpg,.jpeg,.png,.webp"
            className={styles.hiddenInput}
          />
          <div 
            className={styles.serverIcon}
            onClick={() => iconInputRef.current?.click()}
          >
            {currentChat?.iconURL ? (
              <img src={currentChat.iconURL} alt="Server icon" />
            ) : (
              <span>{currentChat?.name?.[0]?.toUpperCase()}</span>
            )}
            {uploadingIcon && <div className={styles.uploadingOverlay}>...</div>}
          </div>
          <div className={styles.logo}>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className={styles.navItems}>
            <button 
              className={currentView === 'messages' ? styles.active : ''}
              onClick={() => setCurrentView('messages')}
            >
              {unreadCount > 0 && (
                <span className={styles.badge}>{unreadCount}</span>
              )}
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </button>
            <button 
              className={currentView === 'announcements' ? styles.active : ''}
              onClick={() => {
                setCurrentView('announcements');
                setShowAnnouncementModal(true);
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 0h-4V4h4v2z"/>
              </svg>
            </button>
            <button 
              className={currentView === 'polls' ? styles.active : ''}
              onClick={() => {
                setCurrentView('polls');
                setShowPollModal(true);
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V18h14v-1.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>
          </div>
          <button 
            className={styles.profileBtn}
            onClick={() => setShowProfile(true)}
          >
            <img 
              src={user?.photoURL || '/default-avatar.png'} 
              alt="Profile" 
            />
          </button>
        </nav>

        <main className={styles.main}>
          <Sidebar />
          <ChatArea />
          <div className={styles.rightPanel}>
            <GroupInfo />
            <MembersList />
          </div>
        </main>
      </div>
      <div className={`${styles.modalContainer} ${showProfile ? styles.visible : ''}`}>
        <UserProfile 
          show={showProfile}
          onClose={() => setShowProfile(false)}
          currentUser={user}
        />
      </div>
      {showPollModal && (
        <div className={styles.modalOverlay} onClick={() => {
          setShowPollModal(false);
          setCurrentView('');
        }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create Poll</h2>
              <button className={styles.closeButton} onClick={() => {
                setShowPollModal(false);
                setCurrentView('');
              }}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreatePoll({
                question: pollQuestion,
                options: pollOptions
              });
            }}>
              <input
                type="text"
                placeholder="Poll Question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className={styles.input}
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
                  className={styles.input}
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
                <button type="submit" className={styles.primaryButton}>
                  Create Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAnnouncementModal && (
        <div className={styles.modalOverlay} onClick={() => {
          setShowAnnouncementModal(false);
          setCurrentView('');
        }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Make Announcement</h2>
              <button className={styles.closeButton} onClick={() => {
                setShowAnnouncementModal(false);
                setCurrentView('');
              }}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateAnnouncement(announcement);
            }}>
              <textarea
                placeholder="Write your announcement..."
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                className={styles.textarea}
              />
              <div className={styles.modalActions}>
                <button type="submit" className={styles.primaryButton}>
                  Post Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 