// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// Remove or comment out unused analytics import
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBbeVVUebUAMUMMwNIMRDkVZ4wzyTh6EG8",
  authDomain: "chatapp2-76166.firebaseapp.com",
  databaseURL: "https://chatapp2-76166-default-rtdb.firebaseio.com",
  projectId: "chatapp2-76166",
  storageBucket: "chatapp2-76166.firebasestorage.app",
  messagingSenderId: "852529672920",
  appId: "1:852529672920:web:039625ec0615fc22585dad",
  measurementId: "G-V18XHKJH0N"
};

// Rate Limit
// const firebaseConfig = {
//   apiKey: "AIzaSyBWsFJpuWNmEjBR8uHYIdUCp8PqJCRHwLQ",
//   authDomain: "chatapplication-ae7a3.firebaseapp.com",
//   projectId: "chatapplication-ae7a3",
//   databaseURL: "https://chatapplication-ae7a3-default-rtdb.firebaseio.com",
//   messagingSenderId: "617966609443",
//   appId: "1:617966609443:web:201bb591baf4bb6aa7fd96"
// };


// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Remove or comment out unused analytics
// const analytics = getAnalytics(app);

// Export auth for use in login
export const auth = getAuth(app);
export const db = getDatabase(app);

// Database structure reference
/*
/chats
  /{chatId}
    /messages
      /{messageId}
        - content: string
        - sender: uid
        - timestamp: number
        - type: "text" | "image" | "file"
        - fileUrl?: string
        - reactions: { [uid]: string }
    /members
      /{uid}: boolean
    /info
      - name: string
      - type: "group" | "direct"
      - createdAt: number
      - lastMessage: string
      - lastMessageTime: number

/users
  /{uid}
    - displayName: string
    - email: string
    - photoURL: string
    - status: "online" | "offline"
    - lastSeen: number
    /chats
      /{chatId}: boolean
*/