import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatArea.module.css';

const AudioPlayer = ({ audioUrl, duration, isSent }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const audioRef = useRef(null);
  const progressInterval = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  
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
    
    // Load audio from data URL
    const loadAudio = async () => {
      cleanup();
      
      try {
        // Simply set the audio source directly - the browser will handle it
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.playbackRate = playbackRate;
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading audio:', error);
        setIsLoaded(false);
      }
    };
    
    loadAudio();
    
    return cleanup;
  }, [audioUrl, playbackRate]);
  
  // Set up event listeners after audio is loaded
  useEffect(() => {
    if (!audioRef.current || !isLoaded) return;
    
    const audio = audioRef.current;
    
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
      setCurrentTime(audio.currentTime);
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    // Clean up on unmount
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isLoaded]);
  
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
  
  // Handle progress bar change
  const handleProgressChange = (e) => {
    if (!audioRef.current || !isLoaded) return;
    
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    audioRef.current.currentTime = newTime;
  };
  
  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={styles.audioControls}>
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={handleProgressChange}
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
          {formatTime(currentTime)} / {formatTime(duration || 0)}
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
      <audio ref={audioRef} preload="metadata" />
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