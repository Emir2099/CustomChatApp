import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatArea.module.css';

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [recordingState, setRecordingState] = useState('idle'); // idle, recording, paused
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const waveformRef = useRef(null);
  
  // Check browser support on mount
  useEffect(() => {
    if (!window.MediaRecorder) {
      setUnsupported(true);
      return;
    }
    
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
  
  // Animate waveform bars
  useEffect(() => {
    if (recordingState === 'recording' && waveformRef.current) {
      const bars = waveformRef.current.children;
      Array.from(bars).forEach((bar, index) => {
        bar.style.animationDelay = `${index * 0.1}s`;
      });
    }
  }, [recordingState]);
  
  const stopMediaTracks = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping recorder:', err);
      }
    }
    
    // Only release microphone if fully canceling (not when pausing)
    if (streamRef.current && recordingState !== 'paused') {
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

  const startRecording = async () => {
    try {
      // If resuming from pause, don't get new stream
      if (recordingState !== 'paused') {
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
        
        // Only clear chunks if starting a new recording
        if (recordingState !== 'paused') {
          audioChunksRef.current = [];
        }
        
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
      } else {
        // resuming from pause, restart recording on the same stream
        const mimeType = getSupportedMimeType();
        
        if (streamRef.current) {
          mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
          });
          
          mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };
          
          mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            setAudioBlob(audioBlob);
          };
          
          mediaRecorderRef.current.start(1000);
        } else {
          // If stream was released, start fresh
          return startRecording();
        }
      }
      
      setRecordingState('recording');
      
      // Start or resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          // Auto-stop after 2 minutes (120 seconds)
          if (prev >= 120) {
            pauseRecording();
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
  };
  
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      setRecordingState('paused');
    }
  };
  
  const handleRecordingAction = () => {
    // Add small vibration for tactile feedback on mobile devices
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
    
    switch (recordingState) {
      case 'idle':
        startRecording();
        break;
      case 'recording':
        pauseRecording();
        break;
      case 'paused':
        startRecording();
        break;
      default:
        break;
    }
  };
  
  // Get supported MIME type for audio recording
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
      ''
    ];
    
    for (const type of types) {
      if (!type || MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return '';
  };
  
  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, recordingTime);
      resetRecording();
    }
  };
  
  const handleCancel = () => {
    resetRecording();
    onCancel();
  };
  
  const resetRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setRecordingState('idle');
    stopMediaTracks();
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
  
  return (
    <div className={`${styles.recordingControls} ${recordingState !== 'idle' ? styles.activeRecording : ''}`}>
      <div className={styles.recordingCenter}>
        <div className={styles.recordingRow}>
          <div className={styles.recordingTime}>
            {formatTime(recordingTime)}
          </div>
          
          <div className={styles.recordingButtonContainer}>
            {recordingState === 'paused' && (
              <div className={styles.recordingActions}>
                <button
                  className={styles.cancelRecordingButton}
                  onClick={handleCancel}
                  title="Cancel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                <button
                  className={styles.sendRecordingButton}
                  onClick={handleSend}
                  title="Send voice message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}
            
            {recordingState === 'idle' && (
              <button
                className={styles.exitRecordingButton}
                onClick={onCancel}
                title="Exit voice recording"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            
            <button
              className={`${styles.recordButton} ${
                recordingState === 'recording' ? styles.recording : 
                recordingState === 'paused' ? styles.paused : ''
              }`}
              onClick={handleRecordingAction}
              title={
                recordingState === 'idle' ? "Start recording" :
                recordingState === 'recording' ? "Pause recording" :
                "Resume recording"
              }
            >
              {recordingState === 'idle' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
              {recordingState === 'recording' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z" />
                </svg>
              )}
              {recordingState === 'paused' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
              )}
            </button>
          </div>
          
          <div className={`${styles.audioWaveform} ${
            recordingState === 'idle' ? styles.waveformIdle : 
            recordingState === 'recording' ? styles.waveformRecording : 
            styles.waveformPaused
          }`} ref={waveformRef}>
            <div className={styles.waveformBar}></div>
            <div className={styles.waveformBar}></div>
            <div className={styles.waveformBar}></div>
            <div className={styles.waveformBar}></div>
            <div className={styles.waveformBar}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

VoiceRecorder.propTypes = {
  onSend: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default VoiceRecorder; 