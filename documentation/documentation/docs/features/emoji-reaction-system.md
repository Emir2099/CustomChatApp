---
sidebar_position: 18
---

# Emoji/Reaction System

Adding a robust emoji reaction system was essential to make conversations more expressive and engaging. I wanted users to be able to quickly react to messages without typing full responses, similar to popular messaging platforms.

## Core Emoji Features

I implemented a reaction system with multiple features:

1. Quick reactions to messages
2. Custom emoji support
3. Support for multiple reactions per message

```jsx
// src/components/emoji/MessageReactions.jsx
function MessageReactions({ message }) {
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const { addReaction, removeReaction } = useChat();
  const { currentUser } = useAuth();
  const reactionsContainerRef = useRef(null);
  const panelRef = useRef(null);
  
  // Group reactions by emoji
  const groupedReactions = useMemo(() => {
    if (!message.reactions) return [];
    
    const groups = {};
    
    Object.entries(message.reactions).forEach(([reactionId, reaction]) => {
      const emojiKey = reaction.custom ? `custom:${reaction.emojiId}` : reaction.emoji;
      
      if (!groups[emojiKey]) {
        groups[emojiKey] = {
          emoji: reaction.emoji,
          custom: reaction.custom,
          url: reaction.url,
          emojiId: reaction.emojiId,
          count: 0,
          users: [],
          userReactionId: null // Store the reactionId if current user reacted
        };
      }
      
      groups[emojiKey].count++;
      groups[emojiKey].users.push(reaction.userId);
      
      // Check if current user added this reaction
      if (reaction.userId === currentUser?.uid) {
        groups[emojiKey].userReactionId = reactionId;
      }
    });
    
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [message.reactions, currentUser]);
  
  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target) && 
        !reactionsContainerRef.current.contains(event.target)
      ) {
        setShowReactionPanel(false);
      }
    };
    
    if (showReactionPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionPanel]);
  
  // Handle adding a reaction
  const handleAddReaction = (emoji) => {
    addReaction(message.chatId, message.id, emoji);
    setShowReactionPanel(false);
  };
  
  // Toggle a reaction (add or remove)
  const handleToggleReaction = (reaction) => {
    // If user already reacted with this emoji, remove it
    if (reaction.userReactionId) {
      removeReaction(message.chatId, message.id, reaction.userReactionId);
    } else {
      // Add reaction with this emoji
      const emoji = {
        native: reaction.emoji,
        custom: reaction.custom,
        emojiId: reaction.emojiId,
        url: reaction.url
      };
      
      addReaction(message.chatId, message.id, emoji);
    }
  };
  
  return (
    <div className={styles.reactionsContainer}>
      {/* Grouped reactions display */}
      <div className={styles.reactionsList}>
        {groupedReactions.map((reaction, index) => (
          <button
            key={`${reaction.emoji}-${index}`}
            className={`${styles.reactionBadge} ${
              reaction.userReactionId ? styles.userReacted : ''
            }`}
            onClick={() => handleToggleReaction(reaction)}
            title={`${reaction.count} ${reaction.count === 1 ? 'person' : 'people'}`}
          >
            {reaction.custom ? (
              <img 
                src={reaction.url} 
                alt="" 
                className={styles.reactionEmoji} 
              />
            ) : (
              <span className={styles.reactionEmoji}>{reaction.emoji}</span>
            )}
            <span className={styles.reactionCount}>{reaction.count}</span>
          </button>
        ))}
      </div>
      
      {/* Add reaction button */}
      <div 
        className={styles.addReactionContainer}
        ref={reactionsContainerRef}
      >
        <button 
          className={styles.addReactionButton} 
          onClick={() => setShowReactionPanel(!showReactionPanel)}
          aria-label="Add reaction"
        >
          <SmileIcon className={styles.addReactionIcon} />
        </button>
        
        {showReactionPanel && (
          <div 
            className={styles.reactionPanelContainer} 
            ref={panelRef}
          >
            <div className={styles.reactionOptions}>
              {/* Quick reaction options */}
              {quickReactions.map(emoji => (
                <button
                  key={emoji}
                  className={styles.reactionOption}
                  onClick={() => handleAddReaction({ native: emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Custom Emoji Management

I implemented support for custom/uploaded emojis:

```jsx
// src/components/emoji/CustomEmojiManager.jsx
function CustomEmojiManager() {
  const [customEmojis, setCustomEmojis] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [newEmojiName, setNewEmojiName] = useState("");
  const fileInputRef = useRef(null);
  
  const { currentUser } = useAuth();
  const { currentChat } = useChat();
  
  // Load custom emojis for the current chat
  useEffect(() => {
    if (!currentChat?.id) return;
    
    const customEmojisRef = ref(db, `chatEmojis/${currentChat.id}`);
    
    const handleEmojisChange = (snapshot) => {
      if (snapshot.exists()) {
        const emojisData = snapshot.val();
        const formattedEmojis = Object.entries(emojisData).map(([id, data]) => ({
          id,
          ...data
        }));
        
        setCustomEmojis(formattedEmojis);
      } else {
        setCustomEmojis([]);
      }
    };
    
    onValue(customEmojisRef, handleEmojisChange);
    
    return () => off(customEmojisRef);
  }, [currentChat?.id]);
  
  // Check if user can manage emojis (admin or moderator)
  const canManageEmojis = useMemo(() => {
    if (!currentChat || !currentUser) return false;
    
    // For group chats, check role
    if (currentChat.isGroup && currentChat.groupData) {
      const userRole = currentChat.groupData.members?.[currentUser.uid]?.role;
      return userRole === 'admin' || userRole === 'moderator';
    }
    
    // For direct chats, both users can add custom emojis
    return true;
  }, [currentChat, currentUser]);
  
  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
      setError('Please select an image file');
      return;
    }
    
    if (file.size > 1024 * 1024) { // 1MB limit
      setError('Image size must be under 1MB');
      return;
    }
    
    // Proceed with upload
    handleUpload(file);
  };
  
  // Upload custom emoji
  const handleUpload = async (file) => {
    if (!newEmojiName.trim()) {
      setError('Please enter a name for the emoji');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      // Create storage reference
      const storageRef = ref(
        storage, 
        `emojis/${currentChat.id}/${Date.now()}_${file.name}`
      );
      
      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading emoji:', error);
          setError('Failed to upload emoji. Please try again.');
          setIsUploading(false);
        },
        async () => {
          // Upload complete
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Save emoji to database
          const emojiRef = ref(db, `chatEmojis/${currentChat.id}`);
          const newEmojiRef = push(emojiRef);
          
          await set(newEmojiRef, {
            name: newEmojiName.trim(),
            url: downloadUrl,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp()
          });
          
          // Reset form
          setNewEmojiName("");
          setUploadProgress(0);
          setIsUploading(false);
          
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      );
    } catch (err) {
      console.error('Error in emoji upload:', err);
      setError('Something went wrong. Please try again.');
      setIsUploading(false);
    }
  };
  
  // Delete custom emoji
  const handleDelete = async (emojiId) => {
    if (!canManageEmojis) return;
    
    try {
      // Get emoji data to delete from storage
      const emojiRef = ref(db, `chatEmojis/${currentChat.id}/${emojiId}`);
      const emojiSnapshot = await get(emojiRef);
      
      if (emojiSnapshot.exists()) {
        const emojiData = emojiSnapshot.val();
        
        // Delete from database
        await remove(emojiRef);
        
        // Delete from storage if possible
        try {
          const storageRef = ref(storage, emojiData.url);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.error('Error deleting emoji from storage:', storageError);
          // Continue anyway since DB entry is removed
        }
      }
    } catch (err) {
      console.error('Error deleting custom emoji:', err);
      setError('Failed to delete emoji');
    }
  };
  
  return (
    <div className={styles.customEmojiManager}>
      <h3>Custom Emojis</h3>
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      {canManageEmojis && (
        <div className={styles.uploadSection}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder="Emoji name"
              value={newEmojiName}
              onChange={(e) => setNewEmojiName(e.target.value)}
              className={styles.emojiNameInput}
              disabled={isUploading}
            />
            
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className={styles.fileInput}
              disabled={isUploading}
            />
            
            <button
              className={styles.browseButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Browse
            </button>
          </div>
          
          {isUploading && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${uploadProgress}%` }}
              />
              <span className={styles.progressText}>{Math.round(uploadProgress)}%</span>
            </div>
          )}
        </div>
      )}
      
      <div className={styles.emojiGrid}>
        {customEmojis.length === 0 ? (
          <div className={styles.noEmojis}>
            No custom emojis added yet
          </div>
        ) : (
          customEmojis.map(emoji => (
            <div key={emoji.id} className={styles.emojiItem}>
              <img 
                src={emoji.url} 
                alt={emoji.name} 
                className={styles.emojiImage}
              />
              <span className={styles.emojiName}>{emoji.name}</span>
              
              {canManageEmojis && (
                <button 
                  className={styles.deleteButton}
                  onClick={() => handleDelete(emoji.id)}
                  aria-label={`Delete ${emoji.name}`}
                >
                  <DeleteIcon />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

## Reaction Context

To manage reactions throughout the application, I created dedicated methods in the chat context:

```jsx
// src/contexts/ChatContext.jsx - Reaction methods
// Add a reaction to a message
const addReaction = async (chatId, messageId, emoji) => {
  if (!currentUser || !chatId || !messageId) return;
  
  try {
    // Create reaction entry
    const reactionsRef = ref(db, `messages/${chatId}/${messageId}/reactions`);
    const newReactionRef = push(reactionsRef);
    
    const reactionData = formatReactionForStorage(emoji, currentUser.uid);
    
    await set(newReactionRef, reactionData);
    
    return true;
  } catch (error) {
    console.error("Error adding reaction:", error);
    return false;
  }
};

// Remove a reaction from a message
const removeReaction = async (chatId, messageId, reactionId) => {
  if (!currentUser || !chatId || !messageId || !reactionId) return;
  
  try {
    const reactionRef = ref(db, `messages/${chatId}/${messageId}/reactions/${reactionId}`);
    
    // Security check - ensure user can only remove their own reactions
    const snapshot = await get(reactionRef);
    
    if (snapshot.exists()) {
      const reactionData = snapshot.val();
      
      // Only allow removing if user is the reaction owner or has admin rights
      if (reactionData.userId === currentUser.uid || isCurrentUserAdmin()) {
        await remove(reactionRef);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error removing reaction:", error);
    return false;
  }
};
```

## Technical Challenges

### Performance with Many Reactions

When messages get many reactions, rendering can become slow:

```jsx
// Performance optimization for messages with lots of reactions
// src/components/chat/MessageReactions.jsx
function MessageReactions({ message }) {
  // ... existing code ...
  
  // Only render the most common reactions if there are too many
  const displayedReactions = useMemo(() => {
    // If less than threshold, show all
    if (groupedReactions.length <= 8) {
      return groupedReactions;
    }
    
    // Otherwise, prioritize showing reactions the user participated in
    const userReactions = groupedReactions.filter(r => r.userReactionId);
    const otherReactions = groupedReactions.filter(r => !r.userReactionId);
    
    // Sort others by popularity
    const sortedOthers = otherReactions.sort((a, b) => b.count - a.count);
    
    // Combine up to 8 total reactions
    return [...userReactions, ...sortedOthers]
      .slice(0, 8)
      .sort((a, b) => b.count - a.count);
  }, [groupedReactions]);
  
  // Additional UI to show total reaction count when not all are displayed
  const totalReactionCount = useMemo(() => {
    return groupedReactions.reduce((total, reaction) => total + reaction.count, 0);
  }, [groupedReactions]);
  
  const hiddenReactionCount = groupedReactions.length > 8 
    ? totalReactionCount - displayedReactions.reduce((sum, r) => sum + r.count, 0)
    : 0;
  
  // ... render using displayedReactions instead of groupedReactions ...
}
```

### Custom Emoji Storage Optimization

Custom emojis can consume a lot of storage space:

```jsx
// Optimizing custom emoji uploads
// src/utils/imageProcessing.js
export const optimizeImage = async (file) => {
  return new Promise((resolve, reject) => {
    // Create new image element
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target.result;
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        
        // Max size for custom emojis (64x64)
        const MAX_SIZE = 64;
        
        let width = img.width;
        let height = img.height;
        
        // Maintain aspect ratio
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round(height * MAX_SIZE / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round(width * MAX_SIZE / height);
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw resized image
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to Blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to process image'));
            return;
          }
          
          // Create a new File object
          const optimizedFile = new File([blob], file.name, {
            type: 'image/png',
            lastModified: Date.now()
          });
          
          resolve(optimizedFile);
        }, 'image/png', 0.8); // Use PNG for emojis with transparency
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};

// Used in CustomEmojiManager.jsx
const handleFileSelect = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!file.type.match('image.*')) {
    setError('Please select an image file');
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) { // 2MB initial limit
    setError('Image size must be under 2MB');
    return;
  }
  
  try {
    // Optimize the image before upload
    const optimizedFile = await optimizeImage(file);
    handleUpload(optimizedFile);
  } catch (err) {
    console.error('Error optimizing image:', err);
    setError('Failed to process image. Please try another.');
  }
};
```

### Emoji Data Synchronization

Keeping emoji data in sync across clients was challenging:

```jsx
// src/contexts/EmojiContext.jsx
export function EmojiProvider({ children }) {
  const [customEmojis, setCustomEmojis] = useState({});
  const [customEmojisByChat, setCustomEmojisByChat] = useState({});
  const [recentEmojis, setRecentEmojis] = useState([]);
  
  const { currentUser } = useAuth();
  const { userChats } = useChat();
  
  // Load recent emojis from local storage
  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
    
    // Set up storage event listener to sync recent emojis across tabs
    const handleStorageChange = (e) => {
      if (e.key === 'recentEmojis') {
        try {
          const updatedEmojis = JSON.parse(e.newValue || '[]');
          setRecentEmojis(updatedEmojis);
        } catch (err) {
          console.error('Error parsing recent emojis from storage event:', err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Load global custom emojis
  useEffect(() => {
    if (!currentUser) return;
    
    const globalEmojisRef = ref(db, 'globalEmojis');
    
    const handleGlobalEmojis = (snapshot) => {
      if (snapshot.exists()) {
        const emojisData = snapshot.val();
        const formattedEmojis = {};
        
        Object.entries(emojisData).forEach(([id, data]) => {
          formattedEmojis[id] = {
            id,
            ...data,
            custom: true
          };
        });
        
        setCustomEmojis(formattedEmojis);
      }
    };
    
    onValue(globalEmojisRef, handleGlobalEmojis);
    
    return () => off(globalEmojisRef);
  }, [currentUser]);
  
  // Load custom emojis for all user's chats
  useEffect(() => {
    if (!currentUser || !userChats.length) return;
    
    const chatEmojiRefs = {};
    const chatEmojis = {};
    
    userChats.forEach(chatId => {
      const chatEmojiRef = ref(db, `chatEmojis/${chatId}`);
      chatEmojiRefs[chatId] = chatEmojiRef;
      
      onValue(chatEmojiRef, (snapshot) => {
        if (snapshot.exists()) {
          const emojisData = snapshot.val();
          const formattedEmojis = {};
          
          Object.entries(emojisData).forEach(([id, data]) => {
            formattedEmojis[id] = {
              id,
              ...data,
              custom: true,
              chatId
            };
          });
          
          chatEmojis[chatId] = formattedEmojis;
          setCustomEmojisByChat({...chatEmojis});
        } else {
          chatEmojis[chatId] = {};
          setCustomEmojisByChat({...chatEmojis});
        }
      });
    });
    
    return () => {
      Object.values(chatEmojiRefs).forEach(ref => off(ref));
    };
  }, [currentUser, userChats]);
  
  return (
    <EmojiContext.Provider value={{
      recentEmojis,
      customEmojis,
      customEmojisByChat,
      getCustomEmojiById: (id) => customEmojis[id] || null,
      getChatEmojis: (chatId) => customEmojisByChat[chatId] || {},
      getAllAvailableEmojis: (chatId) => {
        // Combine global and chat-specific emojis
        return {
          ...customEmojis,
          ...(customEmojisByChat[chatId] || {})
        };
      }
    }}>
      {children}
    </EmojiContext.Provider>
  );
}
```

## Future Improvements

I have several ideas to enhance the emoji and reaction system:

1. **Emoji Categories** - Allow users to organize custom emojis into categories.

2. **Reaction Analytics** - Show which emojis are most popular in different chats.

3. **Animated Emoji Support** - Add support for animated GIFs as custom emojis.

4. **Emoji Pack Importing** - Allow importing sets of custom emojis all at once.

5. **Reaction Highlights** - Highlight messages that receive many reactions.

The emoji reaction system has been a hit with users, making conversations more dynamic and expressive. It's especially popular in group chats where quick reactions are often preferred over typing full responses. 