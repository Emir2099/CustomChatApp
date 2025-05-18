---
sidebar_position: 14
---

# Media Embedding Controls

I wanted chat admins to have control over how external media is handled in conversations. Some media can be resource-intensive or inappropriate, so I built admin controls to manage what gets embedded.

## How Media Embedding Works

When a user sends a link to external content (images, videos, tweets, etc.), my app can either:

1. Simply display the link as text
2. Automatically embed rich previews of the content
3. Let admins review and approve embeds 

## Admin Configuration

I created a simple but powerful settings panel for chat admins:

```jsx
// src/components/chat/ChatSettings.jsx - Media embedding section
function MediaEmbeddingSettings() {
  const [settings, setSettings] = useState({
    allowImageEmbeds: true,
    allowVideoEmbeds: false,
    allowSocialEmbeds: false,
    requireApproval: true,
    maxEmbedSize: 2 // in MB
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { currentChat, updateChatSettings } = useChat();
  
  // Load current settings when component mounts
  useEffect(() => {
    if (!currentChat?.id) return;
    
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const chatRef = ref(db, `chats/${currentChat.id}`);
        const snapshot = await get(chatRef);
        
        if (snapshot.exists()) {
          const chatData = snapshot.val();
          if (chatData.embedSettings) {
            setSettings({
              allowImageEmbeds: chatData.embedSettings.allowImageEmbeds ?? true,
              allowVideoEmbeds: chatData.embedSettings.allowVideoEmbeds ?? false,
              allowSocialEmbeds: chatData.embedSettings.allowSocialEmbeds ?? false,
              requireApproval: chatData.embedSettings.requireApproval ?? true,
              maxEmbedSize: chatData.embedSettings.maxEmbedSize ?? 2
            });
          }
        }
      } catch (err) {
        console.error('Error loading embed settings:', err);
        setError('Failed to load embed settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [currentChat?.id]);
  
  const handleSave = async () => {
    try {
      await updateChatSettings({
        embedSettings: settings
      });
      
      // Show success message
    } catch (err) {
      // Show error message
      console.error('Error saving embed settings:', err);
    }
  };
  
  return (
    <div className={styles.settingsSection}>
      <h3>Media Embedding</h3>
      
      {isLoading ? (
        <div>Loading settings...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}>
          <div className={styles.checkboxSetting}>
            <input
              type="checkbox"
              id="allowImageEmbeds"
              checked={settings.allowImageEmbeds}
              onChange={(e) => setSettings({
                ...settings,
                allowImageEmbeds: e.target.checked
              })}
            />
            <label htmlFor="allowImageEmbeds">
              Allow image embeds
            </label>
          </div>
          
          <div className={styles.checkboxSetting}>
            <input
              type="checkbox"
              id="allowVideoEmbeds"
              checked={settings.allowVideoEmbeds}
              onChange={(e) => setSettings({
                ...settings,
                allowVideoEmbeds: e.target.checked
              })}
            />
            <label htmlFor="allowVideoEmbeds">
              Allow video embeds
            </label>
          </div>
          
          <div className={styles.checkboxSetting}>
            <input
              type="checkbox"
              id="allowSocialEmbeds"
              checked={settings.allowSocialEmbeds}
              onChange={(e) => setSettings({
                ...settings,
                allowSocialEmbeds: e.target.checked
              })}
            />
            <label htmlFor="allowSocialEmbeds">
              Allow social media embeds
            </label>
          </div>
          
          <div className={styles.checkboxSetting}>
            <input
              type="checkbox"
              id="requireApproval"
              checked={settings.requireApproval}
              onChange={(e) => setSettings({
                ...settings,
                requireApproval: e.target.checked
              })}
            />
            <label htmlFor="requireApproval">
              Require admin approval for embeds
            </label>
          </div>
          
          <div className={styles.sliderSetting}>
            <label htmlFor="maxEmbedSize">
              Maximum embed size: {settings.maxEmbedSize} MB
            </label>
            <input
              type="range"
              id="maxEmbedSize"
              min="1"
              max="10"
              step="1"
              value={settings.maxEmbedSize}
              onChange={(e) => setSettings({
                ...settings,
                maxEmbedSize: parseInt(e.target.value)
              })}
            />
          </div>
          
          <button 
            type="submit"
            className={styles.saveButton}
          >
            Save Settings
          </button>
        </form>
      )}
    </div>
  );
}
```

## Link Detection and Processing

When a user sends a message, I scan it for URLs that might contain embeddable content:

