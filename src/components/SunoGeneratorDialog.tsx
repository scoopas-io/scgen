import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Music, Disc, User, Play, Pause, Download, Loader2, 
  CheckCircle2, XCircle, Clock, Volume2, ChevronDown, ChevronRight,
  ArrowUpDown, RefreshCw
} from "lucide-react";

interface Artist {
  id: string;
  name: string;
  genre: string;
  style: string;
  voice_prompt: string;
  personality: string;
}

interface Album {
  id: string;
  name: string;
  artist_id: string;
}

interface Song {
  id: string;
  name: string;
  album_id: string;
  bpm: number | null;
  tonart: string | null;
  audio_url: string | null;
  generation_status: string | null;
  suno_task_id: string | null;
  created_at?: string;
}

interface SongWithDetails extends Song {
  artistName: string;
  artistId: string;
  albumName: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
}

type SortOption = "name" | "artist" | "genre" | "date";
type SortDirection = "asc" | "desc";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SunoGeneratorDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [songs, setSongs] = useState<SongWithDetails[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  // Workaround for occasional type-server desyncs; keep runtime behavior identical.
  const db = supabase as any;

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Setup realtime subscription for song updates
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel('songs-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'songs',
        },
        (payload) => {
          console.log('Song updated:', payload);
          const updatedSong = payload.new as Song;
          
          // Update the song in local state
          setSongs(prev => prev.map(s => {
            if (s.id === updatedSong.id) {
              return {
                ...s,
                audio_url: updatedSong.audio_url,
                generation_status: updatedSong.generation_status,
                suno_task_id: updatedSong.suno_task_id,
              };
            }
            return s;
          }));

          // Show toast when song is completed
          if (updatedSong.generation_status === 'completed' && updatedSong.audio_url) {
            toast.success(`Song "${updatedSong.name}" ist fertig!`, {
              action: {
                label: "Abspielen",
                onClick: () => {
                  if (audioRef.current) audioRef.current.pause();
                  audioRef.current = new Audio(updatedSong.audio_url!);
                  audioRef.current.play();
                  setCurrentlyPlaying(updatedSong.id);
                },
              },
            });
          } else if (updatedSong.generation_status === 'error') {
            toast.error(`Fehler bei "${updatedSong.name}"`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open]);

  const mapSongsWithDetails = (
    songsData: Song[] | null | undefined,
    artistsData: Artist[] | null | undefined,
    albumsData: Album[] | null | undefined
  ): SongWithDetails[] => {
    return (songsData || []).map((song) => {
      const album = albumsData?.find((a) => a.id === song.album_id);
      const artist = artistsData?.find((a) => a.id === album?.artist_id);
      return {
        ...song,
        artistId: artist?.id || "",
        artistName: artist?.name || "Unknown",
        albumName: album?.name || "Unknown",
        genre: artist?.genre || "",
        style: artist?.style || "",
        voicePrompt: artist?.voice_prompt || "",
        personality: artist?.personality || "",
      };
    });
  };

  const refreshSongs = async (opts?: { silent?: boolean }) => {
    // If base data isn't loaded yet, fall back to full load.
    if (artists.length === 0 || albums.length === 0) {
      await loadData();
      return;
    }

    try {
      const { data: songsData } = await supabase
        .from("songs")
        .select("id, name, album_id, bpm, tonart, audio_url, generation_status, suno_task_id, created_at")
        .order("track_number");

      setSongs(mapSongsWithDetails(songsData as Song[] | null | undefined, artists, albums));
    } catch (error) {
      console.error("Error refreshing songs:", error);
      if (!opts?.silent) toast.error("Fehler beim Aktualisieren der Songs");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all artists
      const { data: artistsData } = await supabase
        .from("artists")
        .select("id, name, genre, style, voice_prompt, personality")
        .order("name");

      // Load all albums
      const { data: albumsData } = await supabase
        .from("albums")
        .select("id, name, artist_id")
        .order("name");

      // Load all songs with their relationships
      const { data: songsData } = await supabase
        .from("songs")
        .select("id, name, album_id, bpm, tonart, audio_url, generation_status, suno_task_id, created_at")
        .order("track_number");

      setArtists(artistsData || []);
      setAlbums(albumsData || []);

      setSongs(mapSongsWithDetails(songsData as Song[] | null | undefined, artistsData, albumsData));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const librarySongs = useMemo(() => {
    // Show items that are already playable OR have a generation job in progress/completed/error.
    return songs.filter((s) => {
      if (s.audio_url) return true;
      if (s.suno_task_id) return true;
      return s.generation_status === "processing" || s.generation_status === "generating" || s.generation_status === "completed" || s.generation_status === "error";
    });
  }, [songs]);

  const hasInFlightGenerations = useMemo(() => {
    return librarySongs.some((s) => {
      if (s.audio_url) return false;
      const status = s.generation_status;
      if (status === "completed" || status === "error") return false;
      return Boolean(s.suno_task_id) || status === "processing" || status === "generating" || status === "pending";
    });
  }, [librarySongs]);

  // Auto-refresh while there are in-flight generations (works even if realtime isn't enabled)
  useEffect(() => {
    if (!open) return;

    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (!hasInFlightGenerations) return;

    pollIntervalRef.current = window.setInterval(() => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      refreshSongs({ silent: true }).finally(() => {
        refreshInFlightRef.current = false;
      });
    }, 8000);

    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [open, hasInFlightGenerations]);

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
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const selectAllFromArtist = (artistId: string) => {
    const artistAlbums = albums.filter(a => a.artist_id === artistId);
    const artistSongs = songs.filter(s => artistAlbums.some(a => a.id === s.album_id));
    const newSelected = new Set(selectedSongs);
    artistSongs.forEach(s => newSelected.add(s.id));
    setSelectedSongs(newSelected);
  };

  const selectAllFromAlbum = (albumId: string) => {
    const albumSongs = songs.filter(s => s.album_id === albumId);
    const newSelected = new Set(selectedSongs);
    albumSongs.forEach(s => newSelected.add(s.id));
    setSelectedSongs(newSelected);
  };

  const generateSelected = async () => {
    if (selectedSongs.size === 0) {
      toast.warning("Bitte wähle mindestens einen Song aus");
      return;
    }

    setGenerating(true);
    setGenerationProgress(0);

    const songsToGenerate = songs.filter(s => selectedSongs.has(s.id));
    let completed = 0;

    for (const song of songsToGenerate) {
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
            }),
          }
        );

        const result = await response.json();
        
        if (result.success) {
          // Update local state
          setSongs(prev => prev.map(s => 
            s.id === song.id 
              ? { ...s, generation_status: result.status, suno_task_id: result.taskId }
              : s
          ));
          toast.success(`${song.name} - Generierung gestartet`);
        } else {
          toast.error(`${song.name} - Fehler: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error generating ${song.name}:`, error);
        toast.error(`${song.name} - Verbindungsfehler`);
      }

      completed++;
      setGenerationProgress((completed / songsToGenerate.length) * 100);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setGenerating(false);
    setSelectedSongs(new Set());
    toast.success("Generierung abgeschlossen!");
    loadData(); // Refresh data
  };

  const playAudio = (songId: string, audioUrl: string) => {
    if (currentlyPlaying === songId) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setCurrentlyPlaying(null);
      setCurrentlyPlaying(songId);
    }
  };

  const downloadAudio = (audioUrl: string, songName: string) => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${songName}.mp3`;
    link.click();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Fertig</Badge>;
      case "processing":
      case "generating":
        return <Badge className="bg-blue-500/20 text-blue-400"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generiert...</Badge>;
      case "error":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Fehler</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Ausstehend</Badge>;
    }
  };

  const getArtistAlbums = (artistId: string) => albums.filter(a => a.artist_id === artistId);
  const getAlbumSongs = (albumId: string) => songs.filter(s => s.album_id === albumId);

  // Sorted and filtered library songs
  const sortedLibrarySongs = useMemo(() => {
    const generated = [...librarySongs];
    
    return generated.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "artist":
          comparison = a.artistName.localeCompare(b.artistName);
          break;
        case "genre":
          comparison = a.genre.localeCompare(b.genre);
          break;
        case "date":
        default:
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [librarySongs, sortBy, sortDirection]);

  const generatedSongs = librarySongs.filter(s => s.audio_url);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSongs();
    setIsRefreshing(false);
    toast.success("Bibliothek aktualisiert");
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-xl">SUNO Audio Generator</span>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Generiere echte Musik aus deinem Katalog mit KI
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="select" className="flex-1">
          <div className="px-6 pt-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="select" className="flex items-center gap-2">
                <Music className="h-4 w-4" /> Songs auswählen
              </TabsTrigger>
              <TabsTrigger value="library" className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Audio Bibliothek ({generatedSongs.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[55vh] px-6 py-4">
            {/* Selection Tab */}
            <TabsContent value="select" className="mt-0 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Generation Progress */}
                  {generating && (
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-primary font-medium">Generiere Songs...</span>
                        <span>{Math.round(generationProgress)}%</span>
                      </div>
                      <Progress value={generationProgress} className="h-2" />
                    </div>
                  )}

                  {/* Selection Summary */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {selectedSongs.size} Songs ausgewählt
                    </span>
                    <Button 
                      onClick={generateSelected} 
                      disabled={generating || selectedSongs.size === 0}
                      className="gradient-gold"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Volume2 className="h-4 w-4 mr-2" />
                      )}
                      Generieren
                    </Button>
                  </div>

                  {/* Artist Tree */}
                  <div className="space-y-2">
                    {artists.map(artist => (
                      <div key={artist.id} className="border rounded-lg overflow-hidden">
                        <div 
                          className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleArtist(artist.id)}
                        >
                          {expandedArtists.has(artist.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium">{artist.name}</span>
                          <Badge variant="outline" className="text-xs">{artist.genre}</Badge>
                          <div className="ml-auto">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); selectAllFromArtist(artist.id); }}
                            >
                              Alle auswählen
                            </Button>
                          </div>
                        </div>

                        {expandedArtists.has(artist.id) && (
                          <div className="pl-6 pb-2">
                            {getArtistAlbums(artist.id).map(album => (
                              <div key={album.id} className="mt-2">
                                <div 
                                  className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30 rounded"
                                  onClick={() => toggleAlbum(album.id)}
                                >
                                  {expandedAlbums.has(album.id) ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <Disc className="h-3 w-3 text-primary" />
                                  <span className="text-sm">{album.name}</span>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 text-xs ml-auto"
                                    onClick={(e) => { e.stopPropagation(); selectAllFromAlbum(album.id); }}
                                  >
                                    Album auswählen
                                  </Button>
                                </div>

                                {expandedAlbums.has(album.id) && (
                                  <div className="pl-6 space-y-1 mt-1">
                                    {getAlbumSongs(album.id).map(song => (
                                      <div 
                                        key={song.id} 
                                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/30"
                                      >
                                        <Checkbox 
                                          checked={selectedSongs.has(song.id)}
                                          onCheckedChange={() => toggleSong(song.id)}
                                        />
                                        <Music className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-sm flex-1">{song.name}</span>
                                        {getStatusBadge(song.generation_status)}
                                        {song.audio_url && (
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-6 w-6"
                                            onClick={() => playAudio(song.id, song.audio_url!)}
                                          >
                                            {currentlyPlaying === song.id ? (
                                              <Pause className="h-3 w-3" />
                                            ) : (
                                              <Play className="h-3 w-3" />
                                            )}
                                          </Button>
                                        )}
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
                </>
              )}
            </TabsContent>

            {/* Library Tab */}
            <TabsContent value="library" className="mt-0 space-y-3">
              {librarySongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Volume2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg">Noch keine Songs generiert</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Wähle Songs aus und generiere sie mit SUNO
                  </p>
                </div>
              ) : (
                <>
                  {/* Sort Controls */}
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Sortieren:</span>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Datum</SelectItem>
                          <SelectItem value="name">Titel</SelectItem>
                          <SelectItem value="artist">Künstler</SelectItem>
                          <SelectItem value="genre">Genre</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={toggleSortDirection}
                        className="h-8 px-2"
                      >
                        {sortDirection === "asc" ? "↑ A-Z" : "↓ Z-A"}
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="h-8"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Aktualisieren
                    </Button>
                  </div>

                  {/* Song List */}
                  {sortedLibrarySongs.map(song => (
                    <div 
                      key={song.id} 
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                    >
                      {song.audio_url ? (
                        <Button 
                          size="icon" 
                          variant={currentlyPlaying === song.id ? "default" : "outline"}
                          onClick={() => playAudio(song.id, song.audio_url!)}
                        >
                          {currentlyPlaying === song.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <div className="w-10 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{song.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {song.artistName} • {song.albumName}
                        </p>
                        {!song.audio_url && (
                          <div className="mt-1">{getStatusBadge(song.generation_status)}</div>
                        )}
                      </div>
                      <Badge variant="outline">{song.genre}</Badge>
                      {song.audio_url ? (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => downloadAudio(song.audio_url!, song.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div className="w-10" />
                      )}
                    </div>
                  ))}
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
