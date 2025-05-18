---
sidebar_position: 6
---

# Common Components

When building this chat app, I realized I needed to create several reusable components that would be used throughout the application. Having these common components made development much faster and kept the UI consistent.

## Avatar Component

The Avatar component is probably the most frequently used component in the app. It displays user profile pictures with various sizes and fallback options.

```jsx
// src/components/common/Avatar.jsx
import { useState } from 'react';
import styles from './Avatar.module.css';

export default function Avatar({
  src,
  alt,
  size = 'medium',
  onClick = null,
  showStatus = false,
  isOnline = false,
}) {
  const [imageError, setImageError] = useState(false);
  
  // Generate initials from the alt text (usually the user's name)
  const getInitials = () => {
    if (!alt) return '?';
    
    const parts = alt.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    
    return alt.substring(0, 2).toUpperCase();
  };
  
  // Handle broken image URLs
  const handleError = () => {
    setImageError(true);
  };
  
  const sizeClass = styles[size] || styles.medium;
  
  return (
    <div 
      className={`${styles.avatarWrapper} ${onClick ? styles.clickable : ''}`} 
      onClick={onClick}
    >
      {!imageError && src ? (
        <img
          src={src}
          alt={alt || 'User'}
          className={`${styles.avatar} ${sizeClass}`}
          onError={handleError}
        />
      ) : (
        <div className={`${styles.avatarFallback} ${sizeClass}`}>
          {getInitials()}
        </div>
      )}
      
      {showStatus && (
        <span className={`${styles.status} ${isOnline ? styles.online : styles.offline}`} />
      )}
    </div>
  );
}
```

For styling, I used CSS modules:

```css
/* Avatar.module.css */
.avatarWrapper {
  position: relative;
  display: inline-block;
}

.avatar {
  border-radius: 50%;
  object-fit: cover;
}

.avatarFallback {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #3f51b5;
  color: white;
  font-weight: 500;
}

.small {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.medium {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.large {
  width: 80px;
  height: 80px;
  font-size: 32px;
}

.clickable {
  cursor: pointer;
}

.status {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
}

.online {
  background-color: #4caf50;
}

.offline {
  background-color: #9e9e9e;
}
```

## OnlineStatus Component

I created a dedicated component for showing user online status with different display options:

```jsx
// src/components/common/OnlineStatus.jsx
import { useState, useEffect } from 'react';
import styles from './OnlineStatus.module.css';

export default function OnlineStatus({ 
  isOnline, 
  lastSeen = null,
  displayType = 'dot',  // 'dot', 'text', or 'full'
}) {
  const [timeAgo, setTimeAgo] = useState('');
  
  // Update the "time ago" text periodically
  useEffect(() => {
    if (!isOnline && lastSeen) {
      const updateTimeAgo = () => {
        setTimeAgo(formatTimeAgo(lastSeen));
      };
      
      updateTimeAgo();
      const interval = setInterval(updateTimeAgo, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [isOnline, lastSeen]);
  
  // Format the timestamp to a friendly "time ago" string
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(timestamp);
    const diffInMs = now - lastSeenDate;
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return lastSeenDate.toLocaleDateString();
  };
  
  // Show just the status dot
  if (displayType === 'dot') {
    return (
      <span className={`${styles.statusDot} ${isOnline ? styles.online : styles.offline}`} />
    );
  }
  
  // Show just text
  if (displayType === 'text') {
    return (
      <span className={styles.statusText}>
        {isOnline ? 'Online' : lastSeen ? `Last seen ${timeAgo}` : 'Offline'}
      </span>
    );
  }
  
  // Show full status (both dot and text)
  return (
    <div className={styles.statusContainer}>
      <span className={`${styles.statusDot} ${isOnline ? styles.online : styles.offline}`} />
      <span className={styles.statusText}>
        {isOnline ? 'Online' : lastSeen ? `Last seen ${timeAgo}` : 'Offline'}
      </span>
    </div>
  );
}
```

## Modal Components

I built a reusable modal system that I use throughout the app:

