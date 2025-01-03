import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import styles from './ChatArea.module.css';

export default function ChatArea() {
  const { currentChat, messages, sendMessage, handleVote } = useChat();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage.trim());
      setNewMessage('');
    }
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

      <div className={styles.messageList}>
        {messages.map((message, index) => (
          <>
            {shouldShowDate(message, index, messages) && (
              <div className={styles.dateSeparator}>
                <span>{formatDate(message.timestamp)}</span>
              </div>
            )}
            <div 
              key={message.id} 
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
          </>
        ))}
      </div>

      <form onSubmit={handleSend} className={styles.messageInput}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit">
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
} 