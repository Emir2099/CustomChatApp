import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './CreateGroupModal.module.css';
import PropTypes from 'prop-types';

export default function CreateGroupModal({ onClose }) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { users, createGroup } = useChat();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredUsers = users?.filter(user => 
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    setIsLoading(true);
    try {
      await createGroup(groupName.trim(), selectedUsers);
      onClose();
    } catch (error) {
      setError('Failed to create group. Please try again.');
      console.error('Error creating group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Create New Group</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="groupName">Group Name</label>
            <input
              type="text"
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Add Members ({selectedUsers.length} selected)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users"
              className={styles.searchInput}
            />
          </div>

          <div className={styles.userList}>
            {filteredUsers.map(user => (
              <div 
                key={user.uid}
                className={`${styles.userItem} ${
                  selectedUsers.includes(user.uid) ? styles.selected : ''
                }`}
                onClick={() => handleUserToggle(user.uid)}
              >
                <img 
                  src={user.photoURL || '/default-avatar.png'} 
                  alt={user.displayName} 
                  className={styles.avatar}
                />
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.displayName}</span>
                  <span className={styles.userEmail}>{user.email}</span>
                </div>
                {selectedUsers.includes(user.uid) && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.createButton}
              disabled={!groupName.trim() || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateGroupModal.propTypes = {
  onClose: PropTypes.func.isRequired
}; 