```jsx
// src/components/common/Modal.jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export default function Modal({
  isOpen,
  onClose,
  children,
  title = '',
  size = 'medium', // 'small', 'medium', 'large', 'full'
}) {
  const modalRef = useRef(null);
  
  // Close on escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto'; // Restore scrolling
    };
  }, [isOpen, onClose]);
  
  // Close when clicking outside the modal
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };
  
  // Don't render anything if the modal is closed
  if (!isOpen) return null;
  
  // Use React Portal to render the modal outside the normal DOM hierarchy
  return createPortal(
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div 
        ref={modalRef}
        className={`${styles.modalContent} ${styles[size] || styles.medium}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {title && (
          <div className={styles.modalHeader}>
            <h3 id="modal-title" className={styles.modalTitle}>{title}</h3>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

I also created some specialized modal variants:

```jsx
// src/components/common/ConfirmDialog.jsx
import Modal from './Modal';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // 'default', 'danger', 'warning'
}) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className={styles.confirmDialog}>
        <p className={styles.message}>{message}</p>
        
        <div className={styles.actions}>
          <button 
            className={styles.cancelButton} 
            onClick={onClose}
          >
            {cancelText}
          </button>
          
          <button 
            className={`${styles.confirmButton} ${styles[variant]}`} 
            onClick={handleConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

## Button Components

I created some custom button components to maintain consistent styling across the app:

```jsx
// src/components/common/Button.jsx
import styles from './Button.module.css';

export default function Button({
  children,
  onClick,
  variant = 'primary', // 'primary', 'secondary', 'danger', 'text'
  size = 'medium',     // 'small', 'medium', 'large'
  fullWidth = false,
  disabled = false,
  type = 'button',
  icon = null,
  isLoading = false,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        ${styles.button}
        ${styles[variant]}
        ${styles[size]}
        ${fullWidth ? styles.fullWidth : ''}
        ${icon && !children ? styles.iconOnly : ''}
        ${isLoading ? styles.loading : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading && <span className={styles.spinner}></span>}
      {icon && <span className={styles.icon}>{icon}</span>}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}
```

I also made an IconButton variant:

```jsx
// src/components/common/IconButton.jsx
import styles from './IconButton.module.css';

export default function IconButton({
  icon,
  onClick,
  ariaLabel,
  tooltip = '',
  size = 'medium',
  variant = 'default', // 'default', 'primary', 'danger'
  disabled = false,
  ...props
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        ${styles.iconButton}
        ${styles[size]}
        ${styles[variant]}
      `}
      aria-label={ariaLabel}
      title={tooltip}
      {...props}
    >
      {icon}
    </button>
  );
}
```

## Tooltip Component

The Tooltip component was a nice enhancement for the UI:

```jsx
// src/components/common/Tooltip.jsx
import { useState, useRef } from 'react';
import styles from './Tooltip.module.css';

export default function Tooltip({
  children,
  content,
  position = 'top', // 'top', 'bottom', 'left', 'right'
  delay = 300,      // Delay in ms before showing tooltip
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);
  
  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };
  
  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };
  
  return (
    <div 
      className={styles.tooltipContainer}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      
      {isVisible && (
        <div className={`${styles.tooltip} ${styles[position]}`}>
          {content}
        </div>
      )}
    </div>
  );
}
```

## Design Considerations

I put a lot of thought into making these components:

1. **Reusability**: Each component accepts props that let it be customized for different use cases
2. **Accessibility**: I added proper ARIA attributes and keyboard navigation
3. **Simplicity**: The components have sensible defaults while allowing customization
4. **Performance**: I optimized components with things like refs and memoization
5. **Flexibility**: Components like Avatar handle error states gracefully

## Usage Examples

Here's how these components are used throughout the app:

```jsx
// Example of using multiple common components together
import Avatar from '../common/Avatar'; 
import OnlineStatus from '../common/OnlineStatus';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Tooltip from '../common/Tooltip';

function UserItem({ user, onSelect }) {
  return (
    <div className={styles.userItem}>
      <Avatar 
        src={user.photoURL} 
        alt={user.displayName} 
        size="medium"
        showStatus={true}
        isOnline={user.isOnline} 
      />
      
      <div className={styles.userInfo}>
        <span className={styles.userName}>{user.displayName}</span>
        <OnlineStatus 
          isOnline={user.isOnline} 
          lastSeen={user.lastSeen} 
          displayType="text"
        />
      </div>
      
      <Tooltip content="Start chat">
        <IconButton 
          icon={<MessageIcon />} 
          onClick={() => onSelect(user)} 
          ariaLabel={`Chat with ${user.displayName}`}
        />
      </Tooltip>
      
      <Button 
        variant="primary" 
        size="small" 
        onClick={() => onSelect(user)}
      >
        Message
      </Button>
    </div>
  );
}
```

## Future Improvements

I have a few ideas for improving these components in the future:

1. Add animation variants to the Modal component
2. Create a theme provider to dynamically change component styles
3. Add more button variants for different UI contexts
4. Enhance the Avatar component with image cropping/uploading
5. Create a Toast notification component to complement these components 