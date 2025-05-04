import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import styles from './SettingsModal.module.css';
import PropTypes from 'prop-types';

export default function SettingsModal({ onClose, currentChat }) {
  const { updateGroupInfo, setCurrentChat } = useChat();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReloadPrompt, setShowReloadPrompt] = useState(false);
  const [localEmbedImages, setLocalEmbedImages] = useState(currentChat.embedImages !== false);
  
  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  const handleToggleEmbedImages = async (enabled) => {
    if (!currentChat?.id || !isAdmin) return;
    
    // Update local state immediately for responsive UI
    setLocalEmbedImages(enabled);
    setIsUpdating(true);
    
    try {
      await updateGroupInfo(currentChat.id, {
        embedImages: enabled,
        lastUpdated: Date.now()
      });
      
      // Update the current chat object directly for immediate effect
      setCurrentChat(prevChat => ({
        ...prevChat,
        embedImages: enabled
      }));
      
      // Show reload prompt after successful update
      setShowReloadPrompt(true);
    } catch (error) {
      // Revert local state on error
      setLocalEmbedImages(!enabled);
      console.error('Error updating image embedding setting:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReloadPage = () => {
    try {
      // Show a feedback message before reloading
      const reloadPromptElement = document.querySelector(`.${styles.reloadPrompt}`);
      if (reloadPromptElement) {
        const messageElement = reloadPromptElement.querySelector(`.${styles.reloadMessage} p`);
        if (messageElement) {
          messageElement.textContent = 'Reloading page...';
        }
        
        const button = reloadPromptElement.querySelector(`.${styles.reloadButton}`);
        if (button) {
          button.disabled = true;
          button.textContent = 'Reloading...';
        }
      }
      
      // Log for debugging
      console.log('Reloading page to apply settings...');
      
      // Short delay to show the "Reloading..." message
      setTimeout(() => {
        // Force a hard refresh to reload all resources
        // This is more reliable than window.location.reload()
        window.location.href = window.location.href.split('?')[0] 
          + '?t=' + new Date().getTime();
      }, 300);
    } catch (error) {
      console.error('Error reloading page:', error);
      // Fallback to simple reload
      alert('Error reloading. Please refresh the page manually.');
      window.location.reload();
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
          {showReloadPrompt && (
            <div className={styles.reloadPrompt}>
              <div className={styles.reloadIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className={styles.reloadMessage}>
                <p>Setting updated! Reload to see changes.</p>
                <button 
                  className={styles.reloadButton}
                  onClick={handleReloadPage}
                >
                  Reload Now
                </button>
              </div>
            </div>
          )}
          
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
                <label className={`${styles.toggle} ${isUpdating ? styles.updating : ''}`}>
                  <input 
                    type="checkbox"
                    checked={localEmbedImages}
                    onChange={(e) => handleToggleEmbedImages(e.target.checked)}
                    disabled={!isAdmin || isUpdating}
                  />
                  <span className={styles.slider}>
                    {isUpdating && <span className={styles.pulsingDot}></span>}
                  </span>
                </label>
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