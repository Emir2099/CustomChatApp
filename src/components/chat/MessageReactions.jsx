import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import styles from './ChatArea.module.css';

// Expanded reaction emojis
const REACTIONS = [
  { emoji: '👍', name: 'thumbs up' },
  { emoji: '❤️', name: 'heart' },
  { emoji: '😂', name: 'laugh' },
  { emoji: '😮', name: 'wow' },
  { emoji: '😢', name: 'sad' },
  { emoji: '🔥', name: 'fire' },
  { emoji: '🎉', name: 'party' },
  { emoji: '👏', name: 'clap' },
  { emoji: '🙏', name: 'pray' },
  { emoji: '🥰', name: 'loving' },
  { emoji: '😍', name: 'heart eyes' },
  { emoji: '🤔', name: 'thinking' },
  { emoji: '😎', name: 'cool' },
  { emoji: '😁', name: 'grinning' },
  { emoji: '🤩', name: 'star struck' },
  { emoji: '😋', name: 'yum' },
  { emoji: '🤪', name: 'zany' },
  { emoji: '👌', name: 'ok' },
  { emoji: '✅', name: 'check' },
  { emoji: '💯', name: 'hundred' }
];

// Number of emojis to display at once
const EMOJIS_PER_PAGE = 8;

function MessageReactions({ message }) {
  const { handleReaction } = useChat();
  const { user } = useAuth();
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const [newReactions, setNewReactions] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [animating, setAnimating] = useState(false);
  const panelRef = useRef(null);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  // Check if the message is sent by the current user
  const isSentByUser = message.sender === user?.uid;

  // Calculate total pages based on emojis per page
  const totalPages = Math.ceil(REACTIONS.length / EMOJIS_PER_PAGE);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowReactionPanel(false);
      }
    };

    if (showReactionPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionPanel]);

  // Listen for custom events to show the reaction panel
  useEffect(() => {
    const handleShowPanel = () => {
      setShowReactionPanel(true);
    };

    if (wrapperRef.current) {
      wrapperRef.current.addEventListener('showReactionPanel', handleShowPanel);
    }

    return () => {
      if (wrapperRef.current) {
        wrapperRef.current.removeEventListener('showReactionPanel', handleShowPanel);
      }
    };
  }, []);

  // Handle page navigation with simplified animation
  const changePage = (pageIndex) => {
    if (pageIndex === currentPage || animating) return;
    
    setAnimating(true);
    
    // Apply animation class
    setTimeout(() => {
      setCurrentPage(pageIndex);
      
      // Remove animation class after animation completes
      setTimeout(() => {
        setAnimating(false);
      }, 200);
    }, 10);
  };

  // Get current emojis to display based on pagination
  const getCurrentEmojis = () => {
    const startIdx = currentPage * EMOJIS_PER_PAGE;
    return REACTIONS.slice(startIdx, startIdx + EMOJIS_PER_PAGE);
  };

  // Generate dot navigation elements
  const renderDotNavigation = () => {
    if (totalPages <= 1) return null;
    
    const dots = [];
    for (let i = 0; i < totalPages; i++) {
      dots.push(
        <button
          key={i}
          className={`${styles.navigationDot} ${i === currentPage ? styles.active : ''}`}
          onClick={() => changePage(i)}
          aria-label={`Page ${i + 1} of reactions`}
        />
      );
    }
    return <div className={styles.dotsNavigation}>{dots}</div>;
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const addReaction = async (emoji) => {
    if (!handleReaction || !message.id) {
      console.error('Cannot add reaction: missing handleReaction function or message.id');
      return;
    }
    
    try {
      // Track this as a new reaction for animation
      setNewReactions(prev => ({ ...prev, [emoji]: true }));
      
      // Call the API to add the reaction
      await handleReaction(message.id, emoji);
      
      // Clear animation after it plays
      timerRef.current = setTimeout(() => {
        setNewReactions(prev => {
          const updated = { ...prev };
          delete updated[emoji];
          return updated;
        });
      }, 1000);
      
      // Hide the panel after selecting
      setShowReactionPanel(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  return (
    <div 
      className={styles.reactionsWrapper} 
      ref={wrapperRef}
      data-message-id={message.id}
    >
      {/* Reaction selector panel with dot navigation */}
      {showReactionPanel && (
        <div 
          ref={panelRef}
          className={styles.reactionsPanel}
        >
          <div className={`${styles.reactionsPanelGrid} ${animating ? styles.slideRight : ''}`}>
            {getCurrentEmojis().map(reaction => (
              <button 
                key={reaction.emoji} 
                className={styles.reactionOption} 
                onClick={() => addReaction(reaction.emoji)}
                aria-label={`React with ${reaction.name}`}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
          
          {/* Vertical dot navigation */}
          {renderDotNavigation()}
        </div>
      )}

      {/* Display existing reactions */}
      <div className={styles.reactionsContainer}>
        {message.reactions && Object.entries(message.reactions).map(([emoji, users]) => {
          if (!users) return null;
          
          const reactors = Object.keys(users).filter(key => users[key]);
          if (reactors.length === 0) return null;
          
          const hasReacted = users[user?.uid];
          const isNew = newReactions[emoji];
          
          return (
            <button 
              key={emoji} 
              className={`${styles.reactionCounter} ${hasReacted ? styles.active : ''} ${isNew ? styles.new : ''}`}
              onClick={() => addReaction(emoji)}
              title={`${reactors.length} reaction${reactors.length !== 1 ? 's' : ''}`}
            >
              <span className={styles.reactionEmoji}>{emoji}</span>
              <span className={styles.reactionCount}>{reactors.length}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MessageReactions; 