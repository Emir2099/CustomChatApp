import React from 'react';
import styles from './ChatAreaSkeleton.module.css';

const ChatAreaSkeleton = () => {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonAvatar}></div>
        <div className={styles.skeletonTitle}></div>
      </div>
      
      <div className={styles.skeletonMessages}>
        {Array(5).fill().map((_, index) => (
          <div key={index} className={styles.skeletonMessage}>
            <div className={styles.skeletonMessageAvatar}></div>
            <div className={styles.skeletonMessageContent}>
              <div className={styles.skeletonMessageHeader}></div>
              <div className={styles.skeletonMessageBody}></div>
            </div>
          </div>
        ))}
      </div>
      
      <div className={styles.skeletonInput}>
        <div className={styles.skeletonInputField}></div>
        <div className={styles.skeletonInputButton}></div>
      </div>
    </div>
  );
};

export default ChatAreaSkeleton; 