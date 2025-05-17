import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../config/firebase';
import styles from './GroupInfo.module.css';
import { getDatabase, ref, update } from 'firebase/database';
import SettingsModal from './SettingsModal';

export default function GroupInfo() {
  const { 
    currentChat, 
    updateGroupInfo, 
    generateInviteLink,
    members,
    setCurrentChat 
  } = useChat();
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(currentChat?.name || '');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentInviteLink, setCurrentInviteLink] = useState('');
  const [creator, setCreator] = useState(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const iconInputRef = useRef(null);

  useEffect(() => {
    setCurrentInviteLink('');
    setCopySuccess(false);
    setShowLinkCopied(false);
  }, [currentChat?.id]);

  useEffect(() => {
    // Find the creator from members array
    if (currentChat?.createdBy && members.length > 0) {
      const creatorMember = members.find(member => member.uid === currentChat.createdBy);
      setCreator(creatorMember);
    }
  }, [currentChat?.createdBy, members]);

  const isAdmin = currentChat?.admins?.[auth.currentUser?.uid];

  // Priority for avatar: 1. Group's own iconURL, 2. Admin's photo, 3. First member's photo
  // This change makes sure we use the group's own icon if available
  const adminMember = members.find(m => m.uid === currentChat?.createdBy);
  const firstMember = members[0];
  const avatarURL = currentChat?.iconURL || adminMember?.photoURL || firstMember?.photoURL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (groupName.trim() && groupName !== currentChat.name) {
      await updateGroupInfo(currentChat.id, { name: groupName.trim() });
      setIsEditing(false);
    } else {
      setIsEditing(false);
    }
  };

  const handleGroupIconChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingIcon(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const img = new Image();
        img.src = reader.result;
        await new Promise(resolve => img.onload = resolve);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const MAX_SIZE = 200;
        const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const iconURL = canvas.toDataURL('image/jpeg', 0.5);
        
        const chatRef = ref(getDatabase(), `chats/${currentChat.id}`);
        await update(chatRef, {
          "info/iconURL": iconURL,
          "info/lastUpdated": Date.now()
        });
        
        if (currentChat) {
          setCurrentChat(prevChat => ({
            ...prevChat,
            iconURL
          }));
        }
      };
    } catch (error) {
      console.error('Error updating group icon:', error);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!currentChat?.id) return;
    
    setIsGeneratingLink(true);
    setShowLinkCopied(false);
    try {
      const newLink = await generateInviteLink(currentChat.id);
      setCurrentInviteLink(newLink);
    } catch (error) {
      console.error('Error generating invite link:', error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentInviteLink);
      setCopySuccess(true);
      setShowLinkCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
        // Wait for transition to complete before hiding the link
        setTimeout(() => {
          setCurrentInviteLink('');
          setShowLinkCopied(false);
        }, 1000);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (!currentChat) return null;

  return (
    <div className={styles.groupInfo}>
      <div className={styles.header}>
        <input
          type="file"
          ref={iconInputRef}
          onChange={handleGroupIconChange}
          accept=".jpg,.jpeg,.png,.webp"
          className={styles.hiddenInput}
          style={{ display: 'none' }}
        />
        <div 
          className={`${styles.groupAvatar} ${isEditing ? styles.editableAvatar : ''}`}
          onClick={() => isEditing && isAdmin && iconInputRef.current?.click()}
        >
          {avatarURL ? (
            <>
              <img 
                src={avatarURL} 
                alt={currentChat.name} 
              />
              {isEditing && isAdmin && (
                <div className={styles.avatarOverlay}>
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </div>
              )}
              {uploadingIcon && <div className={styles.uploadingOverlay}>...</div>}
            </>
          ) : (
            <div className={styles.groupInitial}>
              {currentChat.name.charAt(0).toUpperCase()}
              {isEditing && isAdmin && (
                <div className={styles.avatarOverlay}>
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
        
        {isEditing ? (
          <form onSubmit={handleSubmit} className={styles.editForm}>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
            <div className={styles.actions}>
              <button type="submit">Save</button>
              <button type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.groupName}>
            <h2>{currentChat.name}</h2>
            {isAdmin && (
              <button 
                onClick={() => setIsEditing(true)}
                className={styles.editButton}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.infoItem}>
          <span className={styles.label}>Members</span>
          <span className={styles.value}>
            {members?.length || currentChat?.memberCount || 0}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.label}>Created</span>
          <span className={styles.value}>
            {new Date(currentChat.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.label}>Created by</span>
          <span className={styles.value}>
            {creator ? (
              currentChat.createdBy === auth.currentUser?.uid ? 
                'You' : 
                creator.displayName || creator.email
            ) : 'Loading...'}
          </span>
        </div>
      </div>
      
      {/* Settings Button */}
      <div className={styles.settingsButtonContainer}>
        <button 
          className={styles.settingsButton}
          onClick={() => setShowSettingsModal(true)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </div>

      <div className={styles.inviteSection}>
        {!currentInviteLink && !showLinkCopied ? (
          <button 
            onClick={handleGenerateLink}
            disabled={isGeneratingLink}
            className={styles.generateButton}
          >
            {isGeneratingLink ? 'Generating...' : 'Generate Invite Link'}
          </button>
        ) : showLinkCopied ? (
          <button 
            className={`${styles.generateButton} ${styles.copiedButton}`}
            onClick={() => setShowLinkCopied(false)}
          >
            <span className={styles.copiedText}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Link Copied!
            </span>
          </button>
        ) : (
          <div className={styles.inviteLinkContainer}>
            <input 
              type="text" 
              readOnly 
              value={currentInviteLink}
              className={styles.inviteInput}
            />
            <button 
              onClick={handleCopyLink}
              className={`${styles.copyButton} ${copySuccess ? styles.copied : ''}`}
            >
              {copySuccess ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                'Copy'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal 
          onClose={() => setShowSettingsModal(false)}
          currentChat={currentChat}
        />
      )}
    </div>
  );
} 