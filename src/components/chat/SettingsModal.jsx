import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import styles from './SettingsModal.module.css';
import PropTypes from 'prop-types';

export default function SettingsModal({ onClose, currentChat }) {
  const { updateGroupInfo } = useChat();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  const handleToggleEmbedImages = async (enabled) => {
    if (!currentChat?.id || !isAdmin) return;
    
    setIsUpdating(true);
    try {
      await updateGroupInfo(currentChat.id, {
        embedImages: enabled,
        lastUpdated: Date.now()
      });
      
      // No need to manually update currentChat here
      // It will be updated via the listener in ChatContext
    } catch (error) {
      console.error('Error updating image embedding setting:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Group Settings</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.settingSection}>
            <h3>Display Settings</h3>
            
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Embed Images</span>
                <span className={styles.settingDescription}>
                  Show images directly in chat messages
                </span>
              </div>
              
              <div className={styles.toggleWrapper}>
                <label className={styles.toggle}>
                  <input 
                    type="checkbox"
                    checked={currentChat.embedImages !== false}
                    onChange={(e) => handleToggleEmbedImages(e.target.checked)}
                    disabled={!isAdmin || isUpdating}
                  />
                  <span className={styles.slider}></span>
                </label>
                
                {isUpdating && (
                  <div className={styles.updateIndicator}>
                    <div className={styles.updateSpinner}></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className={styles.settingSection}>
            <h3>Performance Impact</h3>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div className={styles.infoText}>
                <p><strong>Yes, embedding images does impact performance.</strong> When images are embedded, the entire chat history with images loads at once.</p>
                <p>Turning this setting off can significantly improve performance by:</p>
                <ul className={styles.benefitsList}>
                  <li>Reducing initial data load by up to 70-90%</li>
                  <li>Improving scrolling performance and responsiveness</li>
                  <li>Reducing memory usage on your device</li>
                  <li>Showing lightweight image icons instead of full images</li>
                </ul>
                <p>For optimal performance in large group chats with many images, we recommend disabling this setting.</p>
              </div>
            </div>
          </div>
          
          {!isAdmin && (
            <div className={styles.adminNote}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Only group admins can change settings</span>
            </div>
          )}
        </div>
        
        <div className={styles.footer}>
          <button 
            className={styles.closeBtn} 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

SettingsModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  currentChat: PropTypes.object.isRequired
}; 