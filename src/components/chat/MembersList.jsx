import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import styles from './MembersList.module.css';

export default function MembersList() {
  const { currentChat, members, removeMember, addMember } = useChat();
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  const handleRemoveMember = async (memberId) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      await removeMember(currentChat.id, memberId);
    }
  };

  const handleAddMember = async (userId) => {
    await addMember(currentChat.id, userId);
    setShowAddMember(false);
  };

  if (!currentChat) return null;

  return (
    <div className={styles.membersList}>
      <div className={styles.header}>
        <h3>Members ({members.length})</h3>
        {isAdmin && (
          <button 
            onClick={() => setShowAddMember(true)}
            className={styles.addButton}
          >
            Add Member
          </button>
        )}
      </div>

      {showAddMember && (
        <div className={styles.addMemberSection}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {/* Add member list will be implemented here */}
        </div>
      )}

      <div className={styles.members}>
        {members.map(member => (
          <div key={member.uid} className={styles.memberItem}>
            <div className={styles.memberInfo}>
              <img 
                src={member.photoURL || '/default-avatar.png'} 
                alt={member.displayName} 
                className={styles.avatar}
              />
              <div className={styles.details}>
                <span className={styles.name}>
                  {member.displayName}
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