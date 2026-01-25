import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { 
  Music, Disc, User, Play, Pause, Download, Loader2, 
  CheckCircle2, XCircle, Clock, Volume2, ChevronDown, ChevronRight,
  ArrowUpDown, RefreshCw, Timer, AlertCircle
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

const AudioGenerator = () => {
  const [loading, setLoading] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [songs, setSongs] = useState<SongWithDetails[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [expandedLibraryArtists, setExpandedLibraryArtists] = useState<Set<string>>(new Set());
  const [expandedLibraryAlbums, setExpandedLibraryAlbums] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generationState, setGenerationState] = useState<{
    currentSong: string;
    currentArtist: string;
    completed: number;
    total: number;
    startTime: number | null;
    successCount: number;
    errorCount: number;
  }>({
    currentSong: "",
    currentArtist: "",
    completed: 0,
    total: 0,
    startTime: null,
    successCount: 0,
    errorCount: 0,
  });
  const [generationProgress, setGenerationProgress] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0 });
  const pollIntervalRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  
  // Global audio player
  const { play, pause, resume, currentTrack, isPlaying } = useAudioPlayer();

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  const loadStats = async () => {
    const [artistsRes, albumsRes, songsRes] = await Promise.all([
      supabase.from("artists").select("id", { count: "exact", head: true }),
      supabase.from("albums").select("id", { count: "exact", head: true }),
      supabase.from("songs").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      artists: artistsRes.count || 0,
      albums: albumsRes.count || 0,
      songs: songsRes.count || 0,
    });
  };

  // Setup realtime subscription for song updates
  useEffect(() => {
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

          if (updatedSong.generation_status === 'completed' && updatedSong.audio_url) {
            // Find the song details to get artist name
            const songWithDetails = songs.find(s => s.id === updatedSong.id);
            toast.success(`Song "${updatedSong.name}" ist fertig!`, {
              action: {
                label: "Abspielen",
                onClick: () => {
                  play({
                    id: updatedSong.id,
                    title: updatedSong.name,
                    artist: songWithDetails?.artistName || 'Unbekannt',
                    album: songWithDetails?.albumName,
                    audioUrl: updatedSong.audio_url!,
                  });
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
  }, []);

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
      const { data: artistsData } = await supabase
        .from("artists")
        .select("id, name, genre, style, voice_prompt, personality")
        .order("name");

      const { data: albumsData } = await supabase
        .from("albums")
        .select("id, name, artist_id")
        .order("name");

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
    return songs.filter((s) => {
      if (s.audio_url) return true;
      if (s.suno_task_id) return true;
      const status = s.generation_status;
      return status === "processing" || status === "generating";
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

  useEffect(() => {
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
  }, [hasInFlightGenerations]);

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
    const startTime = Date.now();
    let completed = 0;
    let successCount = 0;
    let errorCount = 0;

    setGenerationState({
      currentSong: "",
      currentArtist: "",
      completed: 0,
      total: songsToGenerate.length,
      startTime,
      successCount: 0,
      errorCount: 0,
    });

    for (const song of songsToGenerate) {
      setGenerationState(prev => ({
        ...prev,
        currentSong: song.name,
        currentArtist: song.artistName,
        completed,
      }));

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
          setSongs(prev => prev.map(s => 
            s.id === song.id 
              ? { ...s, generation_status: result.status, suno_task_id: result.taskId }
              : s
          ));
          successCount++;
        } else {
          errorCount++;
          toast.error(`${song.name} - Fehler: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error generating ${song.name}:`, error);
        errorCount++;
        toast.error(`${song.name} - Verbindungsfehler`);
      }

      completed++;
      setGenerationProgress((completed / songsToGenerate.length) * 100);
      setGenerationState(prev => ({
        ...prev,
        completed,
        successCount,
        errorCount,
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setGenerating(false);
    setSelectedSongs(new Set());
    
    if (errorCount === 0) {
      toast.success(`${successCount} Songs zur Generierung gesendet!`);
    } else {
      toast.warning(`${successCount} erfolgreich, ${errorCount} fehlgeschlagen`);
    }
    loadData();
  };

  const playAudio = (song: SongWithDetails) => {
    if (!song.audio_url) return;
    
    // Toggle pause/resume if same track
    if (currentTrack?.id === song.id) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }
    
    // Play new track
    play({
      id: song.id,
      title: song.name,
      artist: song.artistName,
      album: song.albumName,
      audioUrl: song.audio_url,
    });
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
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400 animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Audio wird generiert
            </Badge>
            <span className="text-xs text-muted-foreground">~2-3 Min</span>
          </div>
        );
      case "error":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Fehler</Badge>;
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            In Warteschlange
          </Badge>
        );
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Bereit</Badge>;
    }
  };

  const getArtistAlbums = (artistId: string) => albums.filter(a => a.artist_id === artistId);
  const getAlbumSongs = (albumId: string) => songs.filter(s => s.album_id === albumId);

  const groupedLibrarySongs = useMemo(() => {
    const artistMap: Record<string, {
      artist: { id: string; name: string; genre: string };
      albums: Record<string, { album: { id: string; name: string }; songs: SongWithDetails[] }>;
    }> = {};

    librarySongs.forEach(song => {
      if (!artistMap[song.artistId]) {
        artistMap[song.artistId] = {
          artist: { id: song.artistId, name: song.artistName, genre: song.genre },
          albums: {},
        };
      }
      if (!artistMap[song.artistId].albums[song.album_id]) {
        artistMap[song.artistId].albums[song.album_id] = {
          album: { id: song.album_id, name: song.albumName },
          songs: [],
        };
      }
      artistMap[song.artistId].albums[song.album_id].songs.push(song);
    });

    Object.values(artistMap).forEach(artistData => {
      Object.values(artistData.albums).forEach(albumData => {
        albumData.songs.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case "name":
              comparison = a.name.localeCompare(b.name);
              break;
            case "date":
            default:
              comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
              break;
          }
          return sortDirection === "asc" ? comparison : -comparison;
        });
      });
    });

    const artistArray = Object.values(artistMap);
    artistArray.sort((a, b) => {
      if (sortBy === "artist" || sortBy === "genre") {
        const comparison = sortBy === "artist"
          ? a.artist.name.localeCompare(b.artist.name)
          : a.artist.genre.localeCompare(b.artist.genre);
        return sortDirection === "asc" ? comparison : -comparison;
      }
      return a.artist.name.localeCompare(b.artist.name);
    });

    return artistArray;
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
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader stats={stats} />

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container h-full py-6">
          <div className="h-full flex flex-col">
            {/* Page Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-full gradient-gold flex items-center justify-center">
                <Volume2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">scoopas Audio Generator</h1>
                <p className="text-sm text-muted-foreground">
                  Generiere echte Musik aus deinem Katalog mit scoopas.AI
                </p>
              </div>
            </div>

            <Tabs defaultValue="select" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full max-w-md grid grid-cols-2 mb-4">
                <TabsTrigger value="select" className="flex items-center gap-2">
                  <Music className="h-4 w-4" /> Songs auswählen
                </TabsTrigger>
                <TabsTrigger value="library" className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" /> Audio Bibliothek ({generatedSongs.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                {/* Selection Tab */}
                <TabsContent value="select" className="mt-0 space-y-4 pr-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {/* Generation Progress */}
                      {generating && (
                        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="text-primary font-medium">Audio-Generierung läuft</span>
                            </div>
                            <span className="text-sm font-mono">{Math.round(generationProgress)}%</span>
                          </div>
                          
                          <Progress value={generationProgress} className="h-2" />
                          
                          {generationState.currentSong && (
                            <div className="flex items-center gap-3 p-2 rounded bg-background/50">
                              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{generationState.currentSong}</p>
                                <p className="text-xs text-muted-foreground truncate">{generationState.currentArtist}</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="flex items-center gap-1.5 p-2 rounded bg-background/50">
                              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>
                                {generationState.completed}/{generationState.total}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 p-2 rounded bg-green-500/10">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-green-600">{generationState.successCount} OK</span>
                            </div>
                            {generationState.errorCount > 0 && (
                              <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10">
                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                <span className="text-red-600">{generationState.errorCount} Fehler</span>
                              </div>
                            )}
                            {generationState.errorCount === 0 && (
                              <div className="flex items-center gap-1.5 p-2 rounded bg-background/50">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>
                                  ~{Math.ceil((generationState.total - generationState.completed) * 1.5)}s
                                </span>
                              </div>
                            )}
                          </div>
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
                                                className={`h-6 w-6 ${currentTrack?.id === song.id ? 'text-primary' : ''}`}
                                                onClick={() => playAudio(song)}
                                              >
                                                {currentTrack?.id === song.id && isPlaying ? (
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
                <TabsContent value="library" className="mt-0 space-y-3 pr-4">
                  {librarySongs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Volume2 className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg">Noch keine Songs generiert</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wähle Songs aus und generiere sie mit scoopas
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

                      {/* Grouped Song List by Artist and Album */}
                      <div className="space-y-3">
                        {groupedLibrarySongs.map(({ artist, albums }) => (
                          <div key={artist.id} className="border rounded-lg overflow-hidden">
                            <div 
                              className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
                              onClick={() => {
                                const newExpanded = new Set(expandedLibraryArtists);
                                if (newExpanded.has(artist.id)) {
                                  newExpanded.delete(artist.id);
                                } else {
                                  newExpanded.add(artist.id);
                                }
                                setExpandedLibraryArtists(newExpanded);
                              }}
                            >
                              {expandedLibraryArtists.has(artist.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-medium">{artist.name}</span>
                              <Badge variant="outline" className="text-xs">{artist.genre}</Badge>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {Object.values(albums).reduce((acc, a) => acc + a.songs.length, 0)} Songs
                              </span>
                            </div>

                            {expandedLibraryArtists.has(artist.id) && (
                              <div className="pl-4 pb-2">
                                {Object.values(albums).map(({ album, songs: albumSongs }) => (
                                  <div key={album.id} className="mt-2">
                                    <div 
                                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30 rounded"
                                      onClick={() => {
                                        const newExpanded = new Set(expandedLibraryAlbums);
                                        if (newExpanded.has(album.id)) {
                                          newExpanded.delete(album.id);
                                        } else {
                                          newExpanded.add(album.id);
                                        }
                                        setExpandedLibraryAlbums(newExpanded);
                                      }}
                                    >
                                      {expandedLibraryAlbums.has(album.id) ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                      )}
                                      <Disc className="h-3 w-3 text-primary" />
                                      <span className="text-sm">{album.name}</span>
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        {albumSongs.length} Songs
                                      </span>
                                    </div>

                                    {expandedLibraryAlbums.has(album.id) && (
                                      <div className="pl-6 space-y-1 mt-1">
                                        {albumSongs.map(song => (
                                          <div 
                                            key={song.id} 
                                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/30"
                                          >
                                            <Music className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-sm flex-1">{song.name}</span>
                                            {getStatusBadge(song.generation_status)}
                                            {song.audio_url && (
                                              <div className="flex items-center gap-1">
                                                <Button 
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className={`h-7 w-7 ${currentTrack?.id === song.id ? 'text-primary' : ''}`}
                                                  onClick={() => playAudio(song)}
                                                >
                                                  {currentTrack?.id === song.id && isPlaying ? (
                                                    <Pause className="h-3.5 w-3.5" />
                                                  ) : (
                                                    <Play className="h-3.5 w-3.5" />
                                                  )}
                                                </Button>
                                                <Button
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className="h-7 w-7"
                                                  onClick={() => downloadAudio(song.audio_url!, song.name)}
                                                >
                                                  <Download className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
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
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AudioGenerator;
