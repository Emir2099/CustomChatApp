import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import styles from './DirectMessagePanel.module.css';

// Map status to color and label
const statusMappings = {
  online: { color: '#4ade80', label: 'Online' },
  away: { color: '#fbbf24', label: 'Away' },
  busy: { color: '#ef4444', label: 'Do Not Disturb' },
  offline: { color: '#9ca3af', label: 'Offline' }
};

// Helper to get status info based on status key
const getStatusInfo = (status) => {
  return statusMappings[status] || statusMappings.offline;
};

// Map Firebase status to display status
const mapStatusToUserStatus = (status) => {
  if (!status) return 'offline';
  
  switch(status.toLowerCase()) {
    case 'available':
      return 'online';
    case 'away':
      return 'away';
    case 'do not disturb':
      return 'busy';
    case 'in a meeting':
      return 'busy';
    case 'offline':
      return 'offline';
    default:
      return 'offline';
  }
};

// Format date for better readability
const formatLastActive = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  return date.toLocaleString();
};

export default function DirectMessagePanel() {
  const { currentChat, allUsers, typingUsers, blockUser, unblockUser, isUserBlocked } = useChat();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  
  // Get the other user in the conversation
  useEffect(() => {
    if (!currentChat || !user || !allUsers || currentChat.type !== 'private') {
      setOtherUser(null);
      setOtherUserId(null);
      return;
    }

    // Try to find the other user
    let foundUserId = null;
    
    if (currentChat.participants) {
      foundUserId = Object.keys(currentChat.participants).find(id => id !== user.uid);
      if (foundUserId && allUsers[foundUserId]) {
        setOtherUser(allUsers[foundUserId]);
        setOtherUserId(foundUserId);
        return;
      }
    }

    if (currentChat.members) {
      foundUserId = Object.keys(currentChat.members).find(id => id !== user.uid);
      if (foundUserId && allUsers[foundUserId]) {
        setOtherUser(allUsers[foundUserId]);
        setOtherUserId(foundUserId);
        return;
      }
    }

    // Try to find by name as fallback
    const foundUser = Object.values(allUsers).find(u => 
      (u.displayName === currentChat.name || u.email === currentChat.name) && u.uid !== user.uid
    );
    
    if (foundUser) {
      setOtherUser(foundUser);
      setOtherUserId(foundUser.uid);
    }
  }, [currentChat, user, allUsers]);

  // Check if the user is blocked
  useEffect(() => {
    if (!otherUserId || !isUserBlocked) return;

    const blocked = isUserBlocked(otherUserId);
    setIsBlocked(blocked);
  }, [otherUserId, isUserBlocked, allUsers]);

  // Check if the other user is actually typing using typingUsers from context
  const isTyping = otherUserId && typingUsers && typingUsers[currentChat?.id]?.[otherUserId];

  const handleBlockUser = async () => {
    if (!otherUserId || actionInProgress) return;
    
    setActionInProgress(true);
    
    try {
      await blockUser(otherUserId);
      setIsBlocked(true);
      setShowBlockConfirm(false);
    } catch (error) {
      console.error("Error blocking user:", error);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!otherUserId || actionInProgress) return;
    
    setActionInProgress(true);
    
    try {
      await unblockUser(otherUserId);
      setIsBlocked(false);
      setShowUnblockConfirm(false);
    } catch (error) {
      console.error("Error unblocking user:", error);
    } finally {
      setActionInProgress(false);
    }
  };

  if (!currentChat || currentChat.type !== 'private' || !otherUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <div className={styles.animationContainer}>
            <div className={styles.messageBubble}></div>
            <div className={styles.messageBubble}></div>
            <div className={styles.messageBubble}></div>
          </div>
          <p>Select a direct message to view details</p>
        </div>
      </div>
    );
  }

  const userStatus = mapStatusToUserStatus(otherUser.status);
  const statusInfo = getStatusInfo(userStatus);

  return (
    <div className={styles.directMessagePanel}>
      <div className={styles.header}>
        <h2>Chat Details</h2>
      </div>
      
      <div className={styles.userProfileSection}>
        <div className={styles.userAvatarContainer}>
          <div className={styles.userAvatar}>
            {otherUser.photoURL ? (
              <img src={otherUser.photoURL} alt={otherUser.displayName || otherUser.email} />
            ) : (
              <div className={styles.initialsAvatar}>
                {(otherUser.displayName || otherUser.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div 
            className={`${styles.statusIndicator} ${styles[`status-${userStatus}`]}`}
            style={{ backgroundColor: statusInfo.color }}
          ></div>
        </div>
        
        <h3 className={styles.userName}>{otherUser.displayName || otherUser.email}</h3>
        <p className={styles.userStatus}>
          <span 
            className={`${styles.statusDot} ${styles[`status-${userStatus}`]}`}
            style={{ backgroundColor: statusInfo.color }}
          ></span>
          {statusInfo.label}
        </p>
      </div>
      
      <div className={styles.activitySection}>
        <div className={styles.activityHeader}>
          <h4>Activity</h4>
          <div className={styles.activityIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
        </div>
        
        {isTyping ? (
          <div className={styles.typingIndicator}>
            <p>
              <span className={styles.typingText}>{otherUser.displayName?.split(' ')[0] || 'User'} is typing</span>
              <span className={styles.dot1}>.</span>
              <span className={styles.dot2}>.</span>
              <span className={styles.dot3}>.</span>
            </p>
          </div>
        ) : (
          <p className={styles.lastActivity}>
            <span className={styles.activityLabel}>Last active:</span>
            <span className={styles.activityTime}>{formatLastActive(otherUser.lastSeen)}</span>
          </p>
        )}
      </div>
      
      <div className={styles.infoSection}>
        <div className={styles.infoCard}>
          <div className={styles.iconContainer}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </div>
          <div className={styles.infoContent}>
            <h5>Direct Message</h5>
            <p>Messages are private between you both</p>
          </div>
        </div>
        
        <div className={styles.infoCard}>
          <div className={styles.iconContainer}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div className={styles.infoContent}>
            <h5>Secure Chat</h5>
            <p>Your conversations are encrypted and private</p>
          </div>
        </div>
        
        {/* Block/Unblock section */}
        <div className={styles.blockSection}>
          {isBlocked ? (
            <>
              <div className={styles.blockedBanner}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                <p>You've blocked this user</p>
              </div>
              
              <button 
                className={styles.unblockButton}
                onClick={() => setShowUnblockConfirm(true)}
                disabled={actionInProgress}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Unblock User
              </button>
            </>
          ) : (
            <button 
              className={styles.blockButton}
              onClick={() => setShowBlockConfirm(true)}
              disabled={actionInProgress}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              Block User
            </button>
          )}
        </div>

        {showBlockConfirm && (
          <div className={styles.confirmationDialog}>
            <div className={styles.confirmationContent}>
              <h4>Block {otherUser.displayName || "User"}?</h4>
              <p>They won't be able to contact you, and you won't see their messages.</p>
              <div className={styles.confirmButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowBlockConfirm(false)}
                  disabled={actionInProgress}
                >
                  Cancel
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handleBlockUser}
                  disabled={actionInProgress}
                >
                  {actionInProgress ? 'Blocking...' : 'Block'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showUnblockConfirm && (
          <div className={styles.confirmationDialog}>
            <div className={styles.confirmationContent}>
              <h4>Unblock {otherUser.displayName || "User"}?</h4>
              <p>They will be able to contact you again, and you'll see their messages.</p>
              <div className={styles.confirmButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowUnblockConfirm(false)}
                  disabled={actionInProgress}
                >
                  Cancel
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handleUnblockUser}
                  disabled={actionInProgress}
                >
                  {actionInProgress ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className={styles.messagesSummary}>
          <div className={styles.bubbleAnimation}>
            <div className={styles.chatBubble}></div>
            <div className={styles.chatBubble}></div>
            <div className={styles.chatBubble}></div>
          </div>
        </div>
      </div>
    </div>
  );
} 