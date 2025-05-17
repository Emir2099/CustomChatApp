import { useState, useRef, useEffect } from 'react';
import styles from './Sidebar.module.css';
import CreateGroupModal from './CreateGroupModal';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatListSkeleton from './ChatListSkeleton';
import PropTypes from 'prop-types';

const Sidebar = ({ chatTypeView = 'group' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { chats, currentChat, clearInviteLink, handleChatSelect, chatsLoading } = useChat();
  // Using useAuth hook to ensure the auth context is initialized, even if we don't directly use user here
  useAuth(); 
  const navigate = useNavigate();
  const [overflowingChats, setOverflowingChats] = useState({});
  const chatItemRefs = useRef({});
  const initialLoadCompletedRef = useRef(false);
  
  // Track when initial load is completed to prevent showing skeleton on chat switching
  useEffect(() => {
    if (chats.length > 0 && chatsLoading === false) {
      initialLoadCompletedRef.current = true;
    }
  }, [chats.length, chatsLoading]);

  const onChatSelect = async (chat) => {
    await handleChatSelect(chat);
    clearInviteLink();
    navigate(`/chat/${chat.id}`);
  };

  // Only show skeleton during initial load, not when switching chats
  const shouldShowSkeleton = chatsLoading && !initialLoadCompletedRef.current;

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

  // Filter chats based on search query
  const searchFilteredChats = chats.filter(chat => 
    chat && chat.name && chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Further filter chats by type (group or private)
  const filteredChats = searchFilteredChats.filter(chat => 
    chatTypeView === 'group' ? chat.type === 'group' : chat.type === 'private'
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
          placeholder={`Search ${chatTypeView === 'group' ? 'groups' : 'messages'}...`}
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

      <div className={`${styles.chatList} ${shouldShowSkeleton ? styles.loading : ''}`}>
        {shouldShowSkeleton ? (
          <ChatListSkeleton count={6} />
        ) : filteredChats.length === 0 ? (
          <div className={styles.emptyListMessage}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.emptyIcon}>
              {chatTypeView === 'private' ? (
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              ) : (
                <>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 010 7.75"></path>
                </>
              )}
            </svg>
            <p>
              {chatTypeView === 'private' 
                ? 'No direct messages yet. Start a conversation by clicking on a user profile.' 
                : 'No group chats found. Create a new group to get started.'}
            </p>
          </div>
        ) : (
          filteredChats.map(chat => (
            <div 
              key={chat.id} 
              className={`${styles.chatItem} 
                ${chat.unreadCount > 0 ? styles.unread : ''} 
                ${currentChat?.id === chat.id ? styles.active : ''}
                ${chat.type === 'private' ? styles.privateChat : styles.groupChat}`}
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
                  <div className={styles.userAvatar}>
                    {chat.photoURL ? (
                      <img src={chat.photoURL} alt={chat.name} />
                    ) : (
                      <div className={styles.groupInitial}>
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={chat.onlineStatus ? `${styles.onlineIndicator} ${styles.online}` : styles.onlineIndicator}></div>
                  </div>
                )}
              </div>
              
              <div className={styles.chatInfo}>
                <div className={styles.chatHeader}>
                  <h3>{chat.name}</h3>
                  {chat.type === 'group' ? (
                    <span className={styles.memberCount}>
                      {chat.memberCount || 0} members
                    </span>
                  ) : (
                    <span className={styles.directChat}>
                      Direct Message
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
          ))
        )}
      </div>

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </div>
  );
};

Sidebar.propTypes = {
  chatTypeView: PropTypes.string
};

export default Sidebar; 