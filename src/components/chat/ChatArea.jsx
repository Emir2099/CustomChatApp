import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './ChatArea.module.css';
import React from 'react';
import ChatAreaSkeleton from './ChatAreaSkeleton';
import MessageReactions from './MessageReactions';

export default function ChatArea() {
  const { 
    currentChat, 
    messages, 
    sendMessage, 
    sendFileMessage, 
    fileUploads,
    handleVote, 
    markChatAsRead,
    FILE_SIZE_LIMIT,
    ALLOWED_FILE_TYPES,
    typingUsers,
    setTypingStatus,
    loadMoreMessages,
    hasMoreMessages,
    loading
  } = useChat();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [fileUploadError, setFileUploadError] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reachedTop, setReachedTop] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const fileInputRef = useRef(null);
  const messageListRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [buttonFading, setButtonFading] = useState(false);
  const [newMessageReceived, setNewMessageReceived] = useState(false);
  const prevMessagesLengthRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const [userScrolling, setUserScrolling] = useState(false);
  const userManuallyScrolledRef = useRef(false);
  const isScrollingToBottomRef = useRef(false);
  const recentlySentMessageRef = useRef(false);
  const hasUnreadMessagesRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const [isAtTop, setIsAtTop] = useState(false);
  const currentChatIdRef = useRef(null);

  // Force check if scrolling is actually needed
  const checkIfScrollNeeded = () => {
    if (!messageListRef.current) return false;
    
    const { scrollHeight, clientHeight } = messageListRef.current;
    // If content is not tall enough to scroll, no button needed
    return scrollHeight > clientHeight + 50; // Adding buffer
  };

  // Set message loading state when switching chats
  useEffect(() => {
    if (currentChat?.id && currentChat.id !== currentChatIdRef.current) {
      setMessagesLoading(true);
      currentChatIdRef.current = currentChat.id;
      
      // Reset scrolling state variables when switching chats
      prevMessagesLengthRef.current = 0;
      isAtBottomRef.current = true;
      userManuallyScrolledRef.current = false;
      isScrollingToBottomRef.current = false;
      recentlySentMessageRef.current = false;
      hasUnreadMessagesRef.current = false;
      setNewMessageReceived(false);
      setReachedTop(false);
      setIsAtTop(false);
    }
  }, [currentChat?.id]);

  // Clear message loading state once messages are loaded
  useEffect(() => {
    if (messages.length > 0 && messagesLoading) {
      // Short delay to allow messages to render
      const timer = setTimeout(() => {
        setMessagesLoading(false);
        
        // After messages load, scroll to bottom
        requestAnimationFrame(() => {
          if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
          }
        });
      }, 300); // Reduced timeout for faster loading
      
      return () => clearTimeout(timer);
    }
  }, [messages, messagesLoading]);

  // Check if the current chat has unread messages
  useEffect(() => {
    if (currentChat) {
      // Check if current chat has any unread messages
      const hasUnread = 
        (currentChat.unreadMessages > 0 || 
         currentChat.unreadAnnouncements > 0 || 
         currentChat.unreadPolls > 0);
      
      hasUnreadMessagesRef.current = hasUnread;
    }
  }, [currentChat]);

  // Auto-scroll to bottom when chat is opened or messages change - but ONLY in specific cases
  useEffect(() => {
    // Only scroll automatically in these cases:
    // 1. First load of messages (prevMessagesLengthRef.current === 0)
    // 2. When user was already at the bottom when new message arrived
    // 3. When user themselves sent the message (captured in handleSend)
    // Do NOT auto-scroll when user has manually scrolled up to read history

    const isFirstLoad = prevMessagesLengthRef.current === 0;
    const newMessagesArrived = messages.length > prevMessagesLengthRef.current;
    
    if (messageListRef.current && ((isFirstLoad && messages.length > 0) || 
        (newMessagesArrived && isAtBottomRef.current && !userManuallyScrolledRef.current))) {
      // Auto-scroll in safe cases
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      }, 100); // Short delay to ensure rendering is complete
    } else if (newMessagesArrived && !isAtBottomRef.current && !isLoadingMore) {
      // Only show new message notification if:
      // 1. New messages arrived AND
      // 2. User is scrolled up AND 
      // 3. We're not currently loading older messages
      if (checkIfScrollNeeded() && !recentlySentMessageRef.current) {
        setShowScrollButton(true);
        setNewMessageReceived(true);
      }
    }

    prevMessagesLengthRef.current = messages.length;
    
    // Clear recent message flag after a delay
    if (recentlySentMessageRef.current) {
      setTimeout(() => {
        recentlySentMessageRef.current = false;
      }, 1000);
    }
  }, [messages, isLoadingMore]);

  // Also auto-scroll to the bottom when typing indicators appear or disappear
  useEffect(() => {
    // Only auto-scroll if the user is already at the bottom
    if (isAtBottomRef.current && messageListRef.current && !userManuallyScrolledRef.current) {
      requestAnimationFrame(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      });
    }
  }, [typingUsers]);

  // Reset scroll state when chat changes
  useEffect(() => {
    if (currentChat) {
      if (showScrollButton) {
        setShowScrollButton(false);
        setButtonFading(false);
      }
      prevMessagesLengthRef.current = 0;
      isAtBottomRef.current = true;
      userManuallyScrolledRef.current = false;
      isScrollingToBottomRef.current = false;
      recentlySentMessageRef.current = false;
      hasUnreadMessagesRef.current = false;
      setNewMessageReceived(false);
      setReachedTop(false);
      
      // Reset and scroll to bottom when changing chats
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [currentChat?.id]);

  // Update reachedTop state when hasMoreMessages changes
  useEffect(() => {
    if (!hasMoreMessages) {
      setReachedTop(true);
    } else {
      setReachedTop(false);
    }
  }, [hasMoreMessages]);

  // Handle scroll events to show/hide scroll button and check if at top
  const handleScroll = () => {
    // Don't process scroll events during programmatic scrolling
    if (!messageListRef.current || isScrollingToBottomRef.current || recentlySentMessageRef.current || !currentChat?.id) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
    
    // Check if scrolled to top (within 50px of the top)
    const atTop = scrollTop < 50;
    
    // Only update isAtTop if we're genuinely at the top AND not just sent a message
    // IMPORTANT FIX: Only change isAtTop state when truly changing from not-top to top
    // This prevents unnecessary re-renders that cause messages to disappear
    if (!recentlySentMessageRef.current && atTop !== isAtTop) {
      setIsAtTop(atTop);
    }
    
    // Only show button if there's actually enough content to scroll
    if (!checkIfScrollNeeded()) {
      if (showScrollButton) {
        setShowScrollButton(false);
        setButtonFading(false);
      }
      return;
    }
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      
    // Mark if user initiated this scroll
    if (!userScrolling) {
      setUserScrolling(true);
      userManuallyScrolledRef.current = true;
      setTimeout(() => setUserScrolling(false), 150); // Debounce
    }
      
    if (isNearBottom) {
      // User has scrolled to the bottom
      if (showScrollButton && !buttonFading) {
        setShowScrollButton(false);
        setButtonFading(false);
      }
      isAtBottomRef.current = true;
      
      // Reset new message notification when user scrolls to bottom
      if (newMessageReceived) {
        setNewMessageReceived(false);
      }
      
      // If at bottom, ALWAYS mark messages as read, regardless of previous status
      // This ensures messages are marked as read whenever user sees them
      markChatAsRead(currentChat.id);
      hasUnreadMessagesRef.current = false;
    } else {
      // User is scrolled up
      isAtBottomRef.current = false;
      
      // Only show the scroll button with notification indicator if:
      // 1. The button isn't already showing AND
      // 2. We're not already scrolling to bottom AND
      // 3. Either we have new messages OR we're significantly away from the bottom
      if (!showScrollButton && !buttonFading && !isScrollingToBottomRef.current) {
        setShowScrollButton(true);
        // Only show notification dot if we actually have new unread messages
        // Don't show it just because we're scrolled up
        if (newMessageReceived) {
          // Keep the notification dot
        } else {
          // No new messages, just show the scroll button without notification
          setNewMessageReceived(false);
        }
      }
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (!messageListRef.current || !currentChat?.id) return;
    
    // DIRECTLY mark messages as read when scrolling to bottom via button click
    // Don't check for hasUnreadMessagesRef - always mark as read when button is clicked
    markChatAsRead(currentChat.id);
    hasUnreadMessagesRef.current = false;
    
    // Set a flag to prevent button flicker during scroll
    isScrollingToBottomRef.current = true;
    
    // Immediately hide button and prevent any reappearance during scrolling
    setShowScrollButton(false);
    setButtonFading(false);
    
    // Reset the new message indicator when scrolling to bottom
    setNewMessageReceived(false);
    
    // Scroll to bottom
    messageListRef.current.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    
    // Reset scroll flags after animation completes
    userManuallyScrolledRef.current = false;
    setTimeout(() => {
      isScrollingToBottomRef.current = false;
      isAtBottomRef.current = true;
    }, 700); // Extended timeout to ensure scroll completes
  };

  // Function to render typing indicators
  const renderTypingIndicators = () => {
    if (!typingUsers || Object.keys(typingUsers).length === 0) return null;
    
    const typingUsersArray = Object.values(typingUsers);
    
    // Limit to showing max 3 typing indicators
    const displayCount = Math.min(typingUsersArray.length, 3);
    const displayUsers = typingUsersArray.slice(0, displayCount);
    
    let typingText = '';
    if (displayCount === 1) {
      typingText = `${displayUsers[0].displayName} is typing...`;
    } else if (displayCount === 2) {
      typingText = `${displayUsers[0].displayName} and ${displayUsers[1].displayName} are typing...`;
    } else if (displayCount === 3) {
      typingText = `${displayUsers[0].displayName}, ${displayUsers[1].displayName}, and ${displayUsers[2].displayName} are typing...`;
    } else {
      typingText = `${displayUsers[0].displayName}, ${displayUsers[1].displayName}, and ${typingUsersArray.length - 2} others are typing...`;
    }
    
    return (
      <div className={styles.typingIndicator}>
        <div className={styles.typingAnimation}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className={styles.typingText}>{typingText}</div>
      </div>
    );
  };

  // Enhanced message change handler with more responsive typing status
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Update typing status with debounce
    if (value.length > 0) {
      // Set typing status to true
      setTypingStatus(true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing status after inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(false);
      }, 3000);
    } else {
      // If message is empty, immediately clear typing status
      setTypingStatus(false);
    }
  };
  
  // Clear typing status when sending message
  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChat?.id) return;
    
    const message = newMessage.trim();
    setNewMessage('');
    
    // Clear typing status
    setTypingStatus(false);
    
    // Mark as recently sent to prevent button from showing
    recentlySentMessageRef.current = true;
    
    // Explicitly set isAtTop to false to prevent "load more" button from showing
    setIsAtTop(false);
    
    // Send message first
    sendMessage(message);
    
    // Always mark messages as read when sending a message
    markChatAsRead(currentChat.id);
    hasUnreadMessagesRef.current = false;
    
    // User sent a message, so they want to see it - safe to scroll
    userManuallyScrolledRef.current = false;
    isScrollingToBottomRef.current = true;
    
    // Immediately hide button and prevent any reappearance during scrolling
    setShowScrollButton(false);
    setButtonFading(false);
    
    // Wait for the DOM to update with the new message before scrolling
    requestAnimationFrame(() => {
      // Use a longer timeout to ensure smooth animation after message is rendered
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTo({
            top: messageListRef.current.scrollHeight,
            behavior: 'smooth'
          });
          
          // Reset lock after scroll completes but keep the recently sent flag
          setTimeout(() => {
            isScrollingToBottomRef.current = false;
            isAtBottomRef.current = true;
            // Double-check that button is hidden
            if (showScrollButton) {
              setShowScrollButton(false);
              setButtonFading(false);
            }
          }, 700);
        }
      }, 150); // Slightly longer delay for smoother animation
    });
  };

  // Handle file selection
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file upload with optimized image compression
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset file input to allow re-uploading the same file
    fileInputRef.current.value = '';
    
    // Validate file size
    if (file.size > FILE_SIZE_LIMIT) {
      setFileUploadError(`File size exceeds ${FILE_SIZE_LIMIT / (1024 * 1024)}MB limit`);
      setTimeout(() => setFileUploadError(''), 5000);
      return;
    }
    
    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileUploadError('File type not supported');
      setTimeout(() => setFileUploadError(''), 5000);
      return;
    }

    try {
      // Prepare for upload - clear any previous errors
      setFileUploadError('');
      
      // Apply client-side compression if it's an image
      let processedFile = file;
      if (file.type.startsWith('image/')) {
        processedFile = await compressImage(file);
      }
      
      // Send the file and track progress
      await sendFileMessage(processedFile, () => {
        // Progress is tracked in the ChatContext
      });
      
      // Mark as recently sent to prevent button from showing
      recentlySentMessageRef.current = true;
      
      // Always mark messages as read when sending a message
      markChatAsRead(currentChat.id);
      hasUnreadMessagesRef.current = false;
      
      // User sent a message, so they want to see it - safe to scroll
      userManuallyScrolledRef.current = false;
      isScrollingToBottomRef.current = true;
      
      // Immediately hide button and prevent any reappearance during scrolling
      setShowScrollButton(false);
      setButtonFading(false);
    } catch (error) {
      console.error('Error uploading file:', error);
      setFileUploadError(error.message || 'Failed to upload file');
      setTimeout(() => setFileUploadError(''), 5000);
    }
  };

  // Compress image before uploading
  const compressImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = () => {
        const img = new Image();
        img.src = reader.result;
        
        img.onload = () => {
          // Determine target dimensions - scale down large images
          let targetWidth = img.width;
          let targetHeight = img.height;
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
          if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
            if (img.width > img.height) {
              targetWidth = MAX_WIDTH;
              targetHeight = Math.round(img.height * (MAX_WIDTH / img.width));
            } else {
              targetHeight = MAX_HEIGHT;
              targetWidth = Math.round(img.width * (MAX_HEIGHT / img.height));
            }
          }
          
          // Create canvas and resize image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          // Get the compressed data as a Blob
          const compressedFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressionQuality = file.size > 1024 * 1024 ? 0.6 : 0.8; // Lower quality for larger files
          
          canvas.toBlob((blob) => {
            if (blob) {
              // Create a new file from the blob
              const compressedFile = new File([blob], file.name, {
                type: compressedFormat,
                lastModified: Date.now()
              });
              
              resolve(compressedFile);
            } else {
              // If compression fails, use the original file
              resolve(file);
            }
          }, compressedFormat, compressionQuality);
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image for compression'));
        };
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read the file'));
      };
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Handle download for file messages
  const handleDownload = (fileData, fileName) => {
    // Create a download link
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render file preview based on file type
  const renderFilePreview = (message) => {
    const { fileCategory, fileData, fileName, fileSize } = message;
    
    // Check if image embedding is disabled in the current chat
    const isImageEmbeddingDisabled = currentChat?.embedImages === false;
    
    return (
      <div className={styles.fileMessage}>
        <div className={styles.fileHeader}>
          {fileCategory === 'image' && !isImageEmbeddingDisabled ? (
            <div className={styles.imagePreview}>
              <img 
                src={fileData} 
                alt={fileName} 
                loading="lazy" 
              />
            </div>
          ) : (
            <div className={styles.fileIcon}>
              {fileCategory === 'image' && isImageEmbeddingDisabled ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              ) : fileCategory === 'pdf' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 3v4a1 1 0 001 1h4" />
                  <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                  <path d="M9 9h1v1H9z" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                </svg>
              )}
              {fileCategory === 'document' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
              )}
              {fileCategory === 'spreadsheet' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                </svg>
              )}
              {(fileCategory === 'text' || fileCategory === 'file') && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
              )}
            </div>
          )}
        </div>
        <div className={styles.fileInfo}>
          <div className={styles.fileName}>{fileName}</div>
          <div className={styles.fileSize}>{formatFileSize(fileSize)}</div>
        </div>
        <button 
          className={styles.downloadButton}
          onClick={() => handleDownload(fileData, fileName)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
          Download
        </button>
      </div>
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const shouldShowDate = (message, index, messageArray) => {
    if (!message.timestamp) return false;
    
    // For first message with timestamp
    if (index === 0) return true;
    
    const currentDate = new Date(message.timestamp).toDateString();
    const prevDate = new Date(messageArray[index - 1].timestamp || 0).toDateString();
    
    // Only show date separator if it's different from previous message's date
    // and the current message has a valid timestamp
    return currentDate !== prevDate && message.timestamp;
  };

  // Clean up typing timeout on unmount or when chat changes
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Ensure typing status is cleared when component unmounts or chat changes
      setTypingStatus(false);
    };
  }, [setTypingStatus, currentChat?.id]);

  // Handle loading more messages with fixed behavior
  const handleLoadMore = () => {
    if (isLoadingMore || !loadMoreMessages || !isAtTop) return;
    
    setIsLoadingMore(true);
    
    // Store the current first visible message and its position
    // We'll use this as a reference point after loading more messages
    const oldestVisibleMessageElement = Array.from(
      document.querySelectorAll(`[id^="msg-"]`)
    ).find(el => {
      const rect = el.getBoundingClientRect();
      // Check if the element is visible in the viewport
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    
    // Get the ID of this message if we found one
    const oldestVisibleMessageId = oldestVisibleMessageElement ? 
      oldestVisibleMessageElement.id.replace('msg-', '') : null;
    
    // IMPORTANT FIX: Set a flag to keep the "at top" state while loading more
    // This prevents messages from disappearing when scrolling down from top
    const wasAtTop = isAtTop;
    
    // Add a slight delay to show the loading animation
    setTimeout(() => {
      // Load more messages
      loadMoreMessages(20).then((hasMore) => {
        // If no more messages to load, mark that we've reached the top
        if (!hasMore) {
          setReachedTop(true);
        }
        
        // Short delay to ensure DOM updates
        setTimeout(() => {
          if (messageListRef.current) {
            // IMPORTANT FIX: Only reset the isAtTop state after messages have loaded
            // and we're no longer at the top of the scroll container
            if (wasAtTop && messageListRef.current.scrollTop > 100) {
              setIsAtTop(false);
            }
            
            // Reset the notification indicator since these are old messages
            setNewMessageReceived(false);
            
            // If we identified a visible message before loading, scroll to keep it visible
            if (oldestVisibleMessageId) {
              const messageElement = document.getElementById(`msg-${oldestVisibleMessageId}`);
              if (messageElement) {
                // Scroll to position the element roughly where it was before
                messageElement.scrollIntoView({ block: 'center' });
              }
            } else {
              // If we couldn't identify a message, just scroll to a reasonable position
              // About 1/3 of the way from the top
              const scrollHeight = messageListRef.current.scrollHeight;
              messageListRef.current.scrollTop = scrollHeight / 3;
            }
            
            // Delay turning off loading state for smooth transition
            setTimeout(() => {
              setIsLoadingMore(false);
            }, 300); // Reduced timeout for smoother experience
          }
        }, 200); // Reduced timeout for smoother experience
      }).catch(error => {
        console.error("Error loading more messages:", error);
        setIsLoadingMore(false);
      });
    }, 300); // Reduced timeout for smoother experience
  };

  // Function to render the scroll button with notification indicator only for actual new messages
  const renderScrollButton = () => {
    if (!showScrollButton) return null;
    
    return (
      <button 
        type="button"
        className={`${styles.scrollButton} ${newMessageReceived ? styles.bounce : ''} ${buttonFading ? styles.fadeOut : ''}`} 
        onClick={() => {
          // Directly mark messages as read when button is clicked
          if (currentChat?.id) {
            markChatAsRead(currentChat.id);
          }
          scrollToBottom(true);
        }}
        aria-label="Scroll to bottom"
      >
        <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor" strokeWidth="0">
          <path d="M12 17.5l-6-6 1.4-1.4 4.6 4.6 4.6-4.6L18 11.5z" />
        </svg>
        {/* Only show notification indicator for actual new messages */}
        {newMessageReceived && <span className={styles.newMessageIndicator}></span>}
      </button>
    );
  };

  // Key helper function to maintain loaded messages properly
  const getUniqueCachedMessages = () => {
    if (!messages || messages.length === 0) return [];
    
    // Use a Map to ensure each message is only included once based on ID
    const messageMap = new Map();
    
    // Add all current messages to the map
    messages.forEach(message => {
      if (message.id) {
        messageMap.set(message.id, message);
      }
    });
    
    // IMPORTANT FIX: Only re-sort messages when necessary, and maintain a stable order
    // to prevent jumping and disappearing content when scrolling
    const sortedMessages = Array.from(messageMap.values())
      .sort((a, b) => {
        const aTime = a.timestamp || 0;
        const bTime = b.timestamp || 0;
        return aTime - bTime;
      });
    
    return sortedMessages;
  };

  if (!currentChat) {
    return (
      <div className={styles.emptyChatArea}>
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2>Welcome to Your Chat Space</h2>
          <p>Start a conversation by selecting a chat or create a new group</p>
          <div className={styles.emptyStateFeatures}>
            <div className={styles.feature}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Create Groups</span>
            </div>
            <div className={styles.feature}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>Real-time Chat</span>
            </div>
            <div className={styles.feature}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Instant Notifications</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only show skeleton loader during initial load, not every time we switch chats
  if (loading && !currentChat?.id) {
    return <ChatAreaSkeleton />;
  }

  // Show skeleton when we're loading messages for a particular chat
  if (messagesLoading && messages.length === 0) {
    return <ChatAreaSkeleton />;
  }

  // Get the messages to display, ensuring stability during scrolling
  const displayMessages = getUniqueCachedMessages();
  const hasMessages = displayMessages.length > 0;

  return (
    <div className={styles.chatArea}>
      <div className={styles.header}>
        <div className={styles.chatInfo}>
          <h2>{currentChat.name}</h2>
          <span className={styles.subtitle}>
            {currentChat.type === 'group' ? 'Group' : 'Direct Message'}
          </span>
        </div>
      </div>

      <div 
        className={styles.messageList} 
        ref={messageListRef} 
        onScroll={handleScroll}
      >
        {/* Load more messages button or loading spinner - 
          * Only show when:
          * 1. User is at the top of the list
          * 2. We haven't reached the top of all messages
          * 3. hasMoreMessages is true or we're currently loading
          * 4. We're not currently sending a message
          * 5. We're not scrolling to bottom
          */}
        {isAtTop && 
          !reachedTop && 
          (hasMoreMessages || isLoadingMore) && 
          !recentlySentMessageRef.current && 
          !isScrollingToBottomRef.current && (
          <div className={styles.loadMoreContainer}>
            {isLoadingMore ? (
              <div className={styles.loadingIndicator}>
                <div className={styles.loadingSpinner}></div>
                <span>Loading older messages...</span>
              </div>
            ) : (
              <button 
                className={styles.loadMoreButton}
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 13l5-5 5 5"></path>
                </svg>
                <span>Load more messages</span>
              </button>
            )}
          </div>
        )}
        
        {/* IMPORTANT FIX: Only attempt to render messages if we have data to prevent flickering */}
        {hasMessages ? (
          displayMessages.map((message, index, messageArray) => (
            <React.Fragment key={message.id}>
              {shouldShowDate(message, index, messageArray) && (
                <div className={styles.dateSeparator}>
                  <span>{formatDate(message.timestamp)}</span>
                </div>
              )}
              <div 
                id={`msg-${message.id}`}  
                className={`${styles.message} ${
                  message.type === 'poll' ? styles.pollMessage :
                  message.type === 'announcement' ? styles.announcementMessage : 
                  message.type === 'file' ? (message.sender === user?.uid ? `${styles.fileMessageContainer} ${styles.sent}` : `${styles.fileMessageContainer} ${styles.received}`) :
                  message.sender === user?.uid ? styles.sent : styles.received
                }`}
              >
                {message.type === 'poll' && (
                  <div className={styles.pollMessage}>
                    <div className={styles.pollHeader}>
                      <div className={styles.pollCreator}>{message.senderName}</div>
                      <div className={styles.timestamp}>{formatTime(message.timestamp)}</div>
                    </div>
                    <div className={styles.pollQuestion}>{message.question}</div>
                    <div className={styles.pollOptions}>
                      {Object.entries(message.options || {}).map(([optionId, option]) => {
                        const votes = Object.keys(option.votes || {}).length;
                        const totalVotes = Object.values(message.options || {})
                          .reduce((sum, opt) => sum + Object.keys(opt.votes || {}).length, 0);
                        const percentage = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                        const hasVoted = option.votes && option.votes[user?.uid];

                        return (
                          <button
                            key={optionId}
                            className={`${styles.pollOption} ${hasVoted ? styles.voted : ''}`}
                            onClick={() => handleVote(message.id, optionId)}
                            disabled={Object.values(message.options || {})
                              .some(opt => opt.votes?.[user?.uid])}
                          >
                            <div className={styles.pollOptionContent}>
                              <span>{option.text}</span>
                              <span className={styles.voteCount}>{votes} votes</span>
                            </div>
                            <div className={styles.pollOptionBar}>
                              <div 
                                className={styles.pollOptionProgress} 
                                style={{ width: `${percentage}%` }} 
                              />
                              <span className={styles.pollOptionPercentage}>{percentage}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className={styles.pollFooter}>
                      Total votes: {Object.values(message.options || {})
                        .reduce((sum, opt) => sum + Object.keys(opt.votes || {}).length, 0)}
                    </div>
                  </div>
                )}
                {message.type === 'announcement' && (
                  <>
                    <div className={styles.sender}>{message.senderName}</div>
                    <div className={styles.content}>{message.content}</div>
                    <div className={styles.timestamp}>
                      {formatTime(message.timestamp)}
                    </div>
                  </>
                )}
                {!message.type && (
                  <React.Fragment>
                    <div 
                      className={styles.bubbleContainer}
                    >
                      <div className={styles.bubble}>
                        {message.sender !== user?.uid && (
                          <div className={styles.senderName}>{message.senderName}</div>
                        )}
                        {message.content}
                        <span className={styles.timestamp}>
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      
                      {/* Add reaction button that appears on hover */}
                      <button 
                        className={styles.addReactionHoverButton}
                        onClick={() => {
                          // Find the MessageReactions component and trigger its panel
                          const reactionsElem = document.querySelector(`[data-message-id="${message.id}"]`);
                          if (reactionsElem) {
                            const event = new CustomEvent('showReactionPanel');
                            reactionsElem.dispatchEvent(event);
                          }
                        }}
                        title="Add reaction"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                        </svg>
                      </button>
                    </div>
                    <MessageReactions message={message} />
                  </React.Fragment>
                )}
                {message.type === 'file' && (
                  <>
                    {message.sender !== user?.uid && (
                      <div className={styles.sender}>{message.senderName}</div>
                    )}
                    {renderFilePreview(message)}
                    <div className={styles.timestamp}>
                      {formatTime(message.timestamp)}
                    </div>
                  </>
                )}
              </div>
            </React.Fragment>
          ))
        ) : messagesLoading ? (
          // Show mini loading indicator if we're waiting for messages but have none to display
          <div className={styles.centerLoading}>
            <div className={styles.loadingSpinner}></div>
          </div>
        ) : null}
        
        {/* Display upload progress for files currently being uploaded */}
        {Object.entries(fileUploads).map(([id, data]) => (
          <div key={id} className={`${styles.message} ${styles.sent} ${styles.uploadingFile}`}>
            <div className={styles.uploadProgress}>
              <div className={styles.fileName}>{data.filename}</div>
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBar} 
                  style={{width: `${data.progress}%`}}
                ></div>
              </div>
              <div className={styles.progressText}>
                {data.error ? 
                  <span className={styles.uploadError}>{data.error}</span> : 
                  `${data.progress}%`
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New messages notification button */}
      {renderScrollButton()}

      {/* Typing indicators placed above the message form */}
      <div className={styles.typingIndicatorContainer}>
        {renderTypingIndicators()}
      </div>

      <form onSubmit={handleSend} className={styles.messageForm}>
        {fileUploadError && (
          <div className={styles.fileError}>
            {fileUploadError}
          </div>
        )}
        <div className={styles.inputContainer}>
        <input
          type="text"
          value={newMessage}
          onChange={handleMessageChange}
          placeholder="Type a message..."
          className={styles.messageInput}
        />
        <button 
          type="button" 
          className={styles.attachButton}
          onClick={handleFileSelect}
          title="Attach file"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
          </svg>
        </button>
        <button type="submit" className={styles.sendButton} title="Send message">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept={ALLOWED_FILE_TYPES.join(',')}
      />
      </form>
    </div>
  );
}