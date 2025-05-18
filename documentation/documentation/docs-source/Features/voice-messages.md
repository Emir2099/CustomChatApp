---
sidebar_position: 7
---

# Voice Message Feature

Text is great, but sometimes you need to hear someone's voice. That's why I added voice messages to the chat app - they add a more personal touch and are much quicker than typing out long messages.

## How Voice Messages Work

The voice message system follows this flow:

1. User clicks the microphone button to start recording
2. Audio is recorded using the Web Audio API
3. When finished, the audio is converted to a blob
4. The blob is encoded as base64 and sent to Firebase
5. In the chat, users can play back the voice messages

## Recording Implementation

I implemented the recording functionality using the MediaRecorder API:

```jsx
// src/components/chat/VoiceRecorder.jsx
import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import styles from './VoiceRecorder.module.css';

export default function VoiceRecorder({ onClose, replyToId = null }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  
  const { sendVoiceMessage } = useChat();
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  
  // Set up recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all audio tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      clearInterval(timerRef.current);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);
  
  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  // Send the voice message
  const handleSend = async () => {
    if (!audioBlob) return;
    
    try {
      await sendVoiceMessage(audioBlob, recordingTime, replyToId);
      onClose();
    } catch (error) {
      console.error('Error sending voice message:', error);
    }
  };
  
  // Cancel recording
  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    onClose();
  };
  
  return (
    <div className={styles.voiceRecorder}>
      <div className={styles.header}>
        {isRecording ? 'Recording...' : audioBlob ? 'Preview' : 'Voice Message'}
      </div>
      
      <div className={styles.recordingInfo}>
        {isRecording ? (
          <div className={styles.recordingIndicator}>
            <span className={styles.recordingDot} />
            <span>{formatTime(recordingTime)}</span>
          </div>
        ) : audioBlob ? (
          <audio 
            src={URL.createObjectURL(audioBlob)} 
            controls 
            className={styles.audioPreview}
          />
        ) : (
          <div className={styles.instructions}>
            Press the button to start recording
          </div>
        )}
      </div>
      
      <div className={styles.actions}>
        {isRecording ? (
          <button 
            className={styles.stopButton}
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        ) : audioBlob ? (
          <>
            <button 
              className={styles.cancelButton}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className={styles.sendButton}
              onClick={handleSend}
            >
              Send Voice Message
            </button>
          </>
        ) : (
          <>
            <button 
              className={styles.cancelButton}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className={styles.recordButton}
              onClick={startRecording}
            >
              Start Recording
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

## Sending Voice Messages

In the ChatContext, I added a dedicated function for sending voice messages:

```jsx
// In ChatContext.jsx
const sendVoiceMessage = async (audioBlob, duration, replyToId = null) => {
  if (!currentChat?.id || !user?.uid || !audioBlob) return;
  
  try {
    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(audioBlob);
    });
    
    // Create message
    const messageRef = push(ref(db, `messages/${currentChat.id}`));
    
    const message = {
      id: messageRef.key,
      type: 'voice',
      voiceData: base64,
      duration: duration, // in seconds
      sender: user.uid,
      senderName: user.displayName,
      senderPhotoURL: user.photoURL,
      timestamp: serverTimestamp(),
      readBy: {
        [user.uid]: serverTimestamp()
      },
      replyTo: replyToId
    };
    
    await set(messageRef, message);
    
    // Update last message in chat
    await update(ref(db, `chats/${currentChat.id}`), {
      lastMessage: {
        content: '🎤 Voice message',
        sender: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      },
      lastMessageTime: serverTimestamp()
    });
    
    return messageRef.key;
  } catch (error) {
    console.error('Error sending voice message:', error);
    return null;
  }
};
```

## Voice Message Component

For displaying voice messages in the chat, I created a dedicated component:

```jsx
// src/components/chat/VoiceMessage.jsx
import { useState, useRef } from 'react';
import styles from './VoiceMessage.module.css';

