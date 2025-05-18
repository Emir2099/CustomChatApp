---
sidebar_position: 11
---

# Invite Links

One of the most crucial features I built for the chat app was the ability to generate invite links. This makes it super easy to bring new people into conversations without the hassle of manually adding each person.

## How Invite Links Work

The invite link system follows this basic flow:

1. A chat member generates a unique invite link
2. The link contains an encoded invite token
3. When someone opens the link, the app validates the token
4. If valid, the user is added to the chat

## Generating Invite Links

Here's how I implemented the invite link generation:

```jsx
// In ChatContext.jsx
const generateInviteLink = async (chatId) => {
  if (!chatId || !user?.uid) return null;
  
  try {
    // Get the chat to verify permissions
    const chatRef = ref(db, `chats/${chatId}`);
    const chatSnapshot = await get(chatRef);
    
    if (!chatSnapshot.exists()) {
      throw new Error('Chat not found');
    }
    
    const chatData = chatSnapshot.val();
    
    // Check if user is a member
    if (!chatData.members || !chatData.members[user.uid]) {
      throw new Error('You are not a member of this chat');
    }
    
    // Generate a unique token
    const token = generateUniqueToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    // Save the invite in Firebase
    const inviteRef = ref(db, `invites/${token}`);
    await set(inviteRef, {
      chatId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      expiresAt,
      isActive: true
    });
    
    // Create the full invite URL
    const inviteLink = `${window.location.origin}/invite/${token}`;
    return inviteLink;
  } catch (error) {
    console.error('Error generating invite link:', error);
    return null;
  }
};

// Helper function to generate a unique token
const generateUniqueToken = () => {
  // Create a random string of characters
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  
  return `${randomPart}-${timePart}`;
};
```

## Invite Link UI

I created a simple but effective UI for generating and sharing invite links:

```jsx
// src/components/chat/InviteLink.jsx
import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './InviteLink.module.css';

export default function InviteLink({ chatId, onClose }) {
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const { generateInviteLink } = useChat();
  
  const handleGenerateLink = async () => {
    setLoading(true);
    setError('');
    
    try {
      const link = await generateInviteLink(chatId);
      
      if (!link) {
        throw new Error('Failed to generate invite link');
      }
      
      setInviteLink(link);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyLink = () => {
    if (!inviteLink) return;
    
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {
        setError('Failed to copy link');
      });
  };
  
  return (
    <div className={styles.inviteLinkContainer}>
      <h3>Invite People to Chat</h3>
      
      {error && <div className={styles.error}>{error}</div>}
      
      {inviteLink ? (
        <div className={styles.linkContainer}>
          <input
            type="text"
            value={inviteLink}
            readOnly
            className={styles.linkInput}
          />
          
          <button 
            onClick={handleCopyLink} 
            className={styles.copyButton}
            disabled={copied}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          
          <div className={styles.expireNote}>
            This link expires in 7 days
          </div>
        </div>
      ) : (
        <button
          onClick={handleGenerateLink}
          className={styles.generateButton}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Invite Link'}
        </button>
      )}
      
      <button 
        onClick={onClose} 
        className={styles.closeButton}
      >
        Close
      </button>
    </div>
  );
}
```

## Accepting Invites

On the receiving end, I created a component to handle incoming invites:

```jsx
// src/components/chat/AcceptInvite.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './AcceptInvite.module.css';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinChat } = useChat();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatDetails, setChatDetails] = useState(null);
  
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      // Store the invite URL in session storage so we can redirect back after login
      sessionStorage.setItem('inviteRedirect', window.location.pathname);
      navigate('/login');
      return;
    }
    
    const validateInvite = async () => {
      setLoading(true);
      
      try {
        if (!token) {
          throw new Error('Invalid invite link');
        }
        
        // Get the invite data
        const inviteRef = ref(db, `invites/${token}`);
        const snapshot = await get(inviteRef);
        
        if (!snapshot.exists()) {
          throw new Error('This invite link is invalid or has expired');
        }
        
        const inviteData = snapshot.val();
        
        // Check if invite is active and not expired
        if (!inviteData.isActive) {
          throw new Error('This invite link has been deactivated');
        }
        
        if (inviteData.expiresAt < Date.now()) {
          throw new Error('This invite link has expired');
        }
        
        // Get chat details
        const chatRef = ref(db, `chats/${inviteData.chatId}`);
        const chatSnapshot = await get(chatRef);
        
        if (!chatSnapshot.exists()) {
          throw new Error('The chat no longer exists');
        }
        
        const chatData = chatSnapshot.val();
        
        // Check if the user is already a member
        if (chatData.members && chatData.members[user.uid]) {
          navigate(`/chat/${inviteData.chatId}`);
          return;
        }
        
        setChatDetails({
          id: inviteData.chatId,
          name: chatData.name,
          memberCount: chatData.members ? Object.keys(chatData.members).length : 0
        });
        
      } catch (err) {
        console.error('Error validating invite:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    validateInvite();
  }, [token, user, navigate]);
  
  const handleAcceptInvite = async () => {
    if (!chatDetails?.id) return;
    
    try {
      // Join the chat
      await joinChat(chatDetails.id);
      
      // Navigate to the chat
      navigate(`/chat/${chatDetails.id}`);
    } catch (err) {
      setError(`Failed to join chat: ${err.message}`);
    }
  };
  
  const handleDecline = () => {
    navigate('/');
  };
  
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Validating invite...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>❌</div>
        <h2>Invite Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className={styles.homeButton}>
          Go to Home
        </button>
      </div>
    );
  }
  
  return (
    <div className={styles.inviteContainer}>
      <div className={styles.inviteCard}>
        <div className={styles.chatIcon}>💬</div>
        <h2>Join Chat</h2>
        
        <div className={styles.chatInfo}>
          <p>
            <strong>Chat Name:</strong> {chatDetails.name}
          </p>
          <p>
            <strong>Members:</strong> {chatDetails.memberCount}
          </p>
        </div>
        
        <div className={styles.actions}>
          <button 
            onClick={handleDecline} 
            className={styles.declineButton}
          >
            Decline
          </button>
          <button 
            onClick={handleAcceptInvite} 
            className={styles.acceptButton}
          >
            Join Chat
          </button>
        </div>
      </div>
    </div>
  );
}
```

