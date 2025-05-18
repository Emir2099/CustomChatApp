---
sidebar_position: 3
---

# MessageInput Component

The MessageInput component is where all the action happens in the chat UI. It's the control panel that lets users compose and send their messages.

![Message Input Component](/img/message-input.png)

## What It Does

This component handles a bunch of user interactions:

- Typing and sending text messages
- Uploading and sending files
- Showing emoji picker
- Handling reply functionality
- Providing typing indicators

## How I Built It

I wanted to make the message input feel responsive and intuitive, similar to modern chat apps like WhatsApp or Messenger. Here's the basic structure:

```jsx
// src/components/chat/MessageInput.jsx
import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import ReplyPreview from './ReplyPreview';
import styles from './MessageInput.module.css';
import debounce from 'lodash.debounce';

export default function MessageInput({ 
  onSend, 
  disabled = false, 
  replyingTo = null,
  onCancelReply = () => {}
}) {
  // State
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // References
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Context
  const { setTypingStatus, ALLOWED_FILE_TYPES } = useChat();
  
  // Create debounced typing indicator function
  const debouncedTypingStatus = useRef(
    debounce((isTyping) => {
      setTypingStatus(isTyping);
    }, 500)
  ).current;
  
  // Focus input when component mounts or when replying
  useEffect(() => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled, replyingTo]);
  
  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedTypingStatus.cancel();
      // Set typing status to false when component unmounts
      setTypingStatus(false);
    };
  }, [debouncedTypingStatus, setTypingStatus]);
  
  // Handle message change and typing indicators
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    
    // Update typing status
    if (value.length > 0) {
      debouncedTypingStatus(true);
    } else {
      debouncedTypingStatus(false);
    }
  };
  
  // Handle message send
  const handleSend = (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    // Call the onSend callback with the message
    onSend(message);
    
    // Clear the input and reset typing status
    setMessage('');
    debouncedTypingStatus(false);
    setTypingStatus(false);
  };
  
  // Handle file upload button click
  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert(`File type ${file.type} is not supported. Supported types: ${ALLOWED_FILE_TYPES.join(', ')}`);
      return;
    }
    
    // Begin upload
    setIsUploading(true);
    
    // Send the file
    onSend(file, (progress) => {
      setUploadProgress(progress);
      if (progress === 100) {
        setIsUploading(false);
        setUploadProgress(0);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  };
  
  
  return (
    <div className={styles.messageInputContainer}>
      {replyingTo && (
        <ReplyPreview 
          message={replyingTo} 
          onCancel={onCancelReply} 
        />
      )}
      
      {isUploading && (
        <div className={styles.uploadProgress}>
          <div 
            className={styles.progressBar} 
            style={{ width: `${uploadProgress}%` }} 
          />
          <span>Uploading: {uploadProgress}%</span>
        </div>
      )}
      
    </div>
  );
}
```

## The Technical Challenges

### Typing Indicators

Implementing typing indicators was tricky. I didn't want to flood the database with updates every time a key was pressed, so I used debouncing:

```jsx
// Create debounced typing indicator function
const debouncedTypingStatus = useRef(
  debounce((isTyping) => {
    setTypingStatus(isTyping);
  }, 500)
).current;
```

This means the typing status only updates if the user hasn't typed for 500ms, which drastically reduces database writes.

### File Uploads

For file uploads, I decided to use base64 encoding rather than Firebase Storage to keep things simpler. The tricky part was handling the progress indicator:

```jsx
// In the parent component that handles file sending
const sendFile = async (file, progressCallback) => {
  try {
    // Convert to base64 (first 50% of progress)
    progressCallback(10);
    
    // Convert file to base64
    const base64 = await fileToBase64(file);
    progressCallback(50);
    
    // Send to database (remaining 50% of progress)
    await sendFileMessage(file, base64);
    progressCallback(100);
    
  } catch (error) {
    console.error("Error sending file:", error);
  }
};
```

## UX Considerations

I added several features to improve the user experience:

1. **Disabled State**: The input is disabled when you can't send messages (like when you've blocked someone)
2. **Visual Feedback**: Upload progress is shown with a progress bar
3. **Focus Management**: The input automatically focuses when the component mounts or when replying
4. **Input Clearing**: The input clears after sending a message

## Future Improvements

If I were to enhance this component, I'd consider:

1. Adding emoji picker functionality
2. Implementing markdown support for text formatting
3. Adding gif selector integration
4. Improving file upload to handle larger files with chunking 