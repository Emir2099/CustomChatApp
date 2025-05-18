---
sidebar_position: 12
---

# Polls Feature

Adding polls to the chat app was one of my favorite features to implement. It gives users a way to quickly gather opinions, make decisions, and boost engagement in group conversations.

## How Polls Work

The polling system follows this basic flow:

1. A user creates a poll with a question and multiple options
2. The poll appears as a special message in the chat
3. Other users can vote on their preferred options
4. Results update in real-time as votes come in
5. The poll creator can close the poll when they're ready

## Poll Data Structure

I designed a specific data structure for polls within the messages collection:

```json
{
  "id": "poll-123456",
  "type": "poll",
  "sender": "userABC",
  "senderName": "Jane Doe",
  "senderPhotoURL": "https://example.com/jane.jpg",
  "timestamp": 1651234567890,
  "question": "Where should we go for lunch?",
  "options": {
    "option1": { "text": "Pizza Place", "votes": 3 },
    "option2": { "text": "Burger Joint", "votes": 1 },
    "option3": { "text": "Salad Bar", "votes": 2 }
  },
  "voters": {
    "user1": "option1",
    "user2": "option1",
    "user3": "option2",
    "user4": "option3",
    "user5": "option1",
    "user6": "option3"
  },
  "isOpen": true,
  "expiresAt": 1651321000000
}
```

## Creating Polls

I implemented a poll creation function in the ChatContext:

```jsx
// In ChatContext.jsx
const createPoll = async (question, options, expirationMinutes = 1440) => {
  if (!currentChat?.id || !user?.uid || !question || !options || options.length < 2) {
    return null;
  }
  
  try {
    const messageRef = push(ref(db, `messages/${currentChat.id}`));
    const messageId = messageRef.key;
    
    // Format options into the expected structure
    const optionsObject = {};
    options.forEach((option, index) => {
      optionsObject[`option${index + 1}`] = {
        text: option,
        votes: 0
      };
    });
    
    // Calculate expiration time (default to 24 hours)
    const expiresAt = Date.now() + (expirationMinutes * 60 * 1000);
    
    const pollMessage = {
      id: messageId,
      type: 'poll',
      sender: user.uid,
      senderName: user.displayName,
      senderPhotoURL: user.photoURL,
      timestamp: serverTimestamp(),
      question,
      options: optionsObject,
      voters: {},
      isOpen: true,
      expiresAt,
      readBy: {
        [user.uid]: serverTimestamp()
      }
    };
    
    await set(messageRef, pollMessage);
    
    // Update last message in chat
    await update(ref(db, `chats/${currentChat.id}`), {
      lastMessage: {
        content: `📊 Poll: ${question}`,
        sender: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      },
      lastMessageTime: serverTimestamp()
    });
    
    return messageId;
  } catch (error) {
    console.error('Error creating poll:', error);
    return null;
  }
};
```

## Poll Creation UI

I built a simple component to let users create polls:

```jsx
// src/components/chat/PollCreator.jsx
import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './PollCreator.module.css';

export default function PollCreator({ onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [expiration, setExpiration] = useState('1440'); // 24 hours in minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { createPoll } = useChat();
  
  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };
  
  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };
  
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate inputs
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    
    // Filter out empty options and check if we have at least 2
    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await createPoll(question, validOptions, parseInt(expiration));
      onClose();
    } catch (err) {
      setError('Failed to create poll: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={styles.pollCreator}>
      <h3>Create a Poll</h3>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="question">Question</label>
          <input
            id="question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            maxLength={200}
            required
          />
        </div>
        
        <div className={styles.formGroup}>
          <label>Options</label>
          {options.map((option, index) => (
            <div key={index} className={styles.optionRow}>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                maxLength={100}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className={styles.removeOption}
                  onClick={() => handleRemoveOption(index)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          
          {options.length < 10 && (
            <button
              type="button"
              className={styles.addOption}
              onClick={handleAddOption}
            >
              + Add Option
            </button>
          )}
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="expiration">Expires after</label>
          <select
            id="expiration"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
          >
            <option value="60">1 hour</option>
            <option value="360">6 hours</option>
            <option value="720">12 hours</option>
            <option value="1440">24 hours</option>
            <option value="4320">3 days</option>
            <option value="10080">7 days</option>
          </select>
        </div>
        
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button
            type="submit"
            className={styles.createButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

## Poll Display Component

For displaying polls in the chat, I created a dedicated component:

```jsx
// src/components/chat/PollMessage.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import styles from './PollMessage.module.css';

