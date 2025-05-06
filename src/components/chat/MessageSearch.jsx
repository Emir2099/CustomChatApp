import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './MessageSearch.module.css';

export default function MessageSearch({ onMessageSelect, onClose }) {
  const { messages, currentChat } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [activeFilters, setActiveFilters] = useState({
    date: null,
    sender: null,
    contentType: null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueSenders, setUniqueSenders] = useState([]);
  const [dateOptions, setDateOptions] = useState([]);
  const inputRef = useRef(null);

  // Focus on the search input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Extract unique senders and dates for filter options
  useEffect(() => {
    if (!messages.length) return;

    // Get unique senders
    const senders = [...new Set(messages.map(msg => msg.senderName))];
    setUniqueSenders(senders);

    // Get unique dates (by day)
    const dates = [...new Set(messages.map(msg => {
      if (!msg.timestamp) return null;
      const date = new Date(msg.timestamp);
      return date.toDateString();
    }))].filter(Boolean);

    // Format dates for display
    const formattedDates = dates.map(dateStr => {
      const date = new Date(dateStr);
      return {
        value: dateStr,
        label: formatDateForDisplay(date)
      };
    });

    setDateOptions(formattedDates);
  }, [messages]);

  // Search through messages when query or filters change
  useEffect(() => {
    if (!searchQuery && !hasActiveFilters()) {
      setFilteredMessages([]);
      return;
    }

    const results = messages.filter(message => {
      // Skip messages without content (like file messages without description)
      if (!message.content && !message.type) return false;

      // Match search query in content
      const contentMatch = !searchQuery || 
        (message.content && message.content.toLowerCase().includes(searchQuery.toLowerCase()));

      // Match date filter
      const dateMatch = !activeFilters.date || 
        (message.timestamp && new Date(message.timestamp).toDateString() === activeFilters.date);

      // Match sender filter
      const senderMatch = !activeFilters.sender || message.senderName === activeFilters.sender;

      // Match content type filter
      const typeMatch = !activeFilters.contentType || 
        (activeFilters.contentType === 'text' && !message.type) ||
        (activeFilters.contentType === 'file' && message.type === 'file') ||
        (activeFilters.contentType === 'poll' && message.type === 'poll') ||
        (activeFilters.contentType === 'announcement' && message.type === 'announcement');

      return contentMatch && dateMatch && senderMatch && typeMatch;
    });

    setFilteredMessages(results);
  }, [searchQuery, activeFilters, messages]);

  // Check if any filters are active
  const hasActiveFilters = () => {
    return Object.values(activeFilters).some(value => value !== null);
  };

  // Format date for display
  const formatDateForDisplay = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Format timestamp for display in results
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Handle applying a filter
  const applyFilter = (type, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: prev[type] === value ? null : value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setActiveFilters({
      date: null,
      sender: null,
      contentType: null
    });
  };

  // Handle selecting a message from search results
  const handleSelectMessage = (message) => {
    if (onMessageSelect) {
      onMessageSelect(message);
    }
  };

  return (
    <div className={styles.searchOverlay}>
      <div className={styles.searchContainer}>
        <div className={styles.searchHeader}>
          <h3>Search Messages</h3>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close search"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className={styles.searchInputContainer}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search in conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button 
            className={styles.filterButton} 
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filters</span>
          </button>
        </div>
        
        {showFilters && (
          <div className={styles.filtersPanel}>
            <div className={styles.filterSection}>
              <h4>Date</h4>
              <div className={styles.filterOptions}>
                {dateOptions.map(date => (
                  <button
                    key={date.value}
                    className={`${styles.filterOption} ${activeFilters.date === date.value ? styles.active : ''}`}
                    onClick={() => applyFilter('date', date.value)}
                  >
                    {date.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={styles.filterSection}>
              <h4>Sender</h4>
              <div className={styles.filterOptions}>
                {uniqueSenders.map(sender => (
                  <button
                    key={sender}
                    className={`${styles.filterOption} ${activeFilters.sender === sender ? styles.active : ''}`}
                    onClick={() => applyFilter('sender', sender)}
                  >
                    {sender}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={styles.filterSection}>
              <h4>Content Type</h4>
              <div className={styles.filterOptions}>
                <button
                  className={`${styles.filterOption} ${activeFilters.contentType === 'text' ? styles.active : ''}`}
                  onClick={() => applyFilter('contentType', 'text')}
                >
                  Text
                </button>
                <button
                  className={`${styles.filterOption} ${activeFilters.contentType === 'file' ? styles.active : ''}`}
                  onClick={() => applyFilter('contentType', 'file')}
                >
                  Files
                </button>
                <button
                  className={`${styles.filterOption} ${activeFilters.contentType === 'poll' ? styles.active : ''}`}
                  onClick={() => applyFilter('contentType', 'poll')}
                >
                  Polls
                </button>
                <button
                  className={`${styles.filterOption} ${activeFilters.contentType === 'announcement' ? styles.active : ''}`}
                  onClick={() => applyFilter('contentType', 'announcement')}
                >
                  Announcements
                </button>
              </div>
            </div>
            
            {hasActiveFilters() && (
              <button 
                className={styles.clearFiltersButton}
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
        
        <div className={styles.resultsContainer}>
          {searchQuery || hasActiveFilters() ? (
            filteredMessages.length > 0 ? (
              <>
                <div className={styles.resultsCount}>
                  {filteredMessages.length} {filteredMessages.length === 1 ? 'result' : 'results'}
                </div>
                <div className={styles.messageResults}>
                  {filteredMessages.map(message => (
                    <div 
                      key={message.id} 
                      className={styles.resultItem}
                      onClick={() => handleSelectMessage(message)}
                    >
                      <div className={styles.resultHeader}>
                        <span className={styles.senderName}>{message.senderName}</span>
                        <span className={styles.messageTime}>{formatTime(message.timestamp)}</span>
                      </div>
                      
                      <div className={styles.messageContent}>
                        {message.type === 'file' && (
                          <div className={styles.fileIndicator}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                              <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                            <span>File: {message.fileName || 'Attachment'}</span>
                          </div>
                        )}
                        
                        {message.type === 'poll' && (
                          <div className={styles.pollIndicator}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            <span>Poll: {message.question}</span>
                          </div>
                        )}
                        
                        {message.type === 'announcement' && (
                          <div className={styles.announcementIndicator}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span>Announcement</span>
                          </div>
                        )}
                        
                        {!message.type && (
                          <span className={styles.textContent}>
                            {message.content}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.noResults}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
                <p>No messages found</p>
                <span>Try different search terms or filters</span>
              </div>
            )
          ) : (
            <div className={styles.initialState}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <p>Search for messages in this conversation</p>
              <span>Use the search box above to find messages</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 