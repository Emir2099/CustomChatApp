import { useState, useRef, useEffect } from 'react';
import styles from './Sidebar.module.css';
import CreateGroupModal from './CreateGroupModal';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { chats, currentChat, clearInviteLink, handleChatSelect } = useChat();
  useAuth();
  const navigate = useNavigate();
  const [overflowingChats, setOverflowingChats] = useState({});
  const chatItemRefs = useRef({});

  const onChatSelect = async (chat) => {
    await handleChatSelect(chat);
    clearInviteLink();
    navigate(`/chat/${chat.id}`);
  };

  useEffect(() => {
    const checkOverflow = () => {
      const newOverflowState = {};
      
      Object.keys(chatItemRefs.current).forEach(chatId => {
        const chatItem = chatItemRefs.current[chatId];
        if (!chatItem) return;
        
        const badgesContainer = chatItem.querySelector(`.${styles.unreadBadges}`);
        if (!badgesContainer) return;
        
        const chatInfoWidth = chatItem.querySelector(`.${styles.chatInfo}`)?.clientWidth || 0;
        const chatHeaderWidth = chatItem.querySelector(`.${styles.chatHeader}`)?.clientWidth || 0;
        const availableWidth = chatInfoWidth - chatHeaderWidth - 20;
        
        newOverflowState[chatId] = badgesContainer.scrollWidth > availableWidth;
      });
      
      setOverflowingChats(newOverflowState);
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    
    return () => {
      window.removeEventListener('resize', checkOverflow);
    };
  }, [chats]);

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
            className={`${styles.chatItem} 
              ${chat.unreadCount > 0 ? styles.unread : ''} 
              ${currentChat?.id === chat.id ? styles.active : ''}`}
            onClick={() => onChatSelect(chat)}
            ref={el => chatItemRefs.current[chat.id] = el}
          >
            <div className={styles.avatarContainer}>
              {chat.type === 'group' ? (
                <div className={styles.groupAvatar}>
                  {chat.iconURL || chat.photoURL ? (
                    <img 
                      src={chat.iconURL || chat.photoURL} 
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
            </div>
            
            <div className={styles.chatInfo}>
              <div className={styles.chatHeader}>
                <h3>{chat.name}</h3>
                {chat.type === 'group' && (
                  <span className={styles.memberCount}>
                    {chat.memberCount || 0} members
                  </span>
                )}
              </div>
              
              {(chat.unreadMessages > 0 || chat.unreadAnnouncements > 0 || chat.unreadPolls > 0) && (
                <div className={styles.unreadBadges}>
                  {overflowingChats[chat.id] ? (
                    <>
                      {chat.unreadMessages > 0 && (
                        <span 
                          className={`${styles.dotBadge} ${styles.messageBadge}`}
                          data-count={chat.unreadMessages}
                        />
                      )}
                      
                      {chat.unreadAnnouncements > 0 && (
                        <span 
                          className={`${styles.dotBadge} ${styles.announcementBadge}`}
                          data-count={chat.unreadAnnouncements}
                        />
                      )}
                      
                      {chat.unreadPolls > 0 && (
                        <span 
                          className={`${styles.dotBadge} ${styles.pollBadge}`}
                          data-count={chat.unreadPolls}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {chat.unreadMessages > 0 && (
                        <span 
                          className={`${styles.unreadBadge} ${styles.messageBadge} ${styles.badgeWithTooltip}`}
                          data-tooltip="New messages"
                        >
                          {chat.unreadMessages}
                        </span>
                      )}
                      
                      {chat.unreadAnnouncements > 0 && (
                        <span 
                          className={`${styles.unreadBadge} ${styles.announcementBadge} ${styles.badgeWithTooltip}`}
                          data-tooltip="New announcements"
                        >
                          {chat.unreadAnnouncements}
                        </span>
                      )}
                      
                      {chat.unreadPolls > 0 && (
                        <span 
                          className={`${styles.unreadBadge} ${styles.pollBadge} ${styles.badgeWithTooltip}`}
                          data-tooltip="New polls"
                        >
                          {chat.unreadPolls}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
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