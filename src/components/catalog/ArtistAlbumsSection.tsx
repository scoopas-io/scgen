import { memo, useState, useCallback, useMemo } from "react";
import { Disc, Play, Pause, Loader2, Download, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer, Track } from "@/contexts/AudioPlayerContext";
import { toast } from "sonner";

interface Song {
  id: string;
  name: string;
  track_number?: number;
  bpm?: number;
  tonart?: string;
  audio_url?: string | null;
  generation_status?: string | null;
  suno_task_id?: string | null;
}

interface Album {
  id: string;
  name: string;
  release_date?: string;
  songs: Song[];
}

interface ArtistAlbumsSectionProps {
  artistId: string;
  artistName: string;
  artistImageUrl?: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
  albums: Album[];
  onRefresh?: () => void;
}

export const ArtistAlbumsSection = memo(({
  artistId,
  artistName,
  artistImageUrl,
  genre,
  style,
  voicePrompt,
  personality,
  albums,
  onRefresh,
}: ArtistAlbumsSectionProps) => {
  const { play, pause, resume, currentTrack, isPlaying, addToQueue, clearQueue } = useAudioPlayer();
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [generatingSongs, setGeneratingSongs] = useState<Set<string>>(new Set());
  const [generatingAlbums, setGeneratingAlbums] = useState<Set<string>>(new Set());
  const [albumProgress, setAlbumProgress] = useState<Map<string, { current: number; total: number }>>(new Map());
  const [detailedSongs, setDetailedSongs] = useState<Map<string, Song>>(new Map());

  const toggleAlbum = useCallback((albumId: string) => {
    setExpandedAlbums(prev => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
        // Load detailed song info when expanding
        loadAlbumSongs(albumId);
      }
      return next;
    });
  }, []);

  const loadAlbumSongs = async (albumId: string) => {
    const { data: songs } = await supabase
      .from("songs")
      .select("id, name, track_number, bpm, tonart, audio_url, generation_status, suno_task_id")
      .eq("album_id", albumId)
      .order("track_number", { ascending: true });

    if (songs) {
      setDetailedSongs(prev => {
        const next = new Map(prev);
        songs.forEach(song => next.set(song.id, song));
        return next;
      });
    }
  };

  const getSongDetails = (song: Song): Song => {
    return detailedSongs.get(song.id) || song;
  };

  const handlePlaySong = useCallback((song: Song, album: Album) => {
    const details = getSongDetails(song);
    if (!details.audio_url) return;

    if (currentTrack?.audioUrl === details.audio_url) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }

    play({
      id: song.id,
      title: song.name,
      artist: artistName,
      artistImageUrl,
      album: album.name,
      audioUrl: details.audio_url,
      songId: song.id,
      artistId,
      albumId: album.id,
    });
  }, [currentTrack, isPlaying, pause, resume, play, artistName, artistImageUrl, artistId]);

  const handlePlayAlbum = useCallback((album: Album) => {
    const songsWithAudio = album.songs
      .map(s => getSongDetails(s))
      .filter(s => s.audio_url);

    if (songsWithAudio.length === 0) {
      toast.warning("Keine Songs mit Audio verfügbar");
      return;
    }

    clearQueue();
    
    // Play first song
    const firstSong = songsWithAudio[0];
    play({
      id: firstSong.id,
      title: firstSong.name,
      artist: artistName,
      artistImageUrl,
      album: album.name,
      audioUrl: firstSong.audio_url!,
      songId: firstSong.id,
      artistId,
      albumId: album.id,
    });

    // Add rest to queue
    songsWithAudio.slice(1).forEach(song => {
      addToQueue({
        id: song.id,
        title: song.name,
        artist: artistName,
        artistImageUrl,
        album: album.name,
        audioUrl: song.audio_url!,
        songId: song.id,
        artistId,
        albumId: album.id,
      });
    });

    toast.success(`${songsWithAudio.length} Songs zur Wiedergabe hinzugefügt`);
  }, [clearQueue, play, addToQueue, artistName, artistImageUrl, artistId]);

  const generateSong = async (song: Song, album: Album) => {
    setGeneratingSongs(prev => new Set(prev).add(song.id));

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
            genre,
            style,
            voicePrompt,
            personality,
            bpm: song.bpm,
            tonart: song.tonart,
            artistName,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update local state
        setDetailedSongs(prev => {
          const next = new Map(prev);
          next.set(song.id, {
            ...getSongDetails(song),
            generation_status: result.status,
            suno_task_id: result.taskId,
          });
          return next;
        });

        toast.success(`"${song.name}" wird abgerufen...`, {
          description: "Song wird konvertiert und geladen",
        });

        // Start polling for this song
        pollSongStatus(song.id, album);
      } else {
        toast.error(`Fehler: ${result.error}`);
      }
    } catch (error) {
      console.error("Error generating song:", error);
      toast.error("Verbindungsfehler");
    } finally {
      setGeneratingSongs(prev => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  };

  const pollSongStatus = async (songId: string, album: Album) => {
    const maxAttempts = 60; // 5 minutes with 5s intervals
    let attempts = 0;

    const poll = async () => {
      const { data: song } = await supabase
        .from("songs")
        .select("id, name, audio_url, generation_status")
        .eq("id", songId)
        .maybeSingle();

      if (song) {
        setDetailedSongs(prev => {
          const next = new Map(prev);
          const existing = next.get(songId) || { id: songId, name: song.name };
          next.set(songId, {
            ...existing,
            audio_url: song.audio_url,
            generation_status: song.generation_status,
          });
          return next;
        });

        if (song.audio_url && song.generation_status === "completed") {
          // Automatically add to queue
          addToQueue({
            id: song.id,
            title: song.name,
            artist: artistName,
            artistImageUrl,
            album: album.name,
            audioUrl: song.audio_url!,
            songId: song.id,
            artistId,
            albumId: album.id,
          });
          
          toast.success(`"${song.name}" bereit`, {
            description: "Zur Playlist hinzugefügt",
          });
          onRefresh?.();
          return;
        }

        if (song.generation_status === "error") {
          toast.error(`Fehler bei "${song.name}"`);
          return;
        }
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      }
    };

    setTimeout(poll, 5000);
  };

  const generateAlbum = async (album: Album) => {
    const songsWithoutAudio = album.songs
      .map(s => getSongDetails(s))
      .filter(s => !s.audio_url && s.generation_status !== "processing" && s.generation_status !== "generating");

    if (songsWithoutAudio.length === 0) {
      toast.info("Alle Songs dieses Albums wurden bereits abgerufen");
      return;
    }

    setGeneratingAlbums(prev => new Set(prev).add(album.id));
    setAlbumProgress(prev => new Map(prev).set(album.id, { current: 0, total: songsWithoutAudio.length }));

    toast.info(`${songsWithoutAudio.length} Songs werden abgerufen...`);

    // Generate songs sequentially with delay to avoid rate limiting
    for (let i = 0; i < songsWithoutAudio.length; i++) {
      const song = songsWithoutAudio[i];
      setAlbumProgress(prev => new Map(prev).set(album.id, { current: i + 1, total: songsWithoutAudio.length }));
      await generateSong(song, album);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setGeneratingAlbums(prev => {
      const next = new Set(prev);
      next.delete(album.id);
      return next;
    });
    setAlbumProgress(prev => {
      const next = new Map(prev);
      next.delete(album.id);
      return next;
    });
  };

  // Get currently loading songs for display
  const loadingSongs = useMemo(() => {
    return albums.flatMap(album => 
      album.songs
        .map(s => ({ ...getSongDetails(s), albumName: album.name }))
        .filter(s => generatingSongs.has(s.id) || s.generation_status === "processing" || s.generation_status === "generating")
    );
  }, [albums, generatingSongs, detailedSongs]);

  const totalSongs = albums.reduce((acc, album) => acc + album.songs.length, 0);
  const songsWithAudio = albums.reduce((acc, album) => 
    acc + album.songs.filter(s => getSongDetails(s).audio_url).length, 0
  );

  return (
    <div className="space-y-4">
      {/* Loading Queue Display */}
      {loadingSongs.length > 0 && (
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Wird geladen ({loadingSongs.length} {loadingSongs.length === 1 ? 'Song' : 'Songs'})
          </p>
          <div className="space-y-1.5">
            {loadingSongs.slice(0, 5).map(song => (
              <div key={song.id} className="flex items-center gap-2 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="truncate flex-1">{song.name}</span>
                <span className="text-muted-foreground shrink-0">{song.albumName}</span>
              </div>
            ))}
            {loadingSongs.length > 5 && (
              <p className="text-[10px] text-muted-foreground">
                + {loadingSongs.length - 5} weitere...
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
          <Disc className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Alben & Songs
          <Badge variant="outline" className="text-[10px] sm:text-xs">
            {albums.length} Alben • {songsWithAudio}/{totalSongs} Songs
          </Badge>
        </h4>

      <div className="space-y-2">
        {albums.map(album => {
          const isExpanded = expandedAlbums.has(album.id);
          const albumSongsWithAudio = album.songs.filter(s => getSongDetails(s).audio_url).length;
          const allGenerated = albumSongsWithAudio === album.songs.length;
          const isGeneratingAlbum = generatingAlbums.has(album.id);

          return (
            <div key={album.id} className="border border-border rounded-lg overflow-hidden bg-card/30">
              {/* Album Header */}
              <div className="flex items-center gap-2 p-2.5 sm:p-3">
                <button
                  onClick={() => toggleAlbum(album.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <div className={cn(
                    "transition-transform duration-200 shrink-0",
                    isExpanded && "rotate-90"
                  )}>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="h-8 w-8 rounded bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                    <Disc className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{album.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {album.songs.length} Songs • {albumSongsWithAudio} abgerufen
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  {albumSongsWithAudio > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePlayAlbum(album)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                {!allGenerated && (
                  <div className="flex items-center gap-2">
                    {isGeneratingAlbum && albumProgress.get(album.id) && (
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress 
                          value={(albumProgress.get(album.id)!.current / albumProgress.get(album.id)!.total) * 100} 
                          className="h-1.5 w-16"
                        />
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {Math.round((albumProgress.get(album.id)!.current / albumProgress.get(album.id)!.total) * 100)}%
                        </span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => generateAlbum(album)}
                      disabled={isGeneratingAlbum}
                    >
                      {isGeneratingAlbum ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>Album laden</>
                      )}
                    </Button>
                  </div>
                )}
                </div>
              </div>

              {/* Songs List */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/30 divide-y divide-border/50">
                  {album.songs.map(song => {
                    const details = getSongDetails(song);
                    const hasAudio = Boolean(details.audio_url);
                    const isGenerating = generatingSongs.has(song.id) || 
                      details.generation_status === "processing" || 
                      details.generation_status === "generating";
                    const isCurrentTrack = currentTrack?.audioUrl === details.audio_url;

                    return (
                      <div
                        key={song.id}
                        className={cn(
                          "flex items-center gap-2 p-2 pl-10 sm:pl-12 group",
                          isCurrentTrack && "bg-primary/10"
                        )}
                      >
                        <span className="text-[10px] sm:text-xs text-muted-foreground w-5 text-right tabular-nums shrink-0">
                          {song.track_number || "-"}
                        </span>
                        
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs sm:text-sm truncate",
                            isCurrentTrack && "text-primary font-medium"
                          )}>
                            {song.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {details.bpm && <span>{details.bpm} BPM</span>}
                            {details.tonart && <span>{details.tonart}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {hasAudio ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handlePlaySong(song, album)}
                              >
                                {isCurrentTrack && isPlaying ? (
                                  <Pause className="h-3.5 w-3.5" />
                                ) : (
                                  <Play className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = details.audio_url!;
                                  link.download = `${song.name}.mp3`;
                                  link.click();
                                }}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : isGenerating ? (
                            <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Lädt...
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] sm:text-xs px-2"
                              onClick={() => generateSong(song, album)}
                            >
                              Abrufen
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
});

ArtistAlbumsSection.displayName = "ArtistAlbumsSection";
