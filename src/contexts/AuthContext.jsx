import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { db } from '../config/firebase';
import PropTypes from 'prop-types';

const AuthContext = createContext();

// Helper function to extract only the serializable properties from auth user
const serializeUser = (firebaseUser) => {
  if (!firebaseUser) return null;
  
  // Extract only the properties we need and ensure email is included
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '', // Ensure email is always included, even if empty
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    isAnonymous: firebaseUser.isAnonymous,
  };
};

// Deep equality check to prevent unnecessary updates
const isEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => {
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      return isEqual(val1, val2);
    }
    return val1 === val2;
  });
};

// Simple throttle function to prevent too many updates
const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userDataListener = useRef(null);
  const previousUserRef = useRef(null);
  const throttledUpdateRef = useRef(null);

  // Create a throttled setUser function to prevent rapid re-renders
  useEffect(() => {
    throttledUpdateRef.current = throttle((userData) => {
      // Deep clone to break reference equality
      const userClone = JSON.parse(JSON.stringify(userData));
      setUser(userClone);
      console.log("User data updated:", userClone);
    }, 300); // Throttle to once per 300ms
  }, []);

  // This function ensures a user record exists in the database
  const ensureUserRecord = useCallback(async (currentUser, serializedUser) => {
    try {
      const userRef = ref(db, `users/${currentUser.uid}`);
      
      // First, get the current user data
      const userSnapPromise = new Promise((resolve) => {
        const unsub = onValue(userRef, (snapshot) => {
          resolve(snapshot);
          unsub(); // Unsubscribe after first event
        }, { onlyOnce: true });
      });
      
      const snapshot = await userSnapPromise;
      const userData = snapshot.val();
      
      // If user doesn't exist in database or is missing core fields, initialize them
      if (!userData) {
        // Create a new user record with default values
        await set(userRef, {
          ...serializedUser,
          email: currentUser.email, // Ensure email is stored
          status: 'Available',
          lastActiveStatus: 'Available', // Track last active status
          bio: '',
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      } else if (!userData.status) {
        // If status is missing, update it
        await set(userRef, {
          ...userData,
          email: currentUser.email, // Ensure email is stored
          status: 'Available',
          lastActiveStatus: 'Available', // Track last active status
          lastUpdated: serverTimestamp()
        });
      } else if (!userData.email && currentUser.email) {
        // If email is missing but is available in auth user, add it
        await set(ref(db, `users/${currentUser.uid}/email`), currentUser.email);
      } else if (userData.status === 'Offline' && userData.lastActiveStatus) {
        // If user is coming back online and has a previous active status, restore it
        await set(ref(db, `users/${currentUser.uid}/status`), userData.lastActiveStatus);
      } else if (userData.status !== 'Offline') {
        // If status is not offline, update lastActiveStatus
        await set(ref(db, `users/${currentUser.uid}/lastActiveStatus`), userData.status);
      }
      
      // Always set online status when user logs in
      const statusToSet = userData?.lastActiveStatus || 'Available';
      await set(ref(db, `users/${currentUser.uid}/status`), statusToSet);
      await set(ref(db, `users/${currentUser.uid}/lastSeen`), serverTimestamp());
    } catch (error) {
      console.error("Error ensuring user record:", error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Clean up previous listener if it exists
      if (userDataListener.current) {
        userDataListener.current();
        userDataListener.current = null;
      }
      
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Convert Firebase user to plain object
      const serializedUser = serializeUser(currentUser);
      
      // First set basic user from auth to avoid blank screens
      setUser(serializedUser);
      
      // Make sure user record exists and has required fields
      await ensureUserRecord(currentUser, serializedUser);
      
      // Now set up a persistent listener for database updates
      const userRef = ref(db, `users/${currentUser.uid}`);
      userDataListener.current = onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          // Create a full user object that properly merges auth and database data
          // Database values should take precedence over auth for overlapping fields
          const fullUser = {
            ...serializedUser,  // Base auth data
            ...userData,        // Database data (will override auth data for same keys)
            // Store high quality version separately if needed
            dbPhotoURL: userData.photoURL
          };
          
          // Only update if the data has actually changed
          if (!isEqual(fullUser, previousUserRef.current)) {
            // Clone the object to ensure we break reference equality
            previousUserRef.current = JSON.parse(JSON.stringify(fullUser));
            
            // Use the throttled update function instead of direct setState
            if (throttledUpdateRef.current) {
              throttledUpdateRef.current(previousUserRef.current);
            }
          }
        } else {
          // No database record yet, just use auth data
          if (!isEqual(serializedUser, previousUserRef.current)) {
            previousUserRef.current = JSON.parse(JSON.stringify(serializedUser));
            if (throttledUpdateRef.current) {
              throttledUpdateRef.current(previousUserRef.current);
            } else {
              setUser(previousUserRef.current);
            }
          }
        }
        
        // Only set loading to false after we have full user data
        setLoading(false);
      });
    });

    // Set offline status when component unmounts
    return () => {
      unsubscribe();
      
      if (userDataListener.current) {
        userDataListener.current();
      }
      
      // Update offline status when user leaves
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Set status to offline but don't change lastActiveStatus
        set(ref(db, `users/${currentUser.uid}/status`), 'Offline');
        set(ref(db, `users/${currentUser.uid}/lastSeen`), serverTimestamp());
      }
    };
  }, [ensureUserRecord]);

  const value = {
    user,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export const useAuth = () => useContext(AuthContext); 