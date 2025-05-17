import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import UserProfile from './UserProfile';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './ChatLayout.module.css';
import GroupInfo from './GroupInfo';
import MembersList from './MembersList';
import DirectMessagePanel from './DirectMessagePanel';
import { getDatabase, ref, update } from 'firebase/database';

export default function ChatLayout() {
  const [showProfile, setShowProfile] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const iconInputRef = useRef(null);
  const { user } = useAuth();
  const { currentChat, createPoll, createAnnouncement, setCurrentChat } = useChat();
  const [currentView, setCurrentView] = useState('');
  // const [unreadCount] = useState(0);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['']);
  const [announcement, setAnnouncement] = useState('');
  const chatAreaRef = useRef(null);
  const [chatTypeView, setChatTypeView] = useState('group'); // 'group' or 'direct'

  // Automatically update chatTypeView when a direct message is selected
  useEffect(() => {
    if (currentChat && currentChat.type === 'private') {
      setChatTypeView('direct');
    }
  }, [currentChat]);

  const handleServerIconChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
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
    }
  };

  const handleCreatePoll = async (pollData) => {
    if (!currentChat) return;
    if (currentChat.type === 'private') return;
    await createPoll(pollData.question, pollData.options);
    setShowPollModal(false);
  };

  const handleCreateAnnouncement = async (announcement) => {
    if (!currentChat) return;
    if (currentChat.type === 'private') return;
    await createAnnouncement(announcement);
    setShowAnnouncementModal(false);
  };

  const openPollModal = () => {
    if (!currentChat) {
      setValidationMessage("You need to be in a group to create a poll.");
      setShowValidationDialog(true);
      return;
    }
    if (currentChat.type === 'private') {
      setValidationMessage("Polls can only be created in group chats, not in direct messages.");
      setShowValidationDialog(true);
      return;
    }
    setCurrentView('polls');
    setShowPollModal(true);
  };

  const openAnnouncementModal = () => {
    if (!currentChat) {
      setValidationMessage("You need to be in a group to make an announcement.");
      setShowValidationDialog(true);
      return;
    }
    if (currentChat.type === 'private') {
      setValidationMessage("Announcements can only be made in group chats, not in direct messages.");
      setShowValidationDialog(true);
      return;
    }
    setCurrentView('announcements');
    setShowAnnouncementModal(true);
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
          <div className={styles.navItems}>
            <button 
              className={chatTypeView === 'group' ? styles.active : ''}
              onClick={() => setChatTypeView('group')}
              title="Group Chats"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path>
                <circle cx="9" cy="7" r="4" fill="currentColor"></circle>
                <path fill="currentColor" d="M23 21v-2a4 4 0 00-3-3.87"></path>
                <path fill="currentColor" d="M16 3.13a4 4 0 010 7.75"></path>
              </svg>
            </button>
            
            <button 
              className={chatTypeView === 'direct' ? styles.active : ''}
              onClick={() => setChatTypeView('direct')}
              title="Direct Messages"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </button>

            {/* <button 
              className={currentView === 'messages' ? styles.active : ''}
              onClick={() => setCurrentView('messages')}
            >
              {unreadCount > 0 && (
                <span className={styles.badge}>{unreadCount}</span>
              )}
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </button> */}
            <button 
              className={currentView === 'announcements' ? styles.active : ''}
              onClick={openAnnouncementModal}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 0h-4V4h4v2z"/>
              </svg>
            </button>
            <button 
              className={currentView === 'polls' ? styles.active : ''}
              onClick={openPollModal}
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

        <main className={styles.main} ref={chatAreaRef}>
          <Sidebar chatTypeView={chatTypeView} />
          <ChatArea />
          <div className={styles.rightPanel}>
            {currentChat && currentChat.type === 'private' ? (
              <DirectMessagePanel />
            ) : (
              <>
                <GroupInfo />
                <MembersList />
              </>
            )}
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
      
      {/* Validation Dialog */}
      {showValidationDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowValidationDialog(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{currentChat?.type === 'private' ? "Feature Not Available" : "No Group Selected"}</h2>
              <button className={styles.closeButton} onClick={() => setShowValidationDialog(false)}>×</button>
            </div>
            <div className={styles.modalContent}>
              <p>{validationMessage}</p>
              {!currentChat && <p>Please join or select a group first.</p>}
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