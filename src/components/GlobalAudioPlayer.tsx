import React, { useState, useCallback, useEffect } from 'react';
import { useAudioPlayer, Track, RepeatMode } from '@/contexts/AudioPlayerContext';
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
  ChevronUp,
  Repeat,
  Repeat1,
  Shuffle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TrackEditDialog } from '@/components/TrackEditDialog';
import { useAuth } from '@/contexts/AuthContext';
import { SongInfoDialog } from '@/components/catalog/SongInfoDialog';
import { supabase } from '@/integrations/supabase/client';

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
  const coverUrl = currentTrack.artistImageUrl || currentTrack.coverUrl;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Ambient glow behind player */}
      {coverUrl && (
        <div
          className="absolute inset-0 opacity-20 blur-2xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* Glass card */}
      <div className="relative mx-3 mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-card/80 backdrop-blur-xl">
        {/* Progress bar — thin accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-muted/40">
          <div
            className="h-full bg-primary transition-all duration-150 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Cover thumbnail */}
          <button onClick={togglePanel} className="flex-shrink-0 group">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-muted/50 ring-1 ring-white/10 shadow-md transition-transform duration-200 group-hover:scale-105">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={currentTrack.artist}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          </button>

          {/* Track info */}
          <button
            onClick={togglePanel}
            className="flex-1 min-w-0 text-left"
          >
            <p className="font-semibold text-sm truncate leading-tight">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{currentTrack.artist}</p>
          </button>

          {/* Time */}
          <div className="hidden md:flex items-center text-xs text-muted-foreground/70 tabular-nums gap-1 flex-shrink-0">
            <span>{formatTime(currentTime)}</span>
            <span className="text-muted-foreground/40">/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden sm:flex rounded-full text-muted-foreground hover:text-foreground"
              onClick={playPrevious}
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>

            <button
              onClick={isPlaying ? pause : resume}
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 text-primary-foreground" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4 text-primary-foreground ml-0.5" fill="currentColor" />
              )}
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden sm:flex rounded-full text-muted-foreground hover:text-foreground"
              onClick={playNext}
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Expand */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={togglePanel}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
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
    repeatMode,
    isShuffled,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    closePanel,
    playNext,
    playPrevious,
    clearQueue,
    toggleRepeatMode,
    toggleShuffle,
    play
  } = useAudioPlayer();

  const { isAdmin } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [localTrack, setLocalTrack] = useState<Track | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [songMetadata, setSongMetadata] = useState<any>(null);
  const [albumName, setAlbumName] = useState<string>("");
  const [isPlayingV2, setIsPlayingV2] = useState(false);

  useEffect(() => {
    if (currentTrack) {
      setLocalTrack(currentTrack);
      setIsPlayingV2(false); // Reset to V1 when track changes
    }
  }, [currentTrack]);

  // Load full song metadata for info dialog and V2 support
  useEffect(() => {
    const loadSongMetadata = async () => {
      if (!localTrack?.songId) return;
      
      const { data: songData } = await supabase
        .from("songs")
        .select("*, albums(name)")
        .eq("id", localTrack.songId)
        .single();
      
      if (songData) {
        setSongMetadata(songData);
        setAlbumName((songData.albums as any)?.name || localTrack.album || "");
        // Update track with alternative URL if available
        if (songData.alternative_audio_url && !localTrack.alternativeAudioUrl) {
          setLocalTrack(prev => prev ? { 
            ...prev, 
            alternativeAudioUrl: songData.alternative_audio_url 
          } : null);
        }
      }
    };
    
    loadSongMetadata();
  }, [localTrack?.songId, localTrack?.album, localTrack?.alternativeAudioUrl]);

  const handleTrackUpdated = useCallback((updates: Partial<Track>) => {
    setLocalTrack(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  if (!isPanelOpen) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const coverUrl = localTrack?.artistImageUrl || localTrack?.coverUrl;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed inset-0 md:inset-auto md:top-3 md:right-3 md:bottom-3 md:w-[360px] z-50 flex flex-col rounded-none md:rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-slide-in-right">

        {/* Ambient background from cover art */}
        <div className="absolute inset-0 -z-10">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="w-full h-full object-cover opacity-20 scale-110 blur-3xl" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background" />
          )}
          <div className="absolute inset-0 bg-card/85 backdrop-blur-2xl" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full bg-primary", isPlaying && "animate-pulse")} />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              {isPlaying ? "Wird gespielt" : "Pausiert"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-6 space-y-5">

            {/* Cover Art */}
            <div className="relative mt-2">
              {coverUrl && (
                <div
                  className="absolute inset-0 rounded-3xl blur-3xl opacity-40 scale-90"
                  style={{ backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover' }}
                />
              )}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={localTrack?.artist}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/30">
                    <Music className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold truncate leading-tight">
                    {localTrack?.title || 'Kein Track'}
                    {isPlayingV2 && <span className="text-primary text-sm ml-1.5">(V2)</span>}
                  </h3>
                  <p className="text-muted-foreground text-sm truncate mt-0.5">
                    {localTrack?.artist || 'Unbekannt'}
                  </p>
                  {localTrack?.album && (
                    <p className="text-xs text-muted-foreground/50 truncate mt-0.5">
                      {localTrack.album}
                    </p>
                  )}
                </div>
                {/* Info / Edit button next to title */}
                {localTrack?.songId && isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => setEditDialogOpen(true)}
                    className="h-8 w-8 rounded-full shrink-0 mt-0.5 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {localTrack?.songId && !isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => setInfoDialogOpen(true)}
                    className="h-8 w-8 rounded-full shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                    title="Song-Informationen">
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Version Toggle */}
              {localTrack?.alternativeAudioUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => { if (isPlayingV2 && localTrack) { setIsPlayingV2(false); play({ ...localTrack, audioUrl: currentTrack?.audioUrl || localTrack.audioUrl }); } }}
                    disabled={!isPlayingV2}
                    className={cn("text-[11px] font-bold px-3 py-1 rounded-full border transition-all",
                      !isPlayingV2 ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-border"
                    )}
                  >V1</button>
                  <button
                    onClick={() => { if (!isPlayingV2 && localTrack?.alternativeAudioUrl) { setIsPlayingV2(true); play({ ...localTrack, audioUrl: localTrack.alternativeAudioUrl }); } }}
                    disabled={isPlayingV2}
                    className={cn("text-[11px] font-bold px-3 py-1 rounded-full border transition-all",
                      isPlayingV2 ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-border"
                    )}
                  >V2</button>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-1.5">
              <div className="relative h-1.5 bg-muted/40 rounded-full overflow-hidden cursor-pointer group">
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={([value]) => seek(value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground/60 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-between px-2">
              <button
                onClick={toggleShuffle}
                className={cn("h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-110",
                  isShuffled ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Shuffle className="h-4 w-4" />
              </button>

              <button
                onClick={playPrevious}
                className="h-11 w-11 rounded-full flex items-center justify-center text-foreground hover:bg-muted/60 transition-all hover:scale-110 active:scale-95"
              >
                <SkipBack className="h-5 w-5" fill="currentColor" />
              </button>

              <button
                onClick={isPlaying ? pause : resume}
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7 text-primary-foreground" fill="currentColor" />
                ) : (
                  <Play className="h-7 w-7 text-primary-foreground ml-1" fill="currentColor" />
                )}
              </button>

              <button
                onClick={playNext}
                className="h-11 w-11 rounded-full flex items-center justify-center text-foreground hover:bg-muted/60 transition-all hover:scale-110 active:scale-95"
              >
                <SkipForward className="h-5 w-5" fill="currentColor" />
              </button>

              <button
                onClick={toggleRepeatMode}
                className={cn("h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-110",
                  repeatMode !== 'off' ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {repeatMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 px-1">
              <button onClick={toggleMute} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={([value]) => setVolume(value / 100)}
                className="flex-1"
              />
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-xs font-semibold">Warteschlange</span>
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">{queue.length}</span>
                  </div>
                  <button onClick={clearQueue} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    Leeren
                  </button>
                </div>
                <div className="space-y-1">
                  {queue.slice(0, 5).map((track, index) => (
                    <div
                      key={`${track.id}-${index}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {track.artistImageUrl || track.coverUrl ? (
                          <img src={track.artistImageUrl || track.coverUrl} alt={track.artist} className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 text-muted-foreground/50 m-auto mt-2.5" />
                        )}
                        <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white/80 bg-black/50 px-1 rounded">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{track.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                      </div>
                    </div>
                  ))}
                  {queue.length > 5 && (
                    <p className="text-[11px] text-muted-foreground/60 text-center py-1.5">
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

      {/* Info Dialog for Viewer */}
      <SongInfoDialog
        song={songMetadata}
        albumName={albumName}
        artistName={localTrack?.artist || ""}
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
      />
    </>
  );
};

// Hook to get player height for padding
export const usePlayerHeight = () => {
  const { currentTrack, isPanelOpen } = useAudioPlayer();
  return currentTrack && !isPanelOpen ? 80 : 0;
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
        <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Wird gespielt</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={closePanel}
            className="h-8 w-8 rounded-full hover:bg-muted/80"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-6 space-y-5">
            {/* Album Art with glow effect */}
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-2xl opacity-50 group-hover:opacity-70 transition-opacity" />
              <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl bg-muted/50 overflow-hidden ring-1 ring-white/10 shadow-2xl">
                {localTrack?.artistImageUrl || localTrack?.coverUrl ? (
                  <img 
                    src={localTrack.artistImageUrl || localTrack.coverUrl} 
                    alt={localTrack?.artist || localTrack?.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <Music className="w-16 h-16 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="text-center space-y-1.5 px-2">
              <h3 className="text-xl font-bold truncate leading-tight">
                {localTrack?.title || 'Kein Track'}
                {isPlayingV2 && <span className="text-primary text-sm ml-1">(V2)</span>}
              </h3>
              <p className="text-muted-foreground truncate">
                {localTrack?.artist || 'Unbekannt'}
              </p>
              {localTrack?.album && (
                <p className="text-xs text-muted-foreground/60 truncate">
                  {localTrack.album}
                </p>
              )}
              
              {/* Version Toggle - only show when alternative version exists */}
              {localTrack?.alternativeAudioUrl && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Button
                    variant={!isPlayingV2 ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => {
                      if (isPlayingV2 && localTrack) {
                        // Switch to V1
                        setIsPlayingV2(false);
                        // Re-play with original URL
                        play({
                          ...localTrack,
                          audioUrl: currentTrack?.audioUrl || localTrack.audioUrl,
                        });
                      }
                    }}
                    disabled={!isPlayingV2}
                  >
                    V1
                  </Button>
                  <Button
                    variant={isPlayingV2 ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => {
                      if (!isPlayingV2 && localTrack?.alternativeAudioUrl) {
                        // Switch to V2
                        setIsPlayingV2(true);
                        play({
                          ...localTrack,
                          audioUrl: localTrack.alternativeAudioUrl,
                        });
                      }
                    }}
                    disabled={isPlayingV2}
                  >
                    V2
                  </Button>
                </div>
              )}
            </div>

            {/* Progress with custom styling */}
            <div className="space-y-2 px-1">
              <div className="relative h-1 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={([value]) => seek(value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground/70 tabular-nums font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-2 py-2">
              {/* Shuffle Button */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full transition-all hover:scale-105",
                  isShuffled ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={toggleShuffle}
                title={isShuffled ? "Shuffle aus" : "Shuffle an"}
              >
                <Shuffle className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full hover:bg-muted/80 transition-all hover:scale-105"
                onClick={playPrevious}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button
                size="icon"
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
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
                className="h-12 w-12 rounded-full hover:bg-muted/80 transition-all hover:scale-105"
                onClick={playNext}
              >
                <SkipForward className="h-5 w-5" />
              </Button>

              {/* Repeat Button */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full transition-all hover:scale-105",
                  repeatMode !== 'off' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={toggleRepeatMode}
                title={
                  repeatMode === 'off' ? "Wiederholen aus" : 
                  repeatMode === 'one' ? "Einzelnen Song wiederholen" : 
                  "Alle wiederholen"
                }
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="h-4 w-4" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Secondary Controls */}
            <div className="flex items-center gap-3 px-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 rounded-full"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={([value]) => setVolume(value / 100)}
                className="flex-1"
              />
              {localTrack?.songId && isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditDialogOpen(true)}
                  className="h-8 w-8 rounded-full"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
              {localTrack?.songId && !isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setInfoDialogOpen(true)}
                  className="h-8 w-8 rounded-full"
                  title="Song-Informationen"
                >
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div className="space-y-3 pt-4 mt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4 text-primary/70" />
                    <span className="text-sm font-medium">Warteschlange</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                      {queue.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground hover:text-foreground"
                    onClick={clearQueue}
                  >
                    Leeren
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {queue.slice(0, 5).map((track, index) => (
                    <div 
                      key={`${track.id}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="relative w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-white/5">
                        {track.artistImageUrl || track.coverUrl ? (
                          <img 
                            src={track.artistImageUrl || track.coverUrl} 
                            alt={track.artist}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-4 h-4 text-muted-foreground/50" />
                        )}
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold text-white/70 bg-black/50 px-1 rounded">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                  ))}
                  {queue.length > 5 && (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">
                      +{queue.length - 5} weitere Tracks
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

      {/* Info Dialog for Viewer */}
      <SongInfoDialog
        song={songMetadata}
        albumName={albumName}
        artistName={localTrack?.artist || ""}
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
      />
    </>
  );
};

// Hook to get player height for padding
export const usePlayerHeight = () => {
  const { currentTrack, isPanelOpen } = useAudioPlayer();
  // Return height only when mini player is visible (track exists and panel is closed)
  // Extra space for floating card (mb-3 + card height ~64px + rounded = ~80px)
  return currentTrack && !isPanelOpen ? 80 : 0;
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
