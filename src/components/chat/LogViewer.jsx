import { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './LogViewer.module.css';
import PropTypes from 'prop-types';

export default function LogViewer({ onClose }) {
  const { logs, fetchChatLogs, currentChat } = useChat();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, edit, delete
  const [isClosing, setIsClosing] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    fetchChatLogs().then(() => {
      setLoading(false);
    });
  }, [fetchChatLogs]);
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 280); // Slightly less than the animation duration to avoid flickering
  };
  
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    // Handle Firebase server timestamp objects
    let date;
    if (typeof timestamp === 'object' && timestamp !== null) {
      // Firebase Realtime Database timestamp
      if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        return 'Pending...';
      }
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  return (
    <div className={`${styles.logViewer} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.header}>
        <h2>Message Log</h2>
        <p className={styles.subtitle}>{currentChat?.name}</p>
        <button className={styles.closeButton} onClick={handleClose}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* <span className={styles.closeText}></span> */}
        </button>
      </div>
      
      <div className={styles.filterContainer}>
        <div className={styles.filterButtons}>
          <button 
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'edit' ? styles.active : ''}`}
            onClick={() => setFilter('edit')}
          >
            Edits
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'delete' ? styles.active : ''}`}
            onClick={() => setFilter('delete')}
          >
            Deletes
          </button>
        </div>
        <div className={styles.logCount}>
          {filteredLogs.length} log entries
        </div>
      </div>
      
      <div className={styles.logContainer}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className={styles.emptyText}>No logs found</p>
            <p className={styles.emptySubtext}>
              {filter !== 'all' ? 'Try changing the filter to see more results' : 'Logs will appear here when messages are edited or deleted'}
            </p>
          </div>
        ) : (
          <ul className={styles.logList}>
            {filteredLogs.map(log => (
              <li key={log.id} className={`${styles.logItem} ${styles[log.type]}`}>
                <div className={styles.logHeader}>
                  <span className={styles.logUser}>{log.userName}</span>
                  <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
                </div>
                <div className={styles.logAction}>
                  {log.type === 'edit' ? 'Edited a message' : 'Deleted a message'}
                </div>
                <div className={styles.logContent}>
                  {log.type === 'edit' ? (
                    <>
                      <div className={styles.originalContent}>
                        <div className={styles.contentLabel}>Original:</div>
                        <div className={styles.contentText}>{log.originalContent}</div>
                      </div>
                      <div className={styles.arrow}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className={styles.newContent}>
                        <div className={styles.contentLabel}>New:</div>
                        <div className={styles.contentText}>{log.newContent}</div>
                      </div>
                    </>
                  ) : (
                    <div className={styles.originalContent}>
                      <div className={styles.contentLabel}>Deleted content:</div>
                      <div className={styles.contentText}>{log.originalContent}</div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

LogViewer.propTypes = {
  onClose: PropTypes.func.isRequired
}; 