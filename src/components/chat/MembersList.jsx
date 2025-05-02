import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import { db } from '../../config/firebase';
import { ref, onValue } from 'firebase/database';
import styles from './MembersList.module.css';

const getInitials = (email, displayName) => {
  if (displayName) {
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
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

export default function MembersList() {
  const { currentChat, members, removeMember } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [enhancedMembers, setEnhancedMembers] = useState([]);
  const userListenersRef = useRef({});
  
  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  // Set up real-time listeners for each member
  useEffect(() => {
    if (!members || members.length === 0) return;
    
    // Clean up previous listeners
    Object.values(userListenersRef.current).forEach(unsubscribe => unsubscribe());
    userListenersRef.current = {};
    
    // Create new member data with real-time updates
    const newEnhancedMembers = [...members];
    
    // Set up listeners for each member
    members.forEach((member, index) => {
      const userRef = ref(db, `users/${member.uid}`);
      const unsubscribe = onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          // Create updated member data
          const updatedMember = {
            ...member,
            ...userData
          };
          
          // Update the member in the array
          newEnhancedMembers[index] = updatedMember;
          setEnhancedMembers([...newEnhancedMembers]);
        }
      });
      
      // Store the unsubscribe function
      userListenersRef.current[member.uid] = unsubscribe;
    });
    
    // Initialize with current data
    setEnhancedMembers(newEnhancedMembers);
    
    // Cleanup function
    return () => {
      Object.values(userListenersRef.current).forEach(unsubscribe => unsubscribe());
      userListenersRef.current = {};
    };
  }, [members]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const handleRemoveMember = async (memberId) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      await removeMember(currentChat.id, memberId);
    }
  };

  const handleMouseEnter = (member, e) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Calculate position - show on right side if there's room, otherwise left
    const showOnRight = rect.right + 250 < viewportWidth;
    
    setTooltipPosition({
      x: showOnRight ? rect.right + 10 : rect.left - 250 - 10,
      y: rect.top,
    });
    
    setActiveTooltip(member);
  };

  const handleMouseLeave = () => {
    // Use a timeout to delay hiding the tooltip
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 300); // 300ms delay gives time to move to the tooltip
  };
  
  const handleTooltipMouseEnter = () => {
    // Cancel the timeout when mouse enters the tooltip
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };
  
  const handleTooltipMouseLeave = () => {
    // Hide the tooltip when the mouse leaves it
    setActiveTooltip(null);
  };

  // Filter members based on search query
  const filteredMembers = enhancedMembers.filter(member => 
    member.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentChat) return null;

  return (
    <div className={styles.membersList}>
      <div className={styles.header}>
        <h3>Members ({members.length})</h3>
      </div>

      {/* Search box for filtering members */}
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.members}>
        {filteredMembers.map(member => {
          const status = mapStatusToUserStatus(member.status);
          const isOffline = status === 'offline';
          
          return (
            <div 
              key={member.uid} 
              className={`${styles.memberItem} ${styles[status]}`}
              onMouseEnter={(e) => handleMouseEnter(member, e)}
              onMouseLeave={handleMouseLeave}
            >
              {!isOffline && (
                <div className={styles.rippleContainer}>
                  <div className={`${styles.ripple} ${styles[`ripple-${status}`]}`}></div>
                </div>
              )}
              <div className={styles.memberInfo}>
                <div className={`${styles.avatar} ${styles[`status-${status}`]}`}>
                  {member.photoURL ? (
                    <img 
                      src={member.photoURL === member.thumbnailURL 
                        ? member.photoURL 
                        : member.photoURL || member.thumbnailURL} 
                      alt={member.displayName} 
                    />
                  ) : (
                    <span>{getInitials(member.email, member.displayName)}</span>
                  )}
                  <div className={`${styles.statusIndicator} ${styles[`status-${status}`]}`}></div>
                </div>
                <div className={styles.details}>
                  <span className={styles.name}>
                    {member.displayName || member.email}
                    {member.uid === auth.currentUser?.uid && ' (You)'}
                  </span>
                  <span className={styles.role}>
                    {currentChat.admins?.[member.uid] ? 'Admin' : 'Member'}
                  </span>
                </div>
              </div>
              {isAdmin && member.uid !== auth.currentUser?.uid && (
                <button
                  onClick={() => handleRemoveMember(member.uid)}
                  className={styles.removeButton}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeTooltip && (
        <div 
          className={styles.userTooltip}
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: `${tooltipPosition.y}px`,
            left: `${tooltipPosition.x}px`,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <div className={`${styles.tooltipHeader} ${styles[`tooltip-${mapStatusToUserStatus(activeTooltip.status)}`]}`}>
            <div className={styles.tooltipAvatar}>
              {activeTooltip.photoURL ? (
                <img src={activeTooltip.photoURL} alt={activeTooltip.displayName} />
              ) : (
                <span>{getInitials(activeTooltip.email, activeTooltip.displayName)}</span>
              )}
            </div>
            <div className={styles.tooltipUserInfo}>
              <h3>{activeTooltip.displayName || 'Anonymous User'}</h3>
              {activeTooltip.email ? (
                <p className={styles.tooltipEmail}>{activeTooltip.email}</p>
              ) : (
                <p className={styles.tooltipEmail}>No email available</p>
              )}
            </div>
          </div>
          <div className={styles.tooltipBody}>
            <div className={styles.tooltipInfo}>
              <span className={styles.tooltipLabel}>Status:</span>
              <span className={`${styles.tooltipValue} ${styles[`text-${mapStatusToUserStatus(activeTooltip.status)}`]}`}>
                {activeTooltip.status || 'Offline'}
              </span>
            </div>
            {activeTooltip.bio && (
              <div className={styles.tooltipInfo}>
                <span className={styles.tooltipLabel}>Bio:</span>
                <span className={styles.tooltipValue}>{activeTooltip.bio}</span>
              </div>
            )}
            <div className={styles.tooltipInfo}>
              <span className={styles.tooltipLabel}>Role:</span>
              <span className={styles.tooltipValue}>
                {currentChat.admins?.[activeTooltip.uid] ? 'Admin' : 'Member'}
              </span>
            </div>
            {activeTooltip.joinedAt && (
              <div className={styles.tooltipInfo}>
                <span className={styles.tooltipLabel}>Joined:</span>
                <span className={styles.tooltipValue}>
                  {new Date(activeTooltip.joinedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <div className={styles.tooltipFooter}>
            <button className={styles.messageButton}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
              Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 