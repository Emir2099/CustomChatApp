import React from 'react';
import styles from './ChatListSkeleton.module.css';

const ChatListSkeleton = ({ count = 5 }) => {
  return (
    <div className={styles.skeletonList}>
      {Array(count).fill().map((_, index) => (
        <div key={index} className={styles.skeletonItem}>
          <div className={styles.skeletonAvatar}></div>
          <div className={styles.skeletonContent}>
            <div className={styles.skeletonHeader}>
              <div className={styles.skeletonName}></div>
              <div className={styles.skeletonBadge}></div>
            </div>
            <div className={styles.skeletonSubtext}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatListSkeleton; 