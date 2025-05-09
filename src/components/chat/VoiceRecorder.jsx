import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatArea.module.css';

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  
  // Check browser support on mount
  useEffect(() => {
    // Check if MediaRecorder is available
    if (!window.MediaRecorder) {
      setUnsupported(true);
      return;
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setUnsupported(true);
    }
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      stopMediaTracks();
    };
  }, []);
  
  // Function to stop and clean up media tracks
  const stopMediaTracks = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping recorder:', err);
      }
    }
    
    // Release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.error('Error stopping track:', err);
        }
      });
      streamRef.current = null;
    }
  };

  // Toggle recording on/off
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      stopMediaTracks();
      clearInterval(timerRef.current);
      setIsRecording(false);
    } else {
      try {
        // Stop any existing stream first
        stopMediaTracks();
        
        // Start a new recording
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        // Save stream for cleanup
        streamRef.current = stream;
        
        // Determine the best mime type to use
        const mimeType = getSupportedMimeType();
        
        // Create media recorder with best available options
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: mimeType,
          audioBitsPerSecond: 128000 // 128 kbps
        });
        
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorderRef.current.onstop = () => {
          // Create blob with the appropriate mime type
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          setAudioBlob(audioBlob);
        };
        
        // Start recording
        mediaRecorderRef.current.start(1000); // Collect data every second
        setIsRecording(true);
        setRecordingTime(0);
        
        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            // Auto-stop after 2 minutes (120 seconds)
            if (prev >= 120) {
              toggleRecording();
              return prev;
            }
            return prev + 1;
          });
        }, 1000);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setPermissionDenied(true);
        stopMediaTracks();
      }
    }
  };
  
  // Get supported MIME type for audio recording
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm',          // Chrome, Edge
      'audio/webm;codecs=opus', // More specific for Chrome
      'audio/mp4',           // Safari (newer versions)
      'audio/ogg;codecs=opus', // Firefox
      'audio/wav',           // Fallback
      ''                     // Browser default
    ];
    
    for (const type of types) {
      if (!type || MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return '';  // Use browser default
  };
  
  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle send button click
  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, recordingTime);
    }
  };
  
  // Handle cancel button click
  const handleCancel = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    stopMediaTracks();
    onCancel();
  };
  
  // Show if browser doesn't support audio recording
  if (unsupported) {
    return (
      <div className={styles.recordingControls}>
        <div style={{ color: '#ef4444' }}>
          Your browser doesn't support voice recording.
        </div>
      </div>
    );
  }
  
  // Show if microphone access is denied
  if (permissionDenied) {
    return (
      <div className={styles.recordingControls}>
        <div style={{ color: '#ef4444' }}>
          Microphone access denied. Please allow microphone access to record voice messages.
        </div>
        <button 
          className={styles.cancelRecordingButton}
          onClick={onCancel}
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }
  
  // If we have recorded audio but not recording currently
  if (audioBlob && !isRecording) {
    return (
      <div className={styles.recordingControls}>
        <div className={styles.recordingIndicator}>
          <div className={styles.recordingTime}>{formatTime(recordingTime)}</div>
        </div>
        <div className={styles.recordingActions}>
          <button
            className={styles.cancelRecordingButton}
            onClick={handleCancel}
            title="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            className={styles.sendRecordingButton}
            onClick={handleSend}
            title="Send voice message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.recordingControls}>
      {isRecording && (
        <div className={styles.recordingIndicator}>
          <span></span>
          <div className={styles.recordingTime}>{formatTime(recordingTime)}</div>
        </div>
      )}
      <button
        className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
        onClick={toggleRecording}
        title={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
      {isRecording && (
        <div className={styles.audioWaveform}>
          <div className={styles.waveformBar}></div>
          <div className={styles.waveformBar}></div>
          <div className={styles.waveformBar}></div>
          <div className={styles.waveformBar}></div>
          <div className={styles.waveformBar}></div>
        </div>
      )}
    </div>
  );
};

VoiceRecorder.propTypes = {
  onSend: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default VoiceRecorder; 