export default function VoiceMessage({ message }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef(null);
  
  // Format duration in seconds to mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  // Handle play/pause
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };
  
  // Audio event handlers
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => setIsPlaying(false);
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(Math.floor(audioRef.current.currentTime));
    }
  };
  
  return (
    <div className={styles.voiceMessage}>
      <audio
        ref={audioRef}
        src={message.voiceData}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        preload="metadata"
      />
      
      <button 
        className={`${styles.playButton} ${isPlaying ? styles.playing : ''}`}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      
      <div className={styles.waveform}>
        <div 
          className={styles.progress}
          style={{ 
            width: message.duration > 0 
              ? `${(currentTime / message.duration) * 100}%` 
              : '0%' 
          }}
        />
      </div>
      
      <div className={styles.duration}>
        {formatDuration(isPlaying ? currentTime : message.duration)}
      </div>
    </div>
  );
}
```

## Styling the Voice Messages

I wanted the voice messages to have a distinctive look:

```css
/* VoiceMessage.module.css */
.voiceMessage {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 200px;
}

.playButton {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #0084ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-size: 12px;
}

.playing {
  background-color: #555;
}

.waveform {
  flex: 1;
  height: 24px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background-color: rgba(0, 132, 255, 0.3);
  transition: width 0.1s linear;
}

.duration {
  font-size: 12px;
  color: #555;
  min-width: 40px;
  text-align: right;
}
```

## Integrating with Message Input

I added a microphone button to the message input to trigger voice recording:

```jsx
// In MessageInput.jsx
const [isRecording, setIsRecording] = useState(false);

const handleVoiceButtonClick = () => {
  setIsRecording(true);
};

// In the JSX
<div className={styles.messageInputContainer}>
  {/* Text input */}
  <textarea
    // ...
  />
  
  {/* Voice button */}
  <button
    type="button"
    className={styles.voiceButton}
    onClick={handleVoiceButtonClick}
    aria-label="Record voice message"
  >
    🎤
  </button>
  
  {/* Voice recorder modal */}
  {isRecording && (
    <div className={styles.recorderModal}>
      <VoiceRecorder 
        onClose={() => setIsRecording(false)}
        replyToId={replyingTo?.id}
      />
    </div>
  )}
</div>
```

## Technical Challenges

### Browser Compatibility

One of the biggest challenges was browser compatibility. The MediaRecorder API isn't supported in all browsers, so I had to add a fallback:

```jsx
// Check for MediaRecorder support
const isRecordingSupported = () => {
  return 'MediaRecorder' in window;
};

// In the component
useEffect(() => {
  if (!isRecordingSupported()) {
    setError('Voice recording is not supported in your browser.');
  }
}, []);

// In the render
{!isRecordingSupported() ? (
  <div className={styles.notSupported}>
    Voice recording is not supported in your browser.
    Try using Chrome or Firefox for this feature.
  </div>
) : (
  // Normal recorder UI
  // ...
)}
```

### Audio Format Compatibility

Different browsers support different audio formats, which was tricky:

```jsx
// Get the appropriate MIME type based on browser support
const getMimeType = () => {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return '';
};

// Use the supported MIME type when creating the MediaRecorder
const mediaRecorder = new MediaRecorder(stream, { 
  mimeType: getMimeType() 
});
```

### File Size Concerns

Voice messages can get large, so I had to implement some limits:

```jsx
// In VoiceRecorder.jsx
const MAX_RECORDING_TIME = 60; // 1 minute max

useEffect(() => {
  if (recordingTime >= MAX_RECORDING_TIME) {
    stopRecording();
  }
}, [recordingTime]);
```

And in the ChatContext:

```jsx
// In sendVoiceMessage
if (base64.length > 1024 * 1024) { // If larger than 1MB
  // Compress or reject the audio
  throw new Error('Voice message too large');
}
```

## User Experience Considerations

I wanted to make recording voice messages as intuitive as possible:

1. **Clear Feedback** - Visual recording indicator and timer
2. **Preview Before Sending** - Listen to your recording before sending
3. **Cancel Option** - Easy way to discard a recording
4. **Playback Controls** - Simple play/pause with progress indicator
5. **Duration Display** - Show how long the message is

## Future Improvements

If I had more time, I'd enhance the voice message feature with:

1. **Waveform Visualization** - Show the actual audio waveform
2. **Speed Controls** - Allow playback at different speeds (0.5x, 1x, 1.5x, 2x)
3. **Transcription** - Add automatic speech-to-text
4. **Noise Reduction** - Improve audio quality with filters
5. **Better Compression** - Reduce file size while maintaining quality

The voice message feature adds a whole new dimension to the chat experience. I've found it particularly useful for quickly explaining complex ideas or adding a personal touch to conversations. 