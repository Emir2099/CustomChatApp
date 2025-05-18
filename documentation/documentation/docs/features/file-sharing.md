---
sidebar_position: 6
---

# File Sharing Feature

Adding file sharing to the chat app was a big priority for me. Text-only chats are limiting, and I wanted users to be able to share images, documents, and other files easily.

## How File Sharing Works

I built the file sharing system to handle both images and documents. Here's the basic flow of how it works:

1. User selects a file through the UI
2. File is validated (size, type)
3. File is converted to base64 for storage
4. File is uploaded to Firebase with progress tracking
5. Message with file reference is created in the chat

## File Upload Implementation

The core of the file sharing functionality is in the `sendFileMessage` function in ChatContext:

```jsx
// In ChatContext.jsx
const sendFileMessage = async (file, progressCallback = () => {}, replyToId = null) => {
  if (!currentChat?.id || !user?.uid || !file) return;
  
  // Check file size
  if (file.size > FILE_SIZE_LIMIT) {
    throw new Error(`File size exceeds limit (${FILE_SIZE_LIMIT / (1024 * 1024)}MB)`);
  }
  
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} not allowed`);
  }
  
  // Generate a unique ID for this upload
  const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to uploads state for tracking
  setFileUploads(prev => ({
    ...prev,
    [uploadId]: { progress: 0, fileName: file.name }
  }));
  
  try {
    // Convert file to base64
    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 50); // First 50%
        setFileUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress }
        }));
        progressCallback(progress);
      }
    };
    
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    
    // Create message
    const messageRef = push(ref(db, `messages/${currentChat.id}`));
    const messageId = messageRef.key;
    
    const fileCategory = file.type.startsWith('image/') ? 'image' : 'document';
    
    const message = {
      id: messageId,
      type: 'file',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileCategory: fileCategory,
      fileData: base64,
      sender: user.uid,
      senderName: user.displayName,
      senderPhotoURL: user.photoURL,
      timestamp: serverTimestamp(),
      readBy: {
        [user.uid]: serverTimestamp()
      },
      replyTo: replyToId
    };
    
    // Update upload progress (50% - starting DB upload)
    setFileUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], progress: 50 }
    }));
    progressCallback(50);
    
    // Send to Firebase
    await set(messageRef, message);
    
    // Update last message in chat
    await update(ref(db, `chats/${currentChat.id}`), {
      lastMessage: {
        content: file.type.startsWith('image/') 
          ? '📷 Image' 
          : `📄 File: ${file.name}`,
        sender: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      },
      lastMessageTime: serverTimestamp()
    });
    
    // Finish upload
    setFileUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], progress: 100 }
    }));
    progressCallback(100);
    
    // Remove from uploads after a delay
    setTimeout(() => {
      setFileUploads(prev => {
        const newUploads = { ...prev };
        delete newUploads[uploadId];
        return newUploads;
      });
    }, 3000);
    
    return messageId;
  } catch (error) {
    console.error('Error sending file:', error);
    
    // Update uploads state to show error
    setFileUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], error: error.message }
    }));
    
    throw error;
  }
};
```

## File Viewer Component

I created a dedicated FileMessage component to display different types of files:

```jsx
// src/components/chat/FileMessage.jsx
function FileMessage({ message }) {
  const { fileName, fileType, fileSize, fileData, fileCategory } = message;
  
  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  if (fileCategory === 'image') {
    return (
      <div className={styles.imageContainer}>
        <img 
          src={fileData} 
          alt={fileName} 
          className={styles.imagePreview}
          loading="lazy"
        />
        <div className={styles.imageCaption}>
          <span>{fileName}</span>
          <span>{formatSize(fileSize)}</span>
        </div>
      </div>
    );
  } else {
    // Document file
    return (
      <div className={styles.fileContainer}>
        <div className={styles.fileIcon}>
          {fileType.includes('pdf') ? '📄' : 
           fileType.includes('word') ? '📝' : 
           fileType.includes('sheet') ? '📊' : '📎'}
        </div>
        
        <div className={styles.fileInfo}>
          <div className={styles.fileName}>{fileName}</div>
          <div className={styles.fileSize}>{formatSize(fileSize)}</div>
        </div>
        
        <a 
          href={fileData}
          download={fileName}
          className={styles.downloadButton}
          target="_blank"
          rel="noopener noreferrer"
        >
          ⬇️
        </a>
      </div>
    );
  }
}
```

## Upload Progress Indicator

I wanted to give users feedback during file uploads, so I created a progress component:

```jsx
// src/components/chat/FileUploadProgress.jsx
function FileUploadProgress({ upload }) {
  const { progress, fileName, error } = upload;
  
  return (
    <div className={styles.uploadContainer}>
      <div className={styles.uploadInfo}>
        <div className={styles.uploadFileName}>{fileName}</div>
        {error ? (
          <div className={styles.uploadError}>
            Upload failed: {error}
          </div>
        ) : (
          <div className={styles.progressBarOuter}>
            <div 
              className={styles.progressBarInner} 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      <div className={styles.uploadPercentage}>
        {error ? '❌' : `${progress}%`}
      </div>
    </div>
  );
}
```

## File Upload UI

For the user interface, I made a simple but effective file upload component:

```jsx
// In MessageInput.jsx
const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    await sendFileMessage(file, (progress) => {
      console.log(`Upload progress: ${progress}%`);
    });
    
    // Reset file input
    e.target.value = '';
  } catch (error) {
    console.error('Error uploading file:', error);
    // Show error toast/notification
  }
};

