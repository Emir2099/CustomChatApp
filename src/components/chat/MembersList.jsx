import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
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

export default function MembersList() {
  const { currentChat, members, removeMember } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  
  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  const handleRemoveMember = async (memberId) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      await removeMember(currentChat.id, memberId);
    }
  };

  // Filter members based on search query
  const filteredMembers = members.filter(member => 
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
        {filteredMembers.map(member => (
          <div key={member.uid} className={styles.memberItem}>
            <div className={styles.memberInfo}>
              <div className={styles.avatar}>
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
        ))}
      </div>
    </div>
  );
} 