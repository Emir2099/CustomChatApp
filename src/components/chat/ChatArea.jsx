import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './ChatArea.module.css';
import React from 'react';

export default function ChatArea() {
  const { currentChat, messages, sendMessage, handleVote } = useChat();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const messageListRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [buttonFading, setButtonFading] = useState(false);
  const [newMessageReceived, setNewMessageReceived] = useState(false);
  const prevMessagesLengthRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const [userScrolling, setUserScrolling] = useState(false);
  const userManuallyScrolledRef = useRef(false);
  const isScrollingToBottomRef = useRef(false);
  const recentlySentMessageRef = useRef(false);

  // Force check if scrolling is actually needed
  const checkIfScrollNeeded = () => {
    if (!messageListRef.current) return false;
    
    const { scrollHeight, clientHeight } = messageListRef.current;
    // If content is not tall enough to scroll, no button needed
    return scrollHeight > clientHeight + 50; // Adding buffer
  };

  // Auto-scroll to bottom when chat is opened or messages change - but ONLY in specific cases
  useEffect(() => {
    // Only scroll automatically in these cases:
    // 1. First load of messages (prevMessagesLengthRef.current === 0)
    // 2. When user was already at the bottom when new message arrived
    // 3. When user themselves sent the message (captured in handleSend)
    // Do NOT auto-scroll when user has manually scrolled up to read history

    const isFirstLoad = prevMessagesLengthRef.current === 0;
    const newMessagesArrived = messages.length > prevMessagesLengthRef.current;
    
    if (messageListRef.current && ((isFirstLoad && messages.length > 0) || 
        (newMessagesArrived && isAtBottomRef.current && !userManuallyScrolledRef.current))) {
      // Auto-scroll in safe cases
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    } else if (newMessagesArrived && !isAtBottomRef.current) {
      // If new messages arrived but user is scrolled up, show notification
      if (checkIfScrollNeeded() && !recentlySentMessageRef.current) {
        setShowScrollButton(true);
        setNewMessageReceived(true);
        setTimeout(() => setNewMessageReceived(false), 1000);
      }
    }

    prevMessagesLengthRef.current = messages.length;
    
    // Clear recent message flag after a delay
    if (recentlySentMessageRef.current) {
      setTimeout(() => {
        recentlySentMessageRef.current = false;
      }, 1000);
    }
  }, [messages]);

  // Reset scroll state when chat changes
  useEffect(() => {
    if (currentChat) {
      if (showScrollButton) {
        setShowScrollButton(false);
        setButtonFading(false);
      }
      prevMessagesLengthRef.current = 0;
      isAtBottomRef.current = true;
      userManuallyScrolledRef.current = false;
      isScrollingToBottomRef.current = false;
      recentlySentMessageRef.current = false;
      
      // Reset and scroll to bottom when changing chats
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [currentChat?.id]);

  // Handle scroll events to show/hide scroll button
  const handleScroll = () => {
    // Don't process scroll events during programmatic scrolling
    if (!messageListRef.current || isScrollingToBottomRef.current || recentlySentMessageRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
    
    // Only show button if there's actually enough content to scroll
    if (!checkIfScrollNeeded()) {
      if (showScrollButton) {
        setShowScrollButton(false);
        setButtonFading(false);
      }
      return;
    }
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // Mark if user initiated this scroll
    if (!userScrolling) {
      setUserScrolling(true);
      userManuallyScrolledRef.current = true;
      setTimeout(() => setUserScrolling(false), 150); // Debounce
    }
    
    if (isNearBottom) {
      if (showScrollButton && !buttonFading) {
        setShowScrollButton(false);
        setButtonFading(false);
      }
      isAtBottomRef.current = true;
    } else {
      if (!showScrollButton && !buttonFading && !isScrollingToBottomRef.current) {
        setShowScrollButton(true);
      }
      isAtBottomRef.current = false;
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (!messageListRef.current) return;
    
    // Set a flag to prevent button flicker during scroll
    isScrollingToBottomRef.current = true;
    
    // Immediately hide button and prevent any reappearance during scrolling
    setShowScrollButton(false);
    setButtonFading(false);
    
    // Scroll to bottom
    messageListRef.current.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    
    // Reset scroll flags after animation completes
    userManuallyScrolledRef.current = false;
    setTimeout(() => {
      isScrollingToBottomRef.current = false;
      isAtBottomRef.current = true;
    }, 700); // Extended timeout to ensure scroll completes
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const message = newMessage.trim();
    setNewMessage('');
    
    // Mark as recently sent to prevent button from showing
    recentlySentMessageRef.current = true;
    
    // Send message first
    sendMessage(message);
    
    // User sent a message, so they want to see it - safe to scroll
    userManuallyScrolledRef.current = false;
    isScrollingToBottomRef.current = true;
    
    // Immediately hide button and prevent any reappearance during scrolling
    setShowScrollButton(false);
    setButtonFading(false);
    
    // Wait for the DOM to update with the new message before scrolling
    requestAnimationFrame(() => {
      // Use a longer timeout to ensure smooth animation after message is rendered
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTo({
            top: messageListRef.current.scrollHeight,
            behavior: 'smooth'
          });
          
          // Reset lock after scroll completes but keep the recently sent flag
          setTimeout(() => {
            isScrollingToBottomRef.current = false;
            isAtBottomRef.current = true;
            // Double-check that button is hidden
            if (showScrollButton) {
              setShowScrollButton(false);
              setButtonFading(false);
            }
          }, 700);
        }
      }, 150); // Slightly longer delay for smoother animation
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const shouldShowDate = (message, index, messages) => {
    if (!message.timestamp) return false;
    
    // For first message with timestamp
    if (index === 0) return true;
    
    const currentDate = new Date(message.timestamp).toDateString();
    const prevDate = new Date(messages[index - 1].timestamp || 0).toDateString();
    
    // Only show date separator if it's different from previous message's date
    // and the current message has a valid timestamp
    return currentDate !== prevDate && message.timestamp;
  };

  if (!currentChat) {
    return (
      <div className={styles.emptyChatArea}>
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2>Welcome to Your Chat Space</h2>
          <p>Start a conversation by selecting a chat or create a new group</p>
          <div className={styles.emptyStateFeatures}>
            <div className={styles.feature}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Create Groups</span>
            </div>
            <div className={styles.feature}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>Real-time Chat</span>
            </div>
            <div className={styles.feature}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Instant Notifications</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatArea}>
      <div className={styles.header}>
        <div className={styles.chatInfo}>
          <h2>{currentChat.name}</h2>
          <span className={styles.subtitle}>
            {currentChat.type === 'group' ? 'Group' : 'Direct Message'}
          </span>
        </div>
      </div>

      <div 
        className={styles.messageList} 
        ref={messageListRef} 
        onScroll={handleScroll}
      >
        {messages.map((message, index) => (
          <React.Fragment key={message.id}>
            {shouldShowDate(message, index, messages) && (
              <div className={styles.dateSeparator}>
                <span>{formatDate(message.timestamp)}</span>
              </div>
            )}
            <div 
              className={`${styles.message} ${
                message.type === 'poll' ? styles.pollMessage :
                message.type === 'announcement' ? styles.announcementMessage : 
                message.sender === user?.uid ? styles.sent : styles.received
              }`}
            >
              {message.type === 'poll' && (
                <div className={styles.pollMessage}>
                  <div className={styles.pollHeader}>
                    <div className={styles.pollCreator}>{message.senderName}</div>
                    <div className={styles.timestamp}>{formatTime(message.timestamp)}</div>
                  </div>
                  <div className={styles.pollQuestion}>{message.question}</div>
                  <div className={styles.pollOptions}>
                    {Object.entries(message.options || {}).map(([optionId, option]) => {
                      const votes = Object.keys(option.votes || {}).length;
                      const totalVotes = Object.values(message.options || {})
                        .reduce((sum, opt) => sum + Object.keys(opt.votes || {}).length, 0);
                      const percentage = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                      const hasVoted = option.votes && option.votes[user?.uid];

                      return (
                        <button
                          key={optionId}
                          className={`${styles.pollOption} ${hasVoted ? styles.voted : ''}`}
                          onClick={() => handleVote(message.id, optionId)}
                          disabled={Object.values(message.options || {})
                            .some(opt => opt.votes?.[user?.uid])}
                        >
                          <div className={styles.pollOptionContent}>
                            <span>{option.text}</span>
                            <span className={styles.voteCount}>{votes} votes</span>
                          </div>
                          <div className={styles.pollOptionBar}>
                            <div 
                              className={styles.pollOptionProgress} 
                              style={{ width: `${percentage}%` }} 
                            />
                            <span className={styles.pollOptionPercentage}>{percentage}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.pollFooter}>
                    Total votes: {Object.values(message.options || {})
                      .reduce((sum, opt) => sum + Object.keys(opt.votes || {}).length, 0)}
                  </div>
                </div>
              )}
              {message.type === 'announcement' && (
                <>
                  <div className={styles.sender}>{message.senderName}</div>
                  <div className={styles.content}>{message.content}</div>
                  <div className={styles.timestamp}>
                    {formatTime(message.timestamp)}
                  </div>
                </>
              )}
              {!message.type && (
                <div className={styles.bubble}>
                  {message.sender !== user?.uid && (
                    <div className={styles.senderName}>{message.senderName}</div>
                  )}
                  {message.content}
                  <span className={styles.timestamp}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {(showScrollButton || buttonFading) && (
        <button 
          type="button"
          className={`${styles.scrollButton} ${newMessageReceived ? styles.bounce : ''} ${buttonFading ? styles.fadeOut : ''}`} 
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to bottom"
        >
          <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor" strokeWidth="0">
            <path d="M12 17.5l-6-6 1.4-1.4 4.6 4.6 4.6-4.6L18 11.5z" />
          </svg>
        </button>
      )}

      <form onSubmit={handleSend} className={styles.messageInput}>
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" title="Send message">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
} 