import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatArea.module.css';

const AudioPlayer = ({ audioUrl, duration: propDuration, isSent }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const audioRef = useRef(null);
  const progressInterval = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const durationRef = useRef(propDuration);
  
  // Initialize with the prop duration for better UI experience
  useEffect(() => {
    // Ensure the propDuration is valid
    if (propDuration && isFinite(propDuration) && !isNaN(propDuration)) {
      setAudioDuration(propDuration);
      durationRef.current = propDuration;
    }
  }, [propDuration]);
  
  // Initialize audio element and handle source loading
  useEffect(() => {
    // Check if browser supports AudioContext
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    // Create audio context if not exists
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    // Clean up function
    const cleanup = () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (err) {
          // Ignore errors during disconnect
        }
        sourceNodeRef.current = null;
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
    
    // Array to track event listeners for cleanup
    const listeners = [];
    
    // Load audio from data URL
    const loadAudio = () => {
      cleanup();
      
      try {
        // Simply set the audio source directly - the browser will handle it
        if (audioRef.current) {
          // Initially use the prop duration (which should be accurate)
          if (propDuration && isFinite(propDuration) && !isNaN(propDuration)) {
            setAudioDuration(propDuration);
          }
          
          // Set properties
          audioRef.current.src = audioUrl;
          audioRef.current.playbackRate = playbackRate;
          audioRef.current.preload = "metadata";
          
          // Force a full audio load
          audioRef.current.load();
          
          // Set up event listener for the loadedmetadata event
          const handleMetadataLoaded = () => {
            try {
              // Check if audio element still exists
              if (!audioRef.current) return;
              
              const audioDur = audioRef.current.duration;
              
              // If duration is valid from audio element, use it
              if (audioDur && !isNaN(audioDur) && isFinite(audioDur)) {
                setAudioDuration(audioDur);
                durationRef.current = audioDur;
              } 
              // If audio duration is invalid but prop duration is valid, use prop
              else if (propDuration && !isNaN(propDuration) && isFinite(propDuration)) {
                setAudioDuration(propDuration);
                durationRef.current = propDuration;
              }
              
              setIsLoaded(true);
            } catch (error) {
              console.error('Error in metadata loaded handler:', error);
            }
          };
          
          // Add event listener and track for cleanup
          audioRef.current.addEventListener('loadedmetadata', handleMetadataLoaded);
          listeners.push(['loadedmetadata', handleMetadataLoaded]);
          
          // Also handle the loadeddata event as a fallback
          const handleLoadedData = () => {
            try {
              if (!isLoaded && audioRef.current) {
                const audioDur = audioRef.current.duration;
                
                if (audioDur && !isNaN(audioDur) && isFinite(audioDur)) {
                  setAudioDuration(audioDur);
                  durationRef.current = audioDur;
                }
                
                setIsLoaded(true);
              }
            } catch (error) {
              console.error('Error in loaded data handler:', error);
            }
          };
          
          audioRef.current.addEventListener('loadeddata', handleLoadedData);
          listeners.push(['loadeddata', handleLoadedData]);
        }
      } catch (error) {
        console.error('Error loading audio:', error);
        setIsLoaded(false);
      }
    };
    
    // Load the audio
    loadAudio();
    
    // Return cleanup function
    return () => {
      // Clean up event listeners we registered
      if (audioRef.current) {
        listeners.forEach(([event, handler]) => {
          try {
            audioRef.current.removeEventListener(event, handler);
          } catch (err) {
            // Ignore cleanup errors
          }
        });
      }
      
      // Run the main cleanup
      cleanup();
    };
  }, [audioUrl, playbackRate, propDuration, isLoaded]);
  
  // Set up event listeners after audio is loaded
  useEffect(() => {
    if (!audioRef.current || !isLoaded) return;
    
    const audio = audioRef.current;
    const listeners = [];
    
    // Set up event listeners
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
    };
    
    const handleTimeUpdate = () => {
      if (!isDragging && audio) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    // Double-check duration once loaded
    const handleDurationChange = () => {
      try {
        if (!audio) return;
        
        const audioDur = audio.duration;
        if (audioDur && !isNaN(audioDur) && isFinite(audioDur)) {
          setAudioDuration(audioDur);
          durationRef.current = audioDur;
        }
      } catch (error) {
        console.error('Error in duration change handler:', error);
      }
    };
    
    // Add all event listeners and track them for cleanup
    const addListener = (event, handler) => {
      try {
        audio.addEventListener(event, handler);
        listeners.push([event, handler]);
      } catch (err) {
        console.error(`Error adding ${event} listener:`, err);
      }
    };
    
    addListener('ended', handleEnded);
    addListener('pause', handlePause);
    addListener('play', handlePlay);
    addListener('timeupdate', handleTimeUpdate);
    addListener('durationchange', handleDurationChange);
    
    // Also manually check the duration after a short delay
    const timeoutId = setTimeout(() => {
      try {
        if (!audio) return;
        
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setAudioDuration(audio.duration);
          durationRef.current = audio.duration;
        } else if (propDuration && !isNaN(propDuration) && isFinite(propDuration)) {
          setAudioDuration(propDuration);
          durationRef.current = propDuration;
        }
      } catch (error) {
        console.error('Error in timeout duration check:', error);
      }
    }, 300);
    
    // Clean up on unmount
    return () => {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Remove all listeners
      if (audio) {
        listeners.forEach(([event, handler]) => {
          try {
            audio.removeEventListener(event, handler);
          } catch (err) {
            // Ignore cleanup errors
          }
        });
      }
    };
  }, [isLoaded, isDragging, propDuration]);
  
  // Update playback rate when it changes
  useEffect(() => {
    if (audioRef.current && isLoaded) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isLoaded]);
  
  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current || !isLoaded) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      audio.pause();
    } else {
      // Resume or start AudioContext if it's suspended (autoplay policies)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  };
  
  // Cycle through playback speeds: 1x -> 1.5x -> 2x -> 0.5x -> 1x
  const cyclePlaybackRate = () => {
    if (playbackRate === 1) setPlaybackRate(1.5);
    else if (playbackRate === 1.5) setPlaybackRate(2);
    else if (playbackRate === 2) setPlaybackRate(0.5);
    else setPlaybackRate(1);
  };
  
  // Handle mouse down on the progress bar
  const handleMouseDown = () => {
    setIsDragging(true);
  };
  
  // Handle mouse up on the progress bar
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle progress bar change
  const handleProgressChange = (e) => {
    if (!audioRef.current || !isLoaded) return;
    
    // Force value to be a float number
    const newTime = parseFloat(e.target.value);
    
    // Get the maximum time from our reference or fallback to props
    const maxTime = durationRef.current || propDuration || 0;
    
    // Make sure newTime is within valid bounds
    const safeTime = Math.max(0, Math.min(newTime, maxTime));
    
    // Update the state immediately
    setCurrentTime(safeTime);
    
    // Update the audio element's current time
    try {
      audioRef.current.currentTime = safeTime;
    } catch (err) {
      console.error("Error setting currentTime:", err);
    }
  };
  
  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    // Ensure seconds is a valid number
    if (isNaN(seconds) || !isFinite(seconds)) {
      return "00:00";
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate max for range input - use the durationRef for consistency
  const getMaxValue = () => {
    // First try the reference which has the most up-to-date value
    if (durationRef.current && isFinite(durationRef.current) && !isNaN(durationRef.current)) {
      return durationRef.current;
    }
    
    // Then try the state
    if (audioDuration && isFinite(audioDuration) && !isNaN(audioDuration)) {
      return audioDuration;
    }
    
    // Then try the prop
    if (propDuration && isFinite(propDuration) && !isNaN(propDuration)) {
      return propDuration;
    }
    
    // Last resort fallback
    return 100;
  };
  
  return (
    <div className={styles.audioControls}>
      <input
        type="range"
        min="0"
        max={getMaxValue()}
        step="0.01"
        value={currentTime}
        onChange={handleProgressChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        className={styles.audioProgress}
        disabled={!isLoaded}
      />
      <div className={styles.playbackControls}>
        <button
          className={styles.playPauseButton}
          onClick={togglePlay}
          title={isPlaying ? "Pause" : "Play"}
          disabled={!isLoaded}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>
        <span className={styles.timeDisplay}>
          {formatTime(currentTime)} / {formatTime(getMaxValue())}
        </span>
        <button
          className={styles.speedControl}
          onClick={cyclePlaybackRate}
          title="Change playback speed"
          disabled={!isLoaded}
        >
          {playbackRate}x
        </button>
      </div>
      
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" />
    </div>
  );
};

AudioPlayer.propTypes = {
  audioUrl: PropTypes.string.isRequired,
  duration: PropTypes.number.isRequired,
  isSent: PropTypes.bool
};

AudioPlayer.defaultProps = {
  isSent: false
};

export default AudioPlayer; 