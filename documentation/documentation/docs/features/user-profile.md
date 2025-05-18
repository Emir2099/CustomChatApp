---
sidebar_position: 8
---

# User Profile Management

Handling user profiles was an important part of building the chat app. I wanted users to be able to customize their identities and make the experience more personal. Here's how I implemented the user profile management system.

## User Profile Data Structure

In Firebase, I store user profiles with the following structure:

```json
/users/{userId}: {
  "displayName": "John Doe",
  "email": "john@example.com",
  "photoURL": "https://example.com/photo.jpg",
  "bio": "Hello, I'm John!",
  "isOnline": true,
  "lastSeen": 1650120000000,
  "createdAt": 1649120000000
}
```

## Profile Creation

When a user signs up, I automatically create their basic profile:

```jsx
// In AuthContext.jsx
const signup = async (email, password, displayName) => {
  try {
    setError('');
    // Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's profile with display name
    await updateProfile(userCredential.user, { displayName });
    
    // Create user document in the database
    const userRef = ref(db, `users/${userCredential.user.uid}`);
    await set(userRef, {
      displayName,
      email,
      photoURL: null,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      isOnline: true
    });
    
    return userCredential.user;
  } catch (err) {
    setError(formatAuthError(err.code));
    throw err;
  }
};
```

## Profile Update Component

I built a component that lets users update their profile information:

```jsx
// src/components/profile/ProfileEditor.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../common/Avatar';
import styles from './ProfileEditor.module.css';

export default function ProfileEditor() {
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState('');
  
  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const { user, updateUserProfile } = useAuth();
  
  // Load current profile data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
      
      // Fetch additional user data from database
      const fetchUserData = async () => {
        try {
          const userRef = ref(db, `users/${user.uid}`);
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setBio(userData.bio || '');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      };
      
      fetchUserData();
    }
  }, [user]);
  
  // Handle avatar file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image size must be less than 5MB');
        return;
      }
      
      setFile(selectedFile);
      setPreviewURL(URL.createObjectURL(selectedFile));
    }
  };
  
  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous status
    setSuccess('');
    setError('');
    setIsSubmitting(true);
    
    try {
      // Upload avatar image if there's a new file
      let uploadedPhotoURL = photoURL;
      
      if (file) {
        uploadedPhotoURL = await uploadAvatar(file);
      }
      
      // Update profile
      await updateUserProfile({
        displayName,
        photoURL: uploadedPhotoURL,
        bio
      });
      
      setSuccess('Profile updated successfully!');
      
      // Clear preview URL and file state
      if (previewURL) {
        URL.revokeObjectURL(previewURL);
        setPreviewURL('');
        setFile(null);
      }
    } catch (err) {
      setError('Failed to update profile: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={styles.profileEditor}>
      <h2>Edit Your Profile</h2>
      
      {success && <div className={styles.success}>{success}</div>}
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarPreview}>
            <Avatar 
              src={previewURL || photoURL} 
              alt={displayName} 
              size="large" 
            />
          </div>
          
          <div className={styles.avatarUpload}>
            <label className={styles.uploadButton}>
              <input 
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              Change Photo
            </label>
            
            {(photoURL || previewURL) && !file && (
              <button 
                type="button" 
                className={styles.removeButton}
                onClick={() => {
                  setPhotoURL('');
                  if (previewURL) {
                    URL.revokeObjectURL(previewURL);
                    setPreviewURL('');
                  }
                }}
              >
                Remove Photo
              </button>
            )}
          </div>
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={3}
            maxLength={30}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={150}
            rows={3}
            placeholder="Tell people a little about yourself..."
          />
          <div className={styles.charCount}>
            {bio.length}/150
          </div>
        </div>
        
        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
```

## Avatar Upload Function

I created a helper function to handle avatar image uploads:

```jsx
// src/utils/fileUpload.js
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

export const uploadAvatar = async (file) => {
  if (!file) return null;
  
  try {
    // Generate a unique filename
    const filename = `avatars/${Date.now()}-${file.name}`;
    const avatarRef = storageRef(storage, filename);
    
    // Upload the file
    await uploadBytes(avatarRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(avatarRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
};
```

## Profile Update Logic

The actual profile update logic is in the AuthContext:

```jsx
// src/contexts/AuthContext.jsx
const updateUserProfile = async (data) => {
  try {
    if (!user) throw new Error('No user logged in');
    
    const updates = {};
    
    // Update display name if provided
    if (data.displayName) {
      await updateProfile(user, { displayName: data.displayName });
      updates.displayName = data.displayName;
    }
    
    // Update photo URL if provided
    if (data.photoURL !== undefined) {
      await updateProfile(user, { photoURL: data.photoURL || null });
      updates.photoURL = data.photoURL || null;
    }
    
    // Update additional profile fields in database
    if (data.bio !== undefined) updates.bio = data.bio;
    
    // Only update if we have changes
    if (Object.keys(updates).length > 0) {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    }
    
    return true;
  } catch (err) {
    console.error('Error updating profile:', err);
    throw err;
  }
};
```

## Profile View Component

I also created a component for viewing a user's profile:

