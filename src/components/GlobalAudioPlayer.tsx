import React from 'react';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Music,
  ChevronRight,
  X,
  ListMusic,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Compact header mini player
export const HeaderMiniPlayer: React.FC = () => {
  const { 
    currentTrack, 
    isPlaying, 
    pause, 
    resume, 
    currentTime, 
    duration,
    openPanel
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <button
      onClick={openPanel}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border/50 group"
    >
      {/* Album art / icon */}
      <div className="relative w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        {currentTrack.coverUrl ? (
          <img 
            src={currentTrack.coverUrl} 
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="w-4 h-4 text-primary" />
        )}
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground/20"
          />
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${progress * 0.88} 88`}
            className="text-primary transition-all duration-150"
          />
        </svg>
      </div>
      
      {/* Track info - hidden on small screens */}
      <div className="hidden lg:block min-w-0 max-w-[120px]">
        <p className="text-xs font-medium truncate">{currentTrack.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist}</p>
      </div>
      
      {/* Play/Pause button */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          isPlaying ? pause() : resume();
        }}
        className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Play className="h-3.5 w-3.5 text-primary ml-0.5" />
        )}
      </div>
    </button>
  );
};

// Mini player bar at bottom
const MiniPlayer: React.FC = () => {
  const { 
    currentTrack, 
    isPlaying, 
    pause, 
    resume, 
    currentTime, 
    duration,
    togglePanel,
    isPanelOpen
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-2 md:py-3">
        {/* Track info */}
        <button 
          onClick={togglePanel}
          className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {currentTrack.coverUrl ? (
              <img 
                src={currentTrack.coverUrl} 
                alt={currentTrack.album || currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
          </div>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Time - hidden on mobile */}
          <span className="hidden sm:block text-xs text-muted-foreground tabular-nums w-10 text-right">
            {formatTime(currentTime)}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={isPlaying ? pause : resume}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          {/* Duration - hidden on mobile */}
          <span className="hidden sm:block text-xs text-muted-foreground tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Panel toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:h-10 md:w-10"
          onClick={togglePanel}
        >
          <ChevronRight className={cn(
            "h-5 w-5 transition-transform duration-200",
            isPanelOpen && "rotate-180"
          )} />
        </Button>
      </div>
    </div>
  );
};
// Full side panel
const SidePanel: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isPanelOpen,
    currentTime,
    duration,
    volume,
    isMuted,
    queue,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    closePanel,
    playNext,
    playPrevious,
    clearQueue
  } = useAudioPlayer();

  if (!isPanelOpen) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={closePanel}
      />
      
      {/* Panel - fullscreen on mobile */}
      <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-full md:max-w-md bg-card md:border-l border-border z-50 animate-slide-in-right flex flex-col safe-area-inset">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Now Playing</h2>
          <Button variant="ghost" size="icon" onClick={closePanel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 space-y-6 md:space-y-8">
            {/* Album Art */}
            <div className="aspect-square w-full max-w-[280px] md:max-w-xs mx-auto rounded-2xl bg-muted overflow-hidden shadow-2xl">
              {currentTrack?.coverUrl ? (
                <img 
                  src={currentTrack.coverUrl} 
                  alt={currentTrack?.album || currentTrack?.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-20 h-20 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold truncate">
                {currentTrack?.title || 'No track selected'}
              </h3>
              <p className="text-muted-foreground truncate">
                {currentTrack?.artist || 'Unknown artist'}
              </p>
              {currentTrack?.album && (
                <p className="text-sm text-muted-foreground/70 truncate">
                  {currentTrack.album}
                </p>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={([value]) => seek(value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12"
                onClick={playPrevious}
              >
                <SkipBack className="h-6 w-6" />
              </Button>
              
              <Button
                variant="default"
                size="icon"
                className="h-16 w-16 rounded-full glow-gold"
                onClick={isPlaying ? pause : resume}
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 ml-1" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12"
                onClick={playNext}
              >
                <SkipForward className="h-6 w-6" />
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={([value]) => setVolume(value / 100)}
                className="w-full"
              />
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Queue</span>
                    <span className="text-xs text-muted-foreground">
                      ({queue.length})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={clearQueue}
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-1">
                  {queue.slice(0, 5).map((track, index) => (
                    <div 
                      key={`${track.id}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Music className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                  ))}
                  {queue.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{queue.length - 5} more tracks
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

export const GlobalAudioPlayer: React.FC = () => {
  const { currentTrack } = useAudioPlayer();

  return (
    <>
      {currentTrack && <MiniPlayer />}
      <SidePanel />
    </>
  );
};
