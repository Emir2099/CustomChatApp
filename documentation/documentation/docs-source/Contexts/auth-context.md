---
sidebar_position: 2
---

# AuthContext

The `AuthContext` is the foundation of the authentication system in this chat application. It manages user authentication state, login/logout functionality, and user profile updates.

## Implementation Overview

I built the AuthContext using React's Context API combined with Firebase Authentication. Here's how I structured it:

```jsx
// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider 
} from '../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup
} from 'firebase/auth';
import { ref, set, update, onValue, serverTimestamp } from 'firebase/database';

// Create the context
const AuthContext = createContext();

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Provider component
export function AuthProvider({ children }) {
  // State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Authentication functions
  // ... (detailed below)
  
  // Effect to handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Update online status in database
      if (currentUser) {
        const userStatusRef = ref(db, `users/${currentUser.uid}`);
        update(userStatusRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        });
        
        // Set up presence system
        setupPresence(currentUser.uid);
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // Context value
  const value = {
    user,
    loading,
    error,
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    signInWithGoogle
  };
  
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
```

## Core Authentication Functions

### User Registration

I implemented user registration with email/password and automatic profile creation:

```jsx
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

### User Login

I created two login methods - email/password and Google authentication:

```jsx
// Email/password login
const login = async (email, password) => {
  try {
    setError('');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Update online status
    const userRef = ref(db, `users/${userCredential.user.uid}`);
    await update(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    
    return userCredential.user;
  } catch (err) {
    setError(formatAuthError(err.code));
    throw err;
  }
};

// Google login
const signInWithGoogle = async () => {
  try {
    setError('');
    const result = await signInWithPopup(auth, googleProvider);
    
    // Check if this is a new user
    const isNewUser = result._tokenResponse.isNewUser;
    
    // If new user, create profile in database
    if (isNewUser) {
      const userRef = ref(db, `users/${result.user.uid}`);
      await set(userRef, {
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isOnline: true
      });
    } else {
      // Update existing user's online status
      const userRef = ref(db, `users/${result.user.uid}`);
      await update(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
        // Update photo URL in case it changed on Google's side
        photoURL: result.user.photoURL
      });
    }
    
    return result.user;
  } catch (err) {
    setError(formatAuthError(err.code));
    throw err;
  }
};
```

### User Logout

I made sure to update the user's online status before signing out:

```jsx
const logout = async () => {
  try {
    // Update online status before signing out
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    }
    
    await signOut(auth);
  } catch (err) {
    setError(formatAuthError(err.code));
    throw err;
  }
};
```

### Password Reset

I implemented a password reset function:

```jsx
const resetPassword = async (email) => {
  try {
    setError('');
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    setError(formatAuthError(err.code));
    throw err;
  }
};
```

### Profile Updates

Users can update their profile information:

```jsx
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
    if (data.photoURL) {
      await updateProfile(user, { photoURL: data.photoURL });
      updates.photoURL = data.photoURL;
    }
    
    // Update additional profile fields in database
    if (data.bio) updates.bio = data.bio;
    
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
    setError(err.message);
    throw err;
  }
};
```

## Presence System

One of the more complex parts was implementing a reliable presence system:

```jsx
const setupPresence = (userId) => {
  // Firebase presence system
  const userStatusRef = ref(db, `users/${userId}`);
  
  // Create a reference to the special '.info/connected' path
  const connectedRef = ref(db, '.info/connected');
  
  // When the client's connection state changes
  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === false) {
      // We're not connected (or we've lost our connection)
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
  
  // Clean up when component unmounts
  return () => {
    // Update status to offline
    update(userStatusRef, {
      isOnline: false,
      lastSeen: serverTimestamp()
    });
  };
};
```

## Error Handling

I created a helper function to format Firebase auth errors into user-friendly messages:

```jsx
const formatAuthError = (errorCode) => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'This email is already registered';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email but different sign-in credentials';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing the sign in';
    default:
      return 'An error occurred during authentication';
  }
};
```

## Usage Example

Here's how I use the AuthContext in components:

```jsx
import { useAuth } from '../contexts/AuthContext';

function ProfilePage() {
  const { user, updateUserProfile, error } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await updateUserProfile({
        displayName,
        bio
      });
      
      // Show success message
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <div>
      <h1>Edit Profile</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <button type="submit">Save Changes</button>
      </form>
    </div>
  );
}
```

## Security Considerations

I implemented several security best practices:

1. **Protected Routes**: Unauthorized users can't access protected content
2. **Authentication State Persistence**: Users stay logged in across sessions
3. **Session Management**: Proper handling of login state
4. **Error Handling**: Secure error messages that don't leak sensitive information

```jsx
// Protected route component
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
}

// Usage
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />
  <Route 
    path="/chat/*" 
    element={
      <PrivateRoute>
        <ChatLayout />
      </PrivateRoute>
    } 
  />
</Routes>
```

## Challenges and Solutions

### Challenge 1: User Presence

**Problem**: Accurately tracking when users are online/offline was tricky, especially with unreliable connections.

**Solution**: I used Firebase's special `.info/connected` path and `onDisconnect()` handlers to update status reliably:

```jsx
// When user connects
onValue(connectedRef, (snapshot) => {
  if (snapshot.val() === true) {
    // User is connected
    const userStatusRef = ref(db, `users/${user.uid}`);
    
    // When this client disconnects, update the user's status
    onDisconnect(userStatusRef).update({
      isOnline: false,
      lastSeen: serverTimestamp()
    });
    
    // Set the user's status to online
    update(userStatusRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    });
  }
});
```

### Challenge 2: Auth State Persistence

**Problem**: I needed to decide how long users should stay logged in.

**Solution**: I configured Firebase Auth persistence to balance security and convenience:

```jsx
// In firebase.js config
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';

// Initialize auth with persistence
const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence]
});
```

### Challenge 3: Race Conditions

**Problem**: Sometimes database updates would happen before the auth state was fully initialized.

**Solution**: I used the loading state to prevent rendering until authentication was complete:

```jsx
return (
  <AuthContext.Provider value={value}>
    {!loading && children}
  </AuthContext.Provider>
);
```

## Testing

I wrote tests for the AuthContext to ensure it works correctly:

```jsx
// AuthContext.test.js
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { auth } from '../config/firebase';

// Mock Firebase
jest.mock('../config/firebase', () => ({
  auth: {
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn()
  },
  db: {
    ref: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    onValue: jest.fn()
  }
}));

// Test component that uses auth context
function TestComponent() {
  const { user, login } = useAuth();
  
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <button onClick={() => login('test@example.com', 'password')}>
        Login
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('provides authentication state to components', async () => {
    // Mock auth state change
    auth.onAuthStateChanged.mockImplementation((callback) => {
      callback({ uid: '123', email: 'test@example.com' });
      return jest.fn(); // Unsubscribe function
    });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check if user is provided to component
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });
  
  // More tests...
});
```

## Future Improvements

I have several ideas for enhancing the AuthContext in the future:

1. **Multi-factor Authentication**: Add an extra layer of security
2. **Social Logins**: Add more providers like Twitter, GitHub, etc.
3. **Session Management**: Allow users to view and manage active sessions
4. **Account Linking**: Let users link multiple auth providers to one account
5. **Better Error Handling**: More detailed error messages and recovery options

## Conclusion

The AuthContext is the foundation of the chat application's security model. By centralizing authentication logic, I was able to create a consistent, secure user experience throughout the app. 