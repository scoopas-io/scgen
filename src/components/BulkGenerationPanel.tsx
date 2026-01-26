import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { isInstrumentalGenre } from "@/lib/genreConfig";
import { 
  Play, Pause, Square, Zap, Clock, CheckCircle2, XCircle, 
  Music, ChevronDown, ChevronUp, RotateCcw, AlertTriangle,
  ChevronRight, User, Disc, Trash2
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Song {
  id: string;
  name: string;
  album_id: string;
  bpm: number | null;
  tonart: string | null;
  audio_url: string | null;
  generation_status: string | null;
  suno_task_id: string | null;
  artistName: string;
  artistId: string;
  albumName: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
  language?: string;
  // Persona fields
  vocalGender?: string | null;
  vocalTexture?: string | null;
  vocalRange?: string | null;
  styleTags?: string[];
  moodTags?: string[];
  negativeTags?: string[];
  defaultBpmMin?: number | null;
  defaultBpmMax?: number | null;
  preferredKeys?: string[];
  instrumentalOnly?: boolean;
}

interface FailedSong extends Song {
  errorMessage: string;
  failedAt: Date;
}

interface BulkGenerationPanelProps {
  songs: Song[];
  onSongUpdate: (songId: string, updates: Partial<Song>) => void;
  onComplete: () => void;
}

export interface BulkGenerationPanelRef {
  getSelectedCount: () => number;
}

type GenerationStatus = "idle" | "running" | "paused" | "stopped";

// Suno API Rate Limit: 20 requests per 10 seconds = 500ms minimum delay
const SUNO_RATE_LIMIT_DELAY_MS = 500;

const BulkGenerationPanel = forwardRef<BulkGenerationPanelRef, BulkGenerationPanelProps>(
  ({ songs, onSongUpdate, onComplete }, ref) => {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [failedSongs, setFailedSongs] = useState<FailedSong[]>([]);
  const [showFailed, setShowFailed] = useState(false);
  const [showSelection, setShowSelection] = useState(true);
  
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    currentSong: "",
    currentArtist: "",
    startTime: null as number | null,
    estimatedRemaining: 0,
  });
  
  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  const isRunningRef = useRef(false);

  // Expose selected count to parent
  useImperativeHandle(ref, () => ({
    getSelectedCount: () => selectedSongIds.size
  }));

  // Filter songs that need generation
  const pendingSongs = songs.filter(song => 
    !song.audio_url && 
    song.generation_status !== "processing" &&
    song.generation_status !== "generating" &&
    song.generation_status !== "completed"
  );

  // Group pending songs by artist > album
  const groupedByArtist = pendingSongs.reduce((acc, song) => {
    if (!acc[song.artistId]) {
      acc[song.artistId] = {
        artistName: song.artistName,
        albums: {},
      };
    }
    if (!acc[song.artistId].albums[song.album_id]) {
      acc[song.artistId].albums[song.album_id] = {
        albumName: song.albumName,
        songs: [],
      };
    }
    acc[song.artistId].albums[song.album_id].songs.push(song);
    return acc;
  }, {} as Record<string, { artistName: string; albums: Record<string, { albumName: string; songs: Song[] }> }>);

  const toggleArtist = (artistId: string) => {
    const newExpanded = new Set(expandedArtists);
    if (newExpanded.has(artistId)) {
      newExpanded.delete(artistId);
    } else {
      newExpanded.add(artistId);
    }
    setExpandedArtists(newExpanded);
  };

  const toggleAlbum = (albumId: string) => {
    const newExpanded = new Set(expandedAlbums);
    if (newExpanded.has(albumId)) {
      newExpanded.delete(albumId);
    } else {
      newExpanded.add(albumId);
    }
    setExpandedAlbums(newExpanded);
  };

  const toggleSong = (songId: string) => {
    const newSelected = new Set(selectedSongIds);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongIds(newSelected);
  };

  const selectAllFromArtist = (artistId: string, checked: boolean) => {
    const artistData = groupedByArtist[artistId];
    if (!artistData) return;
    
    const newSelected = new Set(selectedSongIds);
    Object.values(artistData.albums).forEach(album => {
      album.songs.forEach(song => {
        if (checked) {
          newSelected.add(song.id);
        } else {
          newSelected.delete(song.id);
        }
      });
    });
    setSelectedSongIds(newSelected);
  };

  const selectAllFromAlbum = (albumId: string, checked: boolean) => {
    const albumSongs = pendingSongs.filter(s => s.album_id === albumId);
    const newSelected = new Set(selectedSongIds);
    albumSongs.forEach(song => {
      if (checked) {
        newSelected.add(song.id);
      } else {
        newSelected.delete(song.id);
      }
    });
    setSelectedSongIds(newSelected);
  };

  const selectAll = () => {
    setSelectedSongIds(new Set(pendingSongs.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSongIds(new Set());
  };

  const isArtistFullySelected = (artistId: string) => {
    const artistData = groupedByArtist[artistId];
    if (!artistData) return false;
    return Object.values(artistData.albums).every(album =>
      album.songs.every(song => selectedSongIds.has(song.id))
    );
  };

  const isAlbumFullySelected = (albumId: string) => {
    const albumSongs = pendingSongs.filter(s => s.album_id === albumId);
    return albumSongs.every(song => selectedSongIds.has(song.id));
  };

  const generateSong = async (song: Song): Promise<{ status: "success" | "error" | "skipped"; error?: string }> => {
    if (song.audio_url || song.generation_status === "completed") {
      return { status: "skipped" };
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-song-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            songId: song.id,
            title: song.name,
            genre: song.genre,
            style: song.style,
            voicePrompt: song.voicePrompt,
            personality: song.personality,
            bpm: song.bpm,
            tonart: song.tonart,
            artistName: song.artistName,
            instrumental: song.instrumentalOnly ?? isInstrumentalGenre(song.genre),
            language: song.language,
            // Persona fields
            vocalGender: song.vocalGender,
            vocalTexture: song.vocalTexture,
            vocalRange: song.vocalRange,
            styleTags: song.styleTags,
            moodTags: song.moodTags,
            negativeTags: song.negativeTags,
            defaultBpmMin: song.defaultBpmMin,
            defaultBpmMax: song.defaultBpmMax,
            preferredKeys: song.preferredKeys,
            instrumentalOnly: song.instrumentalOnly,
          }),
        }
      );

      const result = await response.json();
      
      if (result.success) {
        onSongUpdate(song.id, { 
          generation_status: result.status, 
          suno_task_id: result.taskId 
        });
        return { status: "success" };
      } else {
        onSongUpdate(song.id, { generation_status: "error" });
        return { status: "error", error: result.error || "Unbekannter Fehler" };
      }
    } catch (error) {
      onSongUpdate(song.id, { generation_status: "error" });
      return { status: "error", error: error instanceof Error ? error.message : "Verbindungsfehler" };
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runBulkGeneration = useCallback(async (songsToProcess: Song[]) => {
    if (isRunningRef.current) return;
    
    isRunningRef.current = true;
    stopRef.current = false;
    pauseRef.current = false;
    setStatus("running");

    const total = songsToProcess.length;
    
    if (total === 0) {
      toast.info("Keine Songs zum Generieren ausgewählt");
      setStatus("idle");
      isRunningRef.current = false;
      return;
    }

    // Calculate estimated time based on rate limit (500ms delay + ~1s processing)
    const estimatedTimePerSong = (SUNO_RATE_LIMIT_DELAY_MS / 1000) + 1;

    setProgress({
      current: 0,
      total,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      currentSong: "",
      currentArtist: "",
      startTime: Date.now(),
      estimatedRemaining: total * estimatedTimePerSong,
    });

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const newFailedSongs: FailedSong[] = [];

    for (let i = 0; i < songsToProcess.length; i++) {
      if (stopRef.current) {
        toast.info("Generierung gestoppt");
        break;
      }

      while (pauseRef.current && !stopRef.current) {
        await sleep(500);
      }

      if (stopRef.current) {
        toast.info("Generierung gestoppt");
        break;
      }

      const song = songsToProcess[i];
      
      setProgress(prev => ({
        ...prev,
        current: i,
        currentSong: song.name,
        currentArtist: song.artistName,
        estimatedRemaining: Math.max(0, (songsToProcess.length - i) * estimatedTimePerSong),
      }));

      const result = await generateSong(song);
      
      if (result.status === "success") {
        successCount++;
      } else if (result.status === "error") {
        errorCount++;
        newFailedSongs.push({
          ...song,
          errorMessage: result.error || "Unbekannter Fehler",
          failedAt: new Date(),
        });
      } else {
        skippedCount++;
      }

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        successCount,
        errorCount,
        skippedCount,
      }));

      // Suno API Rate Limit: 500ms minimum delay between requests
      if (i < songsToProcess.length - 1 && !stopRef.current) {
        let delayRemaining = SUNO_RATE_LIMIT_DELAY_MS;
        while (delayRemaining > 0 && !stopRef.current) {
          if (pauseRef.current) {
            while (pauseRef.current && !stopRef.current) {
              await sleep(500);
            }
          }
          await sleep(Math.min(100, delayRemaining));
          delayRemaining -= 100;
        }
      }
    }

    // Add newly failed songs to the list
    if (newFailedSongs.length > 0) {
      setFailedSongs(prev => [...prev, ...newFailedSongs]);
      setShowFailed(true);
    }

    setStatus("idle");
    isRunningRef.current = false;
    setSelectedSongIds(new Set());
    
    const message = stopRef.current
      ? `Gestoppt: ${successCount} gestartet, ${errorCount} Fehler`
      : `Fertig: ${successCount} gestartet, ${errorCount} Fehler, ${skippedCount} übersprungen`;
    
    if (errorCount > 0) {
      toast.warning(message);
    } else {
      toast.success(message);
    }
    
    onComplete();
  }, [onSongUpdate, onComplete]);

  const handleStart = () => {
    if (status === "paused") {
      pauseRef.current = false;
      setStatus("running");
    } else {
      const songsToProcess = pendingSongs.filter(s => selectedSongIds.has(s.id));
      runBulkGeneration(songsToProcess);
    }
  };

  const handlePause = () => {
    pauseRef.current = true;
    setStatus("paused");
  };

  const handleStop = () => {
    stopRef.current = true;
    pauseRef.current = false;
    setStatus("stopped");
  };

  const retryFailedSongs = () => {
    const songsToRetry = failedSongs.map(fs => {
      const originalSong = songs.find(s => s.id === fs.id);
      return originalSong || fs;
    }).filter(Boolean) as Song[];
    
    setFailedSongs([]);
    runBulkGeneration(songsToRetry);
  };

  const clearFailedSongs = () => {
    setFailedSongs([]);
  };

  const progressPercent = progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  if (pendingSongs.length === 0 && status === "idle" && failedSongs.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Alle Songs wurden bereits generiert oder sind in Bearbeitung</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-primary/30 bg-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Bulk-Generierung</h3>
            <p className="text-xs text-muted-foreground">
              {selectedSongIds.size} von {pendingSongs.length} Songs ausgewählt
            </p>
          </div>
        </div>
        
        <Badge variant="outline" className={
          status === "running" ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
          status === "paused" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
          status === "stopped" ? "bg-red-500/10 text-red-500 border-red-500/30" :
          ""
        }>
          {status === "running" && "Läuft"}
          {status === "paused" && "Pausiert"}
          {status === "stopped" && "Gestoppt"}
          {status === "idle" && "Bereit"}
        </Badge>
      </div>

      {/* Song Selection Tree */}
      {status === "idle" && pendingSongs.length > 0 && (
        <Collapsible open={showSelection} onOpenChange={setShowSelection}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                <span className="text-xs">Song-Auswahl ({pendingSongs.length} verfügbar)</span>
              </div>
              {showSelection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAll} className="text-xs h-7">
                Alle auswählen
              </Button>
              <Button size="sm" variant="ghost" onClick={deselectAll} className="text-xs h-7">
                Auswahl aufheben
              </Button>
            </div>

            {/* Tree view */}
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="space-y-1">
                {Object.entries(groupedByArtist).map(([artistId, artistData]) => (
                  <div key={artistId} className="space-y-1">
                    {/* Artist row */}
                    <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleArtist(artistId)}
                      >
                        {expandedArtists.has(artistId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Checkbox
                        checked={isArtistFullySelected(artistId)}
                        onCheckedChange={(checked) => selectAllFromArtist(artistId, !!checked)}
                      />
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{artistData.artistName}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {Object.values(artistData.albums).reduce((sum, a) => sum + a.songs.length, 0)}
                      </Badge>
                    </div>

                    {/* Albums */}
                    {expandedArtists.has(artistId) && (
                      <div className="ml-6 space-y-1">
                        {Object.entries(artistData.albums).map(([albumId, albumData]) => (
                          <div key={albumId} className="space-y-1">
                            {/* Album row */}
                            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleAlbum(albumId)}
                              >
                                {expandedAlbums.has(albumId) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Checkbox
                                checked={isAlbumFullySelected(albumId)}
                                onCheckedChange={(checked) => selectAllFromAlbum(albumId, !!checked)}
                              />
                              <Disc className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate">{albumData.albumName}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                {albumData.songs.length}
                              </Badge>
                            </div>

                            {/* Songs */}
                            {expandedAlbums.has(albumId) && (
                              <div className="ml-6 space-y-0.5">
                                {albumData.songs.map(song => (
                                  <div
                                    key={song.id}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50"
                                  >
                                    <Checkbox
                                      checked={selectedSongIds.has(song.id)}
                                      onCheckedChange={() => toggleSong(song.id)}
                                    />
                                    <Music className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm truncate">{song.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Failed Songs Section */}
      {failedSongs.length > 0 && (
        <Collapsible open={showFailed} onOpenChange={setShowFailed}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-red-500 hover:text-red-600">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Fehlgeschlagen ({failedSongs.length})</span>
              </div>
              {showFailed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <ScrollArea className="h-[150px] border border-red-500/20 rounded-md p-2 bg-red-500/5">
              <div className="space-y-2">
                {failedSongs.map(song => (
                  <div key={song.id} className="flex items-start gap-2 p-2 rounded bg-background/50">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artistName}</p>
                      <p className="text-xs text-red-500">{song.errorMessage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={retryFailedSongs}
                className="flex-1 text-xs"
                disabled={status !== "idle"}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Erneut versuchen
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={clearFailedSongs}
                className="text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Löschen
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Progress Section */}
      {(status !== "idle" || progress.current > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-mono">{progress.current}/{progress.total}</span>
          </div>
          
          <Progress value={progressPercent} className="h-2" />
          
          {progress.currentSong && status === "running" && (
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <Music className="h-4 w-4 text-muted-foreground shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{progress.currentSong}</p>
                <p className="text-xs text-muted-foreground truncate">{progress.currentArtist}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>~{formatTime(progress.estimatedRemaining)}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-green-500/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600">{progress.successCount}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600">{progress.errorCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {status === "idle" && (
          <Button 
            onClick={handleStart} 
            className="flex-1 gradient-gold"
            disabled={selectedSongIds.size === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {selectedSongIds.size} Songs abrufen
          </Button>
        )}
        
        {status === "running" && (
          <>
            <Button 
              onClick={handlePause} 
              variant="outline" 
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pausieren
            </Button>
            <Button 
              onClick={handleStop} 
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stoppen
            </Button>
          </>
        )}
        
        {status === "paused" && (
          <>
            <Button 
              onClick={handleStart} 
              className="flex-1 gradient-gold"
            >
              <Play className="h-4 w-4 mr-2" />
              Fortsetzen
            </Button>
            <Button 
              onClick={handleStop} 
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stoppen
            </Button>
          </>
        )}
        
        {status === "stopped" && (
          <Button 
            onClick={() => {
              setStatus("idle");
              setProgress(prev => ({ ...prev, current: 0, total: 0 }));
            }} 
            className="flex-1"
            variant="outline"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Zurücksetzen
          </Button>
        )}
      </div>

      {/* Rate Limit Info */}
      <p className="text-[10px] text-muted-foreground text-center">
        Suno API: max. 20 Anfragen / 10 Sek. • Feste Verzögerung: 500ms
      </p>
    </div>
  );
});

BulkGenerationPanel.displayName = "BulkGenerationPanel";

export { BulkGenerationPanel };
