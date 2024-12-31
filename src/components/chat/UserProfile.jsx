import { useState, useRef } from 'react';
import { auth, db } from '../../config/firebase';
import { updateProfile, signOut } from 'firebase/auth';
import { ref as dbRef, update } from 'firebase/database';
import styles from './UserProfile.module.css';
import PropTypes from 'prop-types';

const getInitials = (email, displayName) => {
  if (displayName) {
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
};

const UserProfile = ({ show, onClose, currentUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [status, setStatus] = useState('Available');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName
      });
      await update(dbRef(db, `users/${currentUser.uid}`), {
        displayName,
        bio,
        status,
        lastUpdated: Date.now()
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await update(dbRef(db, `users/${currentUser.uid}`), {
        status: 'offline',
        lastSeen: Date.now()
      });
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadError('');
    setIsLoading(true);
    
    try {
      // Convert to base64 with more compression
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          // Create temporary image for compression
          const img = new Image();
          img.src = reader.result;
          await new Promise(resolve => img.onload = resolve);
          
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set smaller dimensions
          const MAX_SIZE = 200;
          const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const photoURL = canvas.toDataURL('image/jpeg', 0.5); // Increased compression
          
          // Update database first
          await update(dbRef(db, `users/${currentUser.uid}`), {
            photoURL,
            lastUpdated: Date.now()
          });
          // Then update auth profile
          await updateProfile(auth.currentUser, { photoURL });
          setUploadError('');
        } catch (error) {
          console.error('Error uploading photo:', error);
          setUploadError('Failed to upload photo. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };
      
      reader.onerror = () => {
        setUploadError('Failed to read file. Please try again.');
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Error uploading photo:', error);
      setUploadError('Failed to upload photo. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className={`${styles.profilePanel} ${show ? styles.show : ''}`}>
      <div className={styles.header}>
        <h2>Profile</h2>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      <div className={styles.profileContent}>
        <div className={styles.avatarSection}>
          <div
            className={styles.avatar}
            style={{
              background: currentUser?.photoURL ? 'none' : `linear-gradient(135deg, #6366f1, #8b5cf6)`
            }}
          >
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" />
            ) : (
              <span>{getInitials(currentUser?.email, currentUser?.displayName)}</span>
            )}
          </div>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            className={styles.hiddenInput}
          />
          <button 
            type="button"
            className={styles.changeAvatar}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            {isLoading ? 'Uploading...' : 'Change Photo'}
          </button>
          {uploadError && <p className={styles.errorText}>{uploadError}</p>}
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdateProfile} className={styles.editForm}>
            <div className={styles.inputGroup}>
              <label>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
                maxLength={160}
              />
              <span className={styles.charCount}>
                {160 - bio.length} characters remaining
              </span>
            </div>
            <div className={styles.inputGroup}>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Available">Available</option>
                <option value="Away">Away</option>
                <option value="Do Not Disturb">Do Not Disturb</option>
                <option value="In a meeting">In a meeting</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div className={styles.buttonGroup}>
              <button 
                type="submit" 
                className={styles.saveButton}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className={styles.cancelButton}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.profileInfo}>
            <div className={styles.infoItem}>
              <span>Display Name</span>
              <p>{currentUser?.displayName || 'Not set'}</p>
            </div>
            <div className={styles.infoItem}>
              <span>Email</span>
              <p>{currentUser?.email}</p>
            </div>
            <div className={styles.infoItem}>
              <span>Bio</span>
              <p>{bio || 'No bio yet'}</p>
            </div>
            <div className={styles.infoItem}>
              <span>Status</span>
              <p className={`${styles.status} ${styles[status.toLowerCase().replace(/\s+/g, '')]}`}>
                {status}
              </p>
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className={styles.editButton}
            >
              Edit Profile
            </button>
          </div>
        )}

        <button onClick={handleSignOut} className={styles.signOutButton}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
};

UserProfile.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    photoURL: PropTypes.string,
    displayName: PropTypes.string,
    email: PropTypes.string,
    bio: PropTypes.string,
    uid: PropTypes.string
  })
};

export default UserProfile; 