```jsx
// src/components/profile/ProfileView.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ref, get } from 'firebase/database';
import { db } from '../../config/firebase';
import Avatar from '../common/Avatar';
import OnlineStatus from '../common/OnlineStatus';
import styles from './ProfileView.module.css';

export default function ProfileView({ userId, onClose }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const isOwnProfile = user?.uid === userId;
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          setUserData(snapshot.val());
        } else {
          setError('User not found');
        }
      } catch (err) {
        setError('Error loading user profile');
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      fetchUserData();
    }
  }, [userId]);
  
  if (loading) {
    return (
      <div className={styles.profileLoading}>
        Loading profile...
      </div>
    );
  }
  
  if (error || !userData) {
    return (
      <div className={styles.profileError}>
        {error || 'Could not load profile'}
      </div>
    );
  }
  
  return (
    <div className={styles.profileView}>
      <div className={styles.header}>
        <h2>{isOwnProfile ? 'Your Profile' : 'User Profile'}</h2>
        <button 
          className={styles.closeButton}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      
      <div className={styles.profileContent}>
        <div className={styles.avatarSection}>
          <Avatar
            src={userData.photoURL}
            alt={userData.displayName}
            size="xlarge"
            showStatus={!isOwnProfile}
            isOnline={userData.isOnline}
          />
          
          {!isOwnProfile && (
            <OnlineStatus
              isOnline={userData.isOnline}
              lastSeen={userData.lastSeen}
              displayType="text"
            />
          )}
        </div>
        
        <div className={styles.profileInfo}>
          <h3>{userData.displayName}</h3>
          
          {userData.bio && (
            <div className={styles.bio}>
              {userData.bio}
            </div>
          )}
          
          <div className={styles.joined}>
            Joined {formatDate(userData.createdAt)}
          </div>
        </div>
        
        {isOwnProfile && (
          <button 
            className={styles.editButton}
            onClick={() => {/* Navigate to edit profile */}}
          >
            Edit Profile
          </button>
        )}
        
        {!isOwnProfile && (
          <div className={styles.actions}>
            <button 
              className={styles.messageButton}
              onClick={() => {/* Start a chat with this user */}}
            >
              Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to format date
const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
```

## CSS Styles

I wanted the profile UI to look clean and user-friendly:

```css
/* ProfileEditor.module.css */
.profileEditor {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.avatarSection {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.avatarPreview {
  margin-right: 20px;
}

.avatarUpload {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.uploadButton {
  cursor: pointer;
  background-color: #0084ff;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  display: inline-block;
}

.removeButton {
  background: none;
  border: none;
  color: #ff4d4f;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  font-size: 14px;
}

.formGroup {
  margin-bottom: 20px;
}

.formGroup label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.formGroup input,
.formGroup textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 16px;
}

.charCount {
  margin-top: 4px;
  font-size: 12px;
  color: #888;
  text-align: right;
}

.submitButton {
  background-color: #0084ff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.submitButton:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.success {
  background-color: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.error {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}
```

## Account Settings

Beyond the basic profile, I also added account settings for managing email and password:

```jsx
// src/components/profile/AccountSettings.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './AccountSettings.module.css';

export default function AccountSettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user, updateUserPassword, reauthenticateUser } = useAuth();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset status
    setSuccess('');
    setError('');
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // First re-authenticate
      await reauthenticateUser(currentPassword);
      
      // Then change password
      await updateUserPassword(newPassword);
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setSuccess('Password updated successfully');
    } catch (err) {
      switch (err.code) {
        case 'auth/wrong-password':
          setError('Current password is incorrect');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later');
          break;
        default:
          setError('Failed to update password: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={styles.accountSettings}>
      <h2>Account Settings</h2>
      
      <div className={styles.section}>
        <h3>Email Address</h3>
        <p>{user?.email}</p>
      </div>
      
      <div className={styles.section}>
        <h3>Change Password</h3>
        
        {success && <div className={styles.success}>{success}</div>}
        {error && <div className={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Technical Challenges

### Image Optimization

Handling profile images was tricky because I needed to optimize them before upload:

```jsx
// Image resize function
const resizeImage = async (file, maxWidth = 500, maxHeight = 500) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        // Draw resized image to canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          resolve(blob);
        }, file.type);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
```

### Profile Updates Race Condition

I ran into a race condition issue when updating both Firebase Auth and the Realtime Database:

```jsx
// Solution: Use async/await to ensure sequential execution
const updateUserProfile = async (data) => {
  try {
    // First update Firebase Auth
    if (data.displayName || data.photoURL !== undefined) {
      await updateProfile(user, {
        displayName: data.displayName || user.displayName,
        photoURL: data.photoURL !== undefined ? data.photoURL : user.photoURL
      });
    }
    
    // Then update the database
    const userRef = ref(db, `users/${user.uid}`);
    await update(userRef, {
      displayName: data.displayName || user.displayName,
      photoURL: data.photoURL !== undefined ? data.photoURL : user.photoURL,
      bio: data.bio !== undefined ? data.bio : undefined,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (err) {
    console.error('Error updating profile:', err);
    throw err;
  }
};
```

### User Presence System

I wanted to show when users were last online, which required some clever Firebase usage:

```jsx
// Setup user presence
useEffect(() => {
  if (!user) return;
  
  // Firebase presence system
  const userStatusRef = ref(db, `users/${user.uid}`);
  
  // Create a reference to the special '.info/connected' path
  const connectedRef = ref(db, '.info/connected');
  
  // When the client's connection state changes
  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === false) {
      // We're not connected or we've lost our connection
      return;
    }
    
    // We're connected (or reconnected)
    update(userStatusRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    
    // When we disconnect, update the last time we were seen online
    onDisconnect(userStatusRef).update({
      isOnline: false,
      lastSeen: serverTimestamp()
    });
  });
}, [user]);
```

## Future Improvements

If I had more time, I'd enhance the user profile system with:

1. **Profile Privacy Settings** - Let users control who can see their profile details
2. **Custom User Status** - Allow users to set custom status messages
3. **Profile Completeness Score** - Encourage users to fill out their profiles
4. **Social Links** - Let users add links to their social media profiles
5. **User Themes** - Allow users to customize their chat appearance

Overall, the profile system is working well for the app's needs. It provides enough personalization while keeping things simple and manageable. 