```jsx
// In ChatContext.jsx
const processMessage = async (message) => {
  // Skip processing for non-text messages
  if (message.type !== 'text' || !message.content) return message;
  
  // Get chat embed settings
  const chatRef = ref(db, `chats/${message.chatId}`);
  const chatSnapshot = await get(chatRef);
  
  if (!chatSnapshot.exists()) return message;
  
  const chatData = chatSnapshot.val();
  const embedSettings = chatData.embedSettings || {
    allowImageEmbeds: true,
    allowVideoEmbeds: false,
    allowSocialEmbeds: false,
    requireApproval: true,
    maxEmbedSize: 2
  };
  
  // Skip embed processing if all embeds are disabled
  if (!embedSettings.allowImageEmbeds && 
      !embedSettings.allowVideoEmbeds &&
      !embedSettings.allowSocialEmbeds) {
    return message;
  }
  
  // Extract URLs from message content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.content.match(urlRegex) || [];
  
  if (urls.length === 0) return message;
  
  // Process the first URL only (to keep things simpler)
  const url = urls[0];
  let embedInfo = null;
  
  try {
    // Try to get OG tags and content type
    embedInfo = await fetchUrlMetadata(url);
    
    // Only proceed if we have valid embed info
    if (embedInfo) {
      // Determine embed type
      const isImage = embedInfo.contentType?.startsWith('image/');
      const isVideo = embedInfo.contentType?.startsWith('video/');
      const isSocial = embedInfo.siteName?.toLowerCase().includes('twitter') ||
                       embedInfo.siteName?.toLowerCase().includes('facebook') ||
                       embedInfo.siteName?.toLowerCase().includes('instagram');
      
      // Check if this type of embed is allowed
      const isAllowed = 
        (isImage && embedSettings.allowImageEmbeds) ||
        (isVideo && embedSettings.allowVideoEmbeds) ||
        (isSocial && embedSettings.allowSocialEmbeds);
      
      if (isAllowed) {
        // Add embed info to message
        message.embed = {
          ...embedInfo,
          approved: !embedSettings.requireApproval // Auto-approve if not required
        };
      }
    }
  } catch (error) {
    console.error('Error processing URL for embeds:', error);
  }
  
  return message;
};
```

## Embed Approval System

For chats where admin approval is required, I built an approval workflow:

```jsx
// In ChatContext.jsx
const approveEmbed = async (chatId, messageId) => {
  if (!chatId || !messageId || !isCurrentUserAdmin()) return false;
  
  try {
    const messageRef = ref(db, `messages/${chatId}/${messageId}`);
    
    await update(messageRef, {
      'embed.approved': true
    });
    
    return true;
  } catch (error) {
    console.error('Error approving embed:', error);
    return false;
  }
};

const rejectEmbed = async (chatId, messageId) => {
  if (!chatId || !messageId || !isCurrentUserAdmin()) return false;
  
  try {
    const messageRef = ref(db, `messages/${chatId}/${messageId}`);
    
    // Remove the embed altogether
    await update(messageRef, {
      embed: null
    });
    
    return true;
  } catch (error) {
    console.error('Error rejecting embed:', error);
    return false;
  }
};
```

## Displaying Embeds

Messages with embeds are rendered differently based on their status:

```jsx
// In MessageItem.jsx
function renderEmbed() {
  if (!message.embed) return null;
  
  // Don't show unapproved embeds to non-admins
  if (!message.embed.approved && !isCurrentUserAdmin()) return null;
  
  // For admins, show approval UI if not yet approved
  if (!message.embed.approved && isCurrentUserAdmin()) {
    return (
      <div className={styles.embedPendingApproval}>
        <div className={styles.embedInfo}>
          <div className={styles.embedTitle}>{message.embed.title || 'Untitled'}</div>
          <div className={styles.embedDescription}>{message.embed.description || 'No description'}</div>
          <div className={styles.embedUrl}>{message.embed.url}</div>
        </div>
        
        <div className={styles.approvalActions}>
          <button 
            onClick={() => approveEmbed(currentChat.id, message.id)}
            className={styles.approveButton}
          >
            Approve
          </button>
          <button 
            onClick={() => rejectEmbed(currentChat.id, message.id)}
            className={styles.rejectButton}
          >
            Reject
          </button>
        </div>
      </div>
    );
  }
  
  // Approved embeds for everyone
  if (message.embed.contentType?.startsWith('image/')) {
    return (
      <div className={styles.imageEmbed}>
        <img 
          src={message.embed.url} 
          alt={message.embed.title || 'Image'} 
          className={styles.embedImage}
          onClick={() => openLightbox(message.embed.url)}
        />
      </div>
    );
  }
  
  if (message.embed.contentType?.startsWith('video/')) {
    return (
      <div className={styles.videoEmbed}>
        <video 
          src={message.embed.url}
          controls
          className={styles.embedVideo}
        />
      </div>
    );
  }
  
  // Generic rich embed
  return (
    <a 
      href={message.embed.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={styles.richEmbed}
    >
      {message.embed.image && (
        <div className={styles.embedImagePreview}>
          <img 
            src={message.embed.image} 
            alt=""
            className={styles.embedThumbnail} 
          />
        </div>
      )}
      
      <div className={styles.embedContent}>
        <div className={styles.embedTitle}>{message.embed.title || 'Untitled'}</div>
        <div className={styles.embedDescription}>{message.embed.description || message.embed.url}</div>
        {message.embed.siteName && (
          <div className={styles.embedSiteName}>{message.embed.siteName}</div>
        )}
      </div>
    </a>
  );
}
```