## ChatContext Integration

To handle the invite process, I added a joinChat function to the ChatContext:

```jsx
// In ChatContext.jsx
const joinChat = async (chatId) => {
  if (!chatId || !user?.uid) return false;
  
  try {
    const chatRef = ref(db, `chats/${chatId}`);
    const snapshot = await get(chatRef);
    
    if (!snapshot.exists()) {
      throw new Error('Chat not found');
    }
    
    // Add user to members
    const updates = {
      [`members/${user.uid}`]: {
        role: 'member',
        joinedAt: serverTimestamp()
      }
    };
    
    await update(ref(db, `chats/${chatId}`), updates);
    
    // Add a system message about the new user
    const messageRef = push(ref(db, `messages/${chatId}`));
    await set(messageRef, {
      type: 'system',
      content: `${user.displayName} joined the chat`,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error joining chat:', error);
    return false;
  }
};
```

## Invite Link Routes

I set up a dedicated route in the app to handle invite links:

```jsx
// In App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AcceptInvite from './components/chat/AcceptInvite';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Other routes */}
        <Route path="/invite/:token" element={<AcceptInvite />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Technical Challenges

### Security Considerations

Handling invite links securely was really important:

```jsx
// Security checks I implemented:
// 1. Expiration dates
const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

// 2. Active flag that can be toggled
const inviteData = {
  // ...other fields
  isActive: true
};

// 3. Token uniqueness and complexity
const generateUniqueToken = () => {
  const randomBytes = new Uint8Array(16);
  window.crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
```

### Managing Expired Links

I created a background process to clean up expired invites:

```jsx
// In a server function or scheduled client-side task
const cleanupExpiredInvites = async () => {
  try {
    const now = Date.now();
    const invitesRef = ref(db, 'invites');
    const invitesSnapshot = await get(invitesRef);
    
    if (!invitesSnapshot.exists()) return;
    
    const updates = {};
    
    invitesSnapshot.forEach(childSnapshot => {
      const invite = childSnapshot.val();
      
      if (invite.expiresAt < now) {
        // Mark as inactive instead of deleting to preserve history
        updates[`${childSnapshot.key}/isActive`] = false;
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await update(invitesRef, updates);
    }
  } catch (error) {
    console.error('Error cleaning up expired invites:', error);
  }
};
```

### User Experience

I wanted to make joining a chat through an invite as smooth as possible:

```jsx
// Handle case where user isn't logged in yet
useEffect(() => {
  // After login, check if we need to redirect to an invite
  const inviteRedirect = sessionStorage.getItem('inviteRedirect');
  
  if (user && inviteRedirect) {
    sessionStorage.removeItem('inviteRedirect');
    navigate(inviteRedirect);
  }
}, [user, navigate]);
```

## Admin Controls

I added the ability for chat admins to manage invites:

```jsx
// In ChatSettings.jsx
const [invites, setInvites] = useState([]);

// Fetch all invites for this chat
useEffect(() => {
  if (!chatId || !isAdmin) return;
  
  const fetchInvites = async () => {
    try {
      // Query invites by chatId
      const invitesRef = ref(db, 'invites');
      const invitesQuery = query(
        invitesRef,
        orderByChild('chatId'),
        equalTo(chatId)
      );
      
      const snapshot = await get(invitesQuery);
      
      if (snapshot.exists()) {
        const invitesList = [];
        
        snapshot.forEach(childSnapshot => {
          invitesList.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        
        setInvites(invitesList);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };
  
  fetchInvites();
}, [chatId, isAdmin]);

// Function to revoke an invite
const revokeInvite = async (inviteId) => {
  try {
    await update(ref(db, `invites/${inviteId}`), {
      isActive: false
    });
    
    // Update local state
    setInvites(prev => 
      prev.map(invite => 
        invite.id === inviteId 
          ? { ...invite, isActive: false } 
          : invite
      )
    );
  } catch (error) {
    console.error('Error revoking invite:', error);
  }
};
```

## Future Improvements

If I had more time to work on the invite links feature, I'd add:

1. **Role-Based Invites** - Generate links for specific roles (admin, member, read-only)
2. **Usage Limits** - Limit how many people can join with a single link
3. **Private Invites** - Email-specific invites that only work for certain addresses
4. **Approval System** - Make some invites require approval from admins
5. **Analytics** - Track how many times an invite link is clicked vs. accepted
6. **Invite Management** - Better UI for admins to see all active invites

The invite links feature has been super helpful for growing chat conversations - people can easily share links on other platforms and bring in new members without admin intervention for each person. 