export default function PollMessage({ message, chatId }) {
  const { user } = useAuth();
  const { votePoll, closePoll } = useChat();
  
  const [isVoting, setIsVoting] = useState(false);
  
  const {
    question,
    options = {},
    voters = {},
    isOpen,
    expiresAt,
    sender
  } = message;
  
  // Check if poll has expired
  const hasExpired = expiresAt && Date.now() > expiresAt;
  
  // Get the user's vote if they've already voted
  const userVote = voters[user?.uid] || null;
  
  // Calculate total votes
  const totalVotes = Object.values(voters).length;
  
  // Format options with vote counts and percentages
  const formattedOptions = Object.entries(options).map(([key, option]) => {
    const voteCount = Object.values(voters).filter(vote => vote === key).length;
    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
    
    return {
      id: key,
      text: option.text,
      votes: voteCount,
      percentage
    };
  });
  
  // Format time remaining
  const formatTimeRemaining = () => {
    if (!expiresAt || !isOpen) return '';
    
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''} left`;
    }
    
    if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min left`;
    }
    
    return `${minutes} min left`;
  };
  
  // Handle voting
  const handleVote = async (optionId) => {
    if (!isOpen || hasExpired) return;
    
    setIsVoting(true);
    try {
      await votePoll(chatId, message.id, optionId);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };
  
  // Handle closing the poll
  const handleClose = async () => {
    if (!isOpen) return;
    
    try {
      await closePoll(chatId, message.id);
    } catch (error) {
      console.error('Error closing poll:', error);
    }
  };
  
  return (
    <div className={styles.pollMessage}>
      <div className={styles.pollHeader}>
        <h4 className={styles.question}>{question}</h4>
        
        <div className={styles.pollStatus}>
          {!isOpen ? (
            <span className={styles.closed}>Closed</span>
          ) : hasExpired ? (
            <span className={styles.expired}>Expired</span>
          ) : (
            <span className={styles.timeRemaining}>{formatTimeRemaining()}</span>
          )}
        </div>
      </div>
      
      <div className={styles.options}>
        {formattedOptions.map(option => {
          const isSelected = userVote === option.id;
          
          return (
            <button
              key={option.id}
              className={`${styles.option} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleVote(option.id)}
              disabled={!isOpen || hasExpired || isVoting || !!userVote}
            >
              <div className={styles.optionText}>
                {option.text}
                {isSelected && <span className={styles.checkmark}>✓</span>}
              </div>
              
              <div className={styles.voteBar}>
                <div 
                  className={styles.voteBarFill}
                  style={{ width: `${option.percentage}%` }}
                />
              </div>
              
              <div className={styles.voteInfo}>
                <span className={styles.votePercentage}>{option.percentage}%</span>
                <span className={styles.voteCount}>
                  {option.votes} vote{option.votes !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      
      <div className={styles.pollFooter}>
        <span className={styles.totalVotes}>
          {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        </span>
        
        {isOpen && !hasExpired && sender === user?.uid && (
          <button 
            onClick={handleClose}
            className={styles.closeButton}
          >
            Close Poll
          </button>
        )}
      </div>
    </div>
  );
}
```

## Voting and Closing Polls

I added these crucial functions to the ChatContext:

```jsx
// In ChatContext.jsx
// Vote on a poll
const votePoll = async (chatId, pollId, optionId) => {
  if (!chatId || !pollId || !optionId || !user?.uid) return;
  
  try {
    // Get the current poll data
    const pollRef = ref(db, `messages/${chatId}/${pollId}`);
    const snapshot = await get(pollRef);
    
    if (!snapshot.exists()) {
      throw new Error('Poll not found');
    }
    
    const pollData = snapshot.val();
    
    // Check if the poll is still open
    if (!pollData.isOpen) {
      throw new Error('This poll is closed');
    }
    
    // Check if the poll has expired
    if (pollData.expiresAt && pollData.expiresAt < Date.now()) {
      // Auto-close the poll
      await update(pollRef, { isOpen: false });
      throw new Error('This poll has expired');
    }
    
    // Record the user's vote
    await update(pollRef, {
      [`voters/${user.uid}`]: optionId
    });
    
    return true;
  } catch (error) {
    console.error('Error voting on poll:', error);
    return false;
  }
};

// Close a poll
const closePoll = async (chatId, pollId) => {
  if (!chatId || !pollId || !user?.uid) return;
  
  try {
    // Get the poll data
    const pollRef = ref(db, `messages/${chatId}/${pollId}`);
    const snapshot = await get(pollRef);
    
    if (!snapshot.exists()) {
      throw new Error('Poll not found');
    }
    
    const pollData = snapshot.val();
    
    // Check if the user is authorized to close the poll
    if (pollData.sender !== user.uid && !isCurrentUserAdmin()) {
      throw new Error('You cannot close this poll');
    }
    
    // Close the poll
    await update(pollRef, { isOpen: false });
    
    return true;
  } catch (error) {
    console.error('Error closing poll:', error);
    return false;
  }
};
```

## Integration with MessageInput

I added a poll button to the message input component:

```jsx
// In MessageInput.jsx
const [showPollCreator, setShowPollCreator] = useState(false);

// In the JSX part
<div className={styles.messageInputContainer}>
  {/* Other input elements */}
  
  <button
    type="button"
    className={styles.pollButton}
    onClick={() => setShowPollCreator(true)}
    aria-label="Create poll"
  >
    📊
  </button>
  
  {showPollCreator && (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <PollCreator onClose={() => setShowPollCreator(false)} />
      </div>
    </div>
  )}
</div>
```

## Auto-expiring Polls

To handle expired polls, I set up a background process:

```jsx
// In ChatArea.jsx
// Check for expired polls periodically
useEffect(() => {
  const checkExpiredPolls = async () => {
    if (!messages.length || !currentChat?.id) return;
    
    const now = Date.now();
    const updates = {};
    
    const expiredPolls = messages.filter(msg => 
      msg.type === 'poll' && 
      msg.isOpen && 
      msg.expiresAt && 
      msg.expiresAt < now
    );
    
    for (const poll of expiredPolls) {
      updates[`messages/${currentChat.id}/${poll.id}/isOpen`] = false;
    }
    
    if (Object.keys(updates).length > 0) {
      try {
        await update(ref(db), updates);
      } catch (error) {
        console.error('Error updating expired polls:', error);
      }
    }
  };
  
  // Check when component mounts
  checkExpiredPolls();
  
  // Set up interval to check every minute
  const interval = setInterval(checkExpiredPolls, 60000);
  
  return () => clearInterval(interval);
}, [messages, currentChat?.id]);
```

## Technical Challenges

### Real-time Updates

Getting real-time updates for polls was crucial for a good user experience:

```jsx
// In ChatContext.jsx - Handling poll updates in the message listener
useEffect(() => {
  if (!currentChat?.id) return;
  
  const messagesRef = ref(db, `messages/${currentChat.id}`);
  
  // Listen for all message changes
  const unsubscribe = onChildChanged(messagesRef, (snapshot) => {
    const updatedMessage = {
      id: snapshot.key,
      ...snapshot.val()
    };
    
    // Update the message in our local state
    setMessages(prev => 
      prev.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      )
    );
  });
  
  return () => unsubscribe();
}, [currentChat?.id]);
```

### Race Conditions

I had to be careful with race conditions when multiple users vote at the same time:

```jsx
// In ChatContext.jsx - Using transactions to prevent race conditions
const votePoll = async (chatId, pollId, optionId) => {
  // ... other code
  
  try {
    const pollRef = ref(db, `messages/${chatId}/${pollId}`);
    
    // Use a transaction to handle concurrent votes
    await runTransaction(pollRef, (currentPoll) => {
      if (!currentPoll) return null; // Abort if poll doesn't exist
      
      // Check if poll is still open
      if (!currentPoll.isOpen || 
          (currentPoll.expiresAt && currentPoll.expiresAt < Date.now())) {
        return currentPoll; // Don't modify, just return current value
      }
      
      // Initialize voters object if it doesn't exist
      if (!currentPoll.voters) {
        currentPoll.voters = {};
      }
      
      // Record the user's vote
      currentPoll.voters[user.uid] = optionId;
      
      return currentPoll;
    });
    
    return true;
  } catch (error) {
    console.error('Error voting on poll:', error);
    return false;
  }
};
```

### UI Design Challenges

Creating a mobile-friendly poll UI was tricky:

```css
/* PollMessage.module.css */
.pollMessage {
  width: 100%;
  max-width: 500px;
  background-color: #f5f8ff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

/* Make sure the poll is usable on mobile */
@media (max-width: 576px) {
  .pollMessage {
    width: 100%;
    max-width: none;
  }
  
  .option {
    padding: 8px;
  }
  
  .voteInfo {
    font-size: 12px;
  }
}
```

## Future Improvements

If I had more time to work on the polling feature, I'd add:

1. **Multiple Choice** - Allow users to vote for multiple options
2. **Poll Templates** - Quick templates for common poll types
3. **Image Options** - Add images to poll options
4. **Vote Tracking** - Show who voted for what (for admins only)
5. **Poll Analytics** - More detailed statistics about voting patterns
6. **Poll Sharing** - Ability to share polls in other chats

Overall, the polls feature has been one of the most popular additions to the chat app. It makes group decision-making much easier and adds an interactive element to conversations. 