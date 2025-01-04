import { useState } from 'react';
import styles from './Sidebar.module.css';
import CreateGroupModal from './CreateGroupModal';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`;
  return date.toLocaleDateString();
};

const Sidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { chats, setCurrentChat, clearInviteLink } = useChat();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleChatSelect = (chat) => {
    setCurrentChat(chat);
    clearInviteLink();
    navigate(`/chat/${chat.id}`);
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <button 
          onClick={() => setShowCreateGroup(true)}
          className={styles.createGroupButton}
          title="Create New Group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>

      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <svg 
          className={styles.searchIcon} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div className={styles.chatList}>
        {filteredChats.map(chat => (
          <div 
            key={chat.id} 
            className={`${styles.chatItem} ${chat.unread ? styles.unread : ''}`}
            onClick={() => handleChatSelect(chat)}
          >
            <div className={styles.avatarContainer}>
              {chat.type === 'group' ? (
                <div className={styles.groupAvatar}>
                  {chat.photoURL ? (
                    <img 
                      src={chat.photoURL === chat.thumbnailURL 
                        ? chat.photoURL 
                        : chat.photoURL || chat.thumbnailURL} 
                      alt={chat.name} 
                    />
                  ) : (
                    <div className={styles.groupInitial}>
                      {chat.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : (
                <img src={chat.photoURL || '/default-avatar.png'} alt={chat.name} />
              )}
              {chat.unread && <span className={styles.unreadBadge}>{chat.unreadCount}</span>}
            </div>
            <div className={styles.chatInfo}>
              <div className={styles.chatHeader}>
                <h3>{chat.name}</h3>
                <div className={styles.metadata}>
                  <span className={styles.time}>
                    {formatTime(chat.lastMessageTime)}
                  </span>
                  {chat.type === 'group' && (
                    <span className={styles.memberCount}>
                      {Object.keys(chat.members || {}).length || chat.memberCount || 0} members
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.messagePreview}>
                {chat.lastMessageSender && (
                  <span className={styles.sender}>
                    {chat.lastMessageSender === user?.uid ? 'You: ' : `${chat.lastMessageSenderName}: `}
                  </span>
                )}
                <p className={styles.lastMessage}>{chat.lastMessage}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </div>
  );
};

export default Sidebar; 