// In the JSX
<div className={styles.messageInputContainer}>
  {/* Other input elements */}
  
  <button
    type="button"
    className={styles.attachButton}
    onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
    aria-label="Attach file"
  >
    📎
  </button>
  
  {isFileMenuOpen && (
    <div className={styles.fileMenu}>
      <label className={styles.fileOption}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        📷 Image
      </label>
      
      <label className={styles.fileOption}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        📄 Document
      </label>
    </div>
  )}
</div>
```

## File Limitations & Validation

I set some restrictions on file uploads to keep things manageable:

```jsx
// In ChatContext.jsx
const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 
  'image/png', 
  'image/gif', 
  'application/pdf', 
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
```

## Technical Challenges

### Base64 Encoding

One of the biggest challenges was deciding how to store files. I initially considered using Firebase Storage, but I ended up using base64 encoding directly in the database for a couple of reasons:

1. Simplicity - no need to manage references between Storage and Database
2. Offline access - files are available immediately with the messages
3. No separate authentication needed for file access

The downside is size limitations, which is why I capped file size at 5MB.

```jsx
// Converting file to base64
const base64 = await new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});
```

### Progress Tracking

Tracking upload progress was tricky because there are two phases:
1. Reading the file into memory (0-50%)
2. Uploading to Firebase (50-100%)

I split the progress tracking between these phases:

```jsx
// Phase 1: Reading file
reader.onprogress = (e) => {
  if (e.lengthComputable) {
    const progress = Math.round((e.loaded / e.total) * 50); // First 50%
    setFileUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], progress }
    }));
  }
};

// Phase 2: After reading, before Firebase upload
setFileUploads(prev => ({
  ...prev,
  [uploadId]: { ...prev[uploadId], progress: 50 }
}));

// After successful Firebase upload
setFileUploads(prev => ({
  ...prev,
  [uploadId]: { ...prev[uploadId], progress: 100 }
}));
```

### Image Previews

Getting image previews to work nicely was another challenge, especially with different aspect ratios and sizes:

```css
/* FileMessage.module.css */
.imagePreview {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  object-fit: contain;
}

.imageContainer {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.imageCaption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  display: flex;
  justify-content: space-between;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.imageContainer:hover .imageCaption {
  opacity: 1;
}
```

## Future Improvements

If I had more time, I would enhance the file sharing feature with:

1. **Firebase Storage Integration** - For larger files and better scaling
2. **Image Compression** - Automatically resize/compress images before upload
3. **Preview Generation** - Generate thumbnails for documents
4. **File Organization** - Allow users to browse shared files by type or date
5. **Drag and Drop Support** - For easier file uploads

I'm pretty happy with how the file sharing turned out - it's simple but effective. Users can quickly share images and documents without leaving the chat interface, which was my main goal. 