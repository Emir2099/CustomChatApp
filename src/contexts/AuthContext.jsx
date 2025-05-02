import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import PropTypes from 'prop-types';

const AuthContext = createContext();

// Helper function to extract only the serializable properties from auth user
const serializeUser = (firebaseUser) => {
  if (!firebaseUser) return null;
  
  // Extract only the properties we need
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userDataListener = useRef(null);
  const previousUserRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
      
      // First set basic user from auth
      setUser(serializedUser);
      setLoading(false);
      
      // Then set up a separate listener for database updates
      const userRef = ref(db, `users/${currentUser.uid}`);
      userDataListener.current = onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          // Create a full user object that combines auth and database data
          const fullUser = {
            ...serializedUser,
            ...userData,
            dbPhotoURL: userData.photoURL // Store the high quality version
          };
          
          // Only update if the data has actually changed
          if (!isEqual(fullUser, previousUserRef.current)) {
            previousUserRef.current = fullUser;
            setUser(fullUser);
          }
        }
      });
    });

    return () => {
      unsubscribe();
      if (userDataListener.current) {
        userDataListener.current();
      }
    };
  }, []);

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