import React, { useState, useCallback } from 'react';
import { useAudioPlayer, Track } from '@/contexts/AudioPlayerContext';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Music,
  X,
  ListMusic,
  Pencil,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TrackEditDialog } from '@/components/TrackEditDialog';

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
  const displayImage = currentTrack.artistImageUrl || currentTrack.coverUrl;

  return (
    <button
      onClick={openPanel}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border/50 group"
    >
      <div className="relative w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-border">
        {displayImage ? (
          <img 
            src={displayImage} 
            alt={currentTrack.artist}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="w-4 h-4 text-primary" />
        )}
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
      
      <div className="hidden lg:block min-w-0 max-w-[120px]">
        <p className="text-xs font-medium truncate">{currentTrack.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist}</p>
      </div>
      
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

// Compact mini player bar at bottom
const MiniPlayer: React.FC = () => {
  const { 
    currentTrack, 
    isPlaying, 
    pause, 
    resume, 
    currentTime, 
    duration,
    togglePanel,
    isPanelOpen,
    playNext,
    playPrevious
  } = useAudioPlayer();

  if (!currentTrack || isPanelOpen) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
      {/* Progress bar - thin line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="flex items-center gap-2 px-3 py-2 max-w-screen-xl mx-auto">
        {/* Track info */}
        <button 
          onClick={togglePanel}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {currentTrack.artistImageUrl || currentTrack.coverUrl ? (
              <img 
                src={currentTrack.artistImageUrl || currentTrack.coverUrl} 
                alt={currentTrack.artist}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
          </div>
        </button>

        {/* Controls - compact */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden sm:flex"
            onClick={playPrevious}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={isPlaying ? pause : resume}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden sm:flex"
            onClick={playNext}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Time display */}
        <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground tabular-nums min-w-[80px] justify-end">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Expand button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={togglePanel}
        >
          <ChevronUp className="h-4 w-4" />
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

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [localTrack, setLocalTrack] = useState<Track | null>(null);

  React.useEffect(() => {
    if (currentTrack) {
      setLocalTrack(currentTrack);
    }
  }, [currentTrack]);

  const handleTrackUpdated = useCallback((updates: Partial<Track>) => {
    setLocalTrack(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  if (!isPanelOpen) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={closePanel}
      />
      
      {/* Panel */}
      <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-full md:max-w-md bg-card md:border-l border-border z-50 animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="font-display font-semibold text-lg">Aktueller Track</h2>
          <Button variant="ghost" size="icon" onClick={closePanel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 md:p-6 space-y-6">
            {/* Album Art */}
            <div className="aspect-square w-full max-w-[240px] mx-auto rounded-xl bg-muted overflow-hidden shadow-xl">
              {localTrack?.artistImageUrl || localTrack?.coverUrl ? (
                <img 
                  src={localTrack.artistImageUrl || localTrack.coverUrl} 
                  alt={localTrack?.artist || localTrack?.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold truncate">
                {localTrack?.title || 'Kein Track'}
              </h3>
              <p className="text-muted-foreground text-sm truncate">
                {localTrack?.artist || 'Unbekannt'}
              </p>
              {localTrack?.album && (
                <p className="text-xs text-muted-foreground/70 truncate">
                  {localTrack.album}
                </p>
              )}
              
              {localTrack?.songId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  className="gap-1.5 mt-2"
                >
                  <Pencil className="h-3 w-3" />
                  Bearbeiten
                </Button>
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
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={playPrevious}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button
                variant="default"
                size="icon"
                className="h-14 w-14 rounded-full shadow-lg"
                onClick={isPlaying ? pause : resume}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={playNext}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
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
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Warteschlange</span>
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
                    Leeren
                  </Button>
                </div>
                <div className="space-y-1">
                  {queue.slice(0, 5).map((track, index) => (
                    <div 
                      key={`${track.id}-${index}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {track.artistImageUrl || track.coverUrl ? (
                          <img 
                            src={track.artistImageUrl || track.coverUrl} 
                            alt={track.artist}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-3 h-3 text-muted-foreground" />
                        )}
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
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{queue.length - 5} weitere
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Edit Dialog */}
      <TrackEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        track={localTrack}
        onTrackUpdated={handleTrackUpdated}
      />
    </>
  );
};

// Hook to get player height for padding
export const usePlayerHeight = () => {
  const { currentTrack, isPanelOpen } = useAudioPlayer();
  // Return height only when mini player is visible (track exists and panel is closed)
  return currentTrack && !isPanelOpen ? 60 : 0;
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