## Metadata Fetching

The heavy lifting is done by the URL metadata service:

```jsx
// src/utils/embedUtils.js
export const fetchUrlMetadata = async (url) => {
  try {
    // For security and efficiency, we use our server-side proxy
    const response = await fetch(`/api/link-metadata?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }
    
    const metadata = await response.json();
    
    return {
      url,
      title: metadata.title,
      description: metadata.description,
      siteName: metadata.siteName,
      image: metadata.image,
      contentType: metadata.contentType,
      size: metadata.size // in bytes
    };
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    return null;
  }
};
```

## Performance Considerations

Media embeds can slow down chat performance, so I implemented some optimizations:

```jsx
// In ChatArea.jsx
// Lazy load embeds when scrolling into view
const observerRef = useRef(null);

useEffect(() => {
  // Set up intersection observer for lazy loading embeds
  if (!observerRef.current) {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const embedContainer = entry.target;
            const embedId = embedContainer.dataset.embedId;
            if (embedId) {
              // Mark embed as visible in state
              setVisibleEmbeds(prev => ({
                ...prev,
                [embedId]: true
              }));
              
              // Stop observing this element
              observerRef.current.unobserve(embedContainer);
            }
          }
        });
      },
      {
        root: messagesContainerRef.current,
        rootMargin: '50px',
        threshold: 0.1
      }
    );
  }
  
  return () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
  };
}, []);

// In the render function
{message.embed && (
  <div 
    className={styles.embedContainer}
    data-embed-id={message.id}
    ref={(el) => {
      if (el && observerRef.current) {
        observerRef.current.observe(el);
      }
    }}
  >
    {visibleEmbeds[message.id] ? renderEmbed(message) : (
      <div className={styles.embedPlaceholder}>
        Loading embed...
      </div>
    )}
  </div>
)}
```

## Technical Challenges

### Security Concerns

Embedding external content can introduce security vulnerabilities. To mitigate this:

1. I sanitize all HTML to prevent XSS attacks
2. I use a Content-Security-Policy that restricts which domains can load embedded resources
3. I add proper `rel="noopener noreferrer"` attributes to external links
4. For untrusted content, I restrict what can be embedded to specific types and domains

```jsx
// In the API route that fetches link metadata
const validateUrl = (url) => {
  try {
    const parsed = new URL(url);
    
    // Check against allowed domains (optional)
    const allowedDomains = [
      'youtube.com', 'youtu.be', 'vimeo.com', 
      'imgur.com', 'giphy.com', 'twitter.com'
    ];
    
    const isDomainAllowed = allowedDomains.some(domain => 
      parsed.hostname === domain || 
      parsed.hostname.endsWith(`.${domain}`)
    );
    
    return {
      isValid: isDomainAllowed,
      domain: parsed.hostname
    };
  } catch (e) {
    return { isValid: false };
  }
};

// Validate URL before fetching metadata
const { isValid, domain } = validateUrl(url);
if (!isValid) {
  res.status(400).json({ error: 'Invalid or disallowed URL' });
  return;
}
```

### Bandwidth Concerns

Embedding can consume a lot of bandwidth, especially in active chats. To address this:

1. I set reasonable size limits for embeds (usually 2-5MB)
2. For images, I generate smaller preview thumbnails
3. I don't auto-load videos; they require a user interaction to play

## Future Improvements

I have several ideas to improve the embedding system in the future:

1. **Custom Embed Templates** - Let admins create custom embed designs for specific domains
2. **Embed Analytics** - Track which embeds get the most interaction
3. **Better Content Type Detection** - Improve the accuracy of content type detection
4. **More Granular Controls** - Allow admins to whitelist/blacklist specific domains
5. **Inline Preview** - Add an optional preview mode that doesn't require clicking links

The media embedding controls have been really helpful for group chats where different types of content are shared. Admins appreciate having control over what gets embedded, especially in professional or educational contexts. 