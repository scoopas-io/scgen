import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  audioUrl: string;
  coverUrl?: string;
  artistImageUrl?: string;
  duration?: number;
}

interface AudioPlayerContextType {
  // Current track
  currentTrack: Track | null;
  isPlaying: boolean;
  isPanelOpen: boolean;
  
  // Playback state
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  // Queue
  queue: Track[];
  
  // Actions
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  
  // Queue actions
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (queue.length > 0) {
        playNext();
      }
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);

  const play = useCallback((track: Track) => {
    if (!audioRef.current) return;
    
    // Add current track to history if exists
    if (currentTrack) {
      setHistory(prev => [currentTrack, ...prev.slice(0, 49)]);
    }
    
    setCurrentTrack(track);
    audioRef.current.src = track.audioUrl;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(console.error);
    
    // Auto-open panel when playing
    setIsPanelOpen(true);
  }, [currentTrack]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(console.error);
  }, [currentTrack]);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (!audioRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    audioRef.current.volume = clampedVolume;
    setVolumeState(clampedVolume);
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const playNext = useCallback(() => {
    if (queue.length > 0) {
      const [nextTrack, ...rest] = queue;
      setQueue(rest);
      play(nextTrack);
    }
  }, [queue, play]);

  const playPrevious = useCallback(() => {
    if (history.length > 0) {
      const [prevTrack, ...rest] = history;
      setHistory(rest);
      if (currentTrack) {
        setQueue(prev => [currentTrack, ...prev]);
      }
      setCurrentTrack(prevTrack);
      if (audioRef.current) {
        audioRef.current.src = prevTrack.audioUrl;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    }
  }, [history, currentTrack]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isPanelOpen,
        currentTime,
        duration,
        volume,
        isMuted,
        queue,
        play,
        pause,
        resume,
        stop,
        seek,
        setVolume,
        toggleMute,
        togglePanel,
        openPanel,
        closePanel,
        addToQueue,
        clearQueue,
        playNext,
        playPrevious,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};
