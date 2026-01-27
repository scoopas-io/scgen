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
import { useIsMobile } from "@/hooks/use-mobile";
import { useAudioGeneratorCache } from "@/hooks/useAudioGeneratorCache";
import { BulkGenerationPanel } from "@/components/BulkGenerationPanel";
import { DataLoadingProgress } from "@/components/DataLoadingProgress";
import { PersonaEditorDialog } from "@/components/PersonaEditorDialog";
import { PersonaBatchUpdateButton } from "@/components/PersonaBatchUpdateButton";
import { isInstrumentalGenre } from "@/lib/genreConfig";
import { 
  Music, Disc, User, Play, Pause, Download, Loader2, 
  CheckCircle2, XCircle, Clock, Volume2, ChevronDown, ChevronRight,
  ArrowUpDown, RefreshCw, Timer, AlertCircle, Zap, Database, Sparkles
} from "lucide-react";

interface Artist {
  id: string;
  name: string;
  genre: string;
  style: string;
  voice_prompt: string;
  personality: string;
  language?: string;
  // Persona fields
  vocal_gender?: string | null;
  vocal_texture?: string | null;
  vocal_range?: string | null;
  style_tags?: string[];
  mood_tags?: string[];
  negative_tags?: string[];
  default_bpm_min?: number | null;
  default_bpm_max?: number | null;
  preferred_keys?: string[];
  instrumental_only?: boolean;
  persona_name?: string | null;
  persona_description?: string | null;
  persona_active?: boolean;
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
  artistImageUrl?: string;
  albumName: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
  language?: string;
  // Persona fields for generation
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
  // Suno persona ID for consistent voice/style
  sunoPersonaId?: string | null;
}

type SortOption = "name" | "artist" | "genre" | "date";
type SortDirection = "asc" | "desc";

// Format cache age for display
const formatCacheAge = (ageMs: number): string => {
  const minutes = Math.floor(ageMs / 1000 / 60);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
};

const AudioGenerator = () => {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({
    phase: "init" as "init" | "artists" | "albums" | "songs" | "processing" | "done",
    current: 0,
    total: 0,
    startTime: null as number | null,
    phaseStartTime: null as number | null,
    artistsLoaded: 0,
    albumsLoaded: 0,
    songsLoaded: 0,
  });
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
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0 });
  const [personaEditorArtist, setPersonaEditorArtist] = useState<Artist | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  
  // Global audio player
  const { play, pause, resume, currentTrack, isPlaying, addToQueue, clearQueue } = useAudioPlayer();
  const isMobile = useIsMobile();
  const { loadFromCache, saveToCache, getCacheAge } = useAudioGeneratorCache();

  // Track whether we've already loaded data to prevent double-loading
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    
    // Try to load from cache first for instant display
    const cachedData = loadFromCache();
    
    if (cachedData && cachedData.songs.length > 0) {
      console.log("Loading from cache...");
      setArtists(cachedData.artists);
      setAlbums(cachedData.albums);
      setSongs(cachedData.songs);
      // Use stats from cache to keep counts stable
      setStats(cachedData.stats);
      setCacheAge(getCacheAge());
      setLoading(false);
      initialLoadDone.current = true;
      
      // Then refresh in background silently (without updating stats first)
      setIsBackgroundRefresh(true);
      loadDataDirect(true);
    } else {
      // No cache, load fresh - first get stats for progress display
      loadStats().then(() => {
        loadDataDirect(false);
      });
      initialLoadDone.current = true;
    }
  }, []);

  const loadStats = async () => {
    const [artistsRes, albumsRes, songsRes] = await Promise.all([
      supabase.from("artists").select("id", { count: "exact", head: true }),
      supabase.from("albums").select("id", { count: "exact", head: true }),
      supabase.from("songs").select("id", { count: "exact", head: true }),
    ]);
    const newStats = {
      artists: artistsRes.count || 0,
      albums: albumsRes.count || 0,
      songs: songsRes.count || 0,
    };
    setStats(newStats);
    
    // If everything is empty, still proceed
    if (newStats.artists === 0 && newStats.albums === 0 && newStats.songs === 0) {
      setLoading(false);
    }
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
                    artistImageUrl: songWithDetails?.artistImageUrl,
                    album: songWithDetails?.albumName,
                    audioUrl: updatedSong.audio_url!,
                    songId: updatedSong.id,
                    artistId: songWithDetails?.artistId,
                    albumId: updatedSong.album_id,
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
      
      // Only include persona data if persona is active
      const personaActive = artist?.persona_active !== false;
      
      return {
        ...song,
        artistId: artist?.id || "",
        artistName: artist?.name || "Unknown",
        artistImageUrl: (artist as any)?.profile_image_url,
        albumName: album?.name || "Unknown",
        genre: artist?.genre || "",
        style: artist?.style || "",
        voicePrompt: artist?.voice_prompt || "",
        personality: artist?.personality || "",
        language: artist?.language || "de",
        // Persona fields (only if active)
        vocalGender: personaActive ? artist?.vocal_gender : null,
        vocalTexture: personaActive ? artist?.vocal_texture : null,
        vocalRange: personaActive ? artist?.vocal_range : null,
        styleTags: personaActive ? artist?.style_tags : undefined,
        moodTags: personaActive ? artist?.mood_tags : undefined,
        negativeTags: personaActive ? artist?.negative_tags : undefined,
        defaultBpmMin: personaActive ? artist?.default_bpm_min : null,
        defaultBpmMax: personaActive ? artist?.default_bpm_max : null,
        preferredKeys: personaActive ? artist?.preferred_keys : undefined,
        instrumentalOnly: personaActive ? artist?.instrumental_only : undefined,
        // Suno persona ID for consistent voice/style across all songs
        sunoPersonaId: (artist as any)?.suno_persona_id || null,
      };
    });
  };

  const refreshSongs = async (opts?: { silent?: boolean }) => {
    if (artists.length === 0 || albums.length === 0) {
      await loadDataDirect();
      return;
    }

    try {
      // IMPORTANT: never replace the entire songs list here.
      // This function runs periodically and must not hit the 1000-row default limit.
      // We only refresh in-flight items and merge updates into existing state.
      const inFlightIds = songs
        .filter((s) => {
          if (s.audio_url) return false;
          const status = s.generation_status;
          if (status === "completed" || status === "error") return false;
          return Boolean(s.suno_task_id) || status === "processing" || status === "generating" || status === "pending";
        })
        .map((s) => s.id);

      if (inFlightIds.length === 0) return;

      const updatedRows: Song[] = [];
      const chunkSize = 200;
      for (let i = 0; i < inFlightIds.length; i += chunkSize) {
        const chunk = inFlightIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("songs")
          .select("id, name, album_id, bpm, tonart, audio_url, generation_status, suno_task_id, created_at")
          .in("id", chunk);

        if (error) throw error;
        if (data?.length) updatedRows.push(...(data as Song[]));
      }

      if (updatedRows.length === 0) return;

      const updateMap = new Map(updatedRows.map((row) => [row.id, row] as const));
      setSongs((prev) =>
        prev.map((s) => {
          const u = updateMap.get(s.id);
          if (!u) return s;
          // Merge only DB fields; keep artist/album mapping fields intact.
          return {
            ...s,
            ...u,
          };
        })
      );
    } catch (error) {
      console.error("Error refreshing songs:", error);
      if (!opts?.silent) toast.error("Fehler beim Aktualisieren der Songs");
    }
  };

  // Batch fetch helper with progress tracking
  const fetchAllWithProgress = async <T,>(
    table: "artists" | "albums" | "songs",
    select: string,
    orderBy: string,
    expectedTotal: number,
    onProgress: (loaded: number) => void,
    pageSize = 1000
  ): Promise<T[]> => {
    const all: T[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .order(orderBy)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      const batch = (data || []) as T[];
      all.push(...batch);
      onProgress(all.length);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return all;
  };

  // Direct load function that doesn't depend on stats state
  const loadDataDirect = async (isBackground = false) => {
    // Don't show loading UI for background refresh
    if (!isBackground) {
      setLoading(true);
    }
    
    const startTime = Date.now();
    
    // Get fresh stats for progress display (but don't update state if background)
    let currentStats = stats;
    if (!isBackground) {
      const [artistsRes, albumsRes, songsRes] = await Promise.all([
        supabase.from("artists").select("id", { count: "exact", head: true }),
        supabase.from("albums").select("id", { count: "exact", head: true }),
        supabase.from("songs").select("id", { count: "exact", head: true }),
      ]);
      currentStats = {
        artists: artistsRes.count || 0,
        albums: albumsRes.count || 0,
        songs: songsRes.count || 0,
      };
      setStats(currentStats);
    }
    
    if (!isBackground) {
      setLoadingProgress({
        phase: "init",
        current: 0,
        total: currentStats.artists + currentStats.albums + currentStats.songs,
        startTime,
        phaseStartTime: startTime,
        artistsLoaded: 0,
        albumsLoaded: 0,
        songsLoaded: 0,
      });
    }
    
    try {
      // Phase 1: Load Artists
      if (!isBackground) {
        setLoadingProgress(prev => ({ 
          ...prev, 
          phase: "artists", 
          phaseStartTime: Date.now() 
        }));
      }
      
      const artistsData = await fetchAllWithProgress<any>(
        "artists", 
        "id, name, genre, style, voice_prompt, personality, profile_image_url, language, vocal_gender, vocal_texture, vocal_range, style_tags, mood_tags, negative_tags, default_bpm_min, default_bpm_max, preferred_keys, instrumental_only, persona_name, persona_description, persona_active", 
        "name",
        currentStats.artists,
        isBackground ? () => {} : (loaded) => setLoadingProgress(prev => ({ 
          ...prev, 
          artistsLoaded: loaded,
          current: loaded 
        }))
      );
      setArtists(artistsData || []);
      
      // Phase 2: Load Albums
      if (!isBackground) {
        setLoadingProgress(prev => ({ 
          ...prev, 
          phase: "albums", 
          phaseStartTime: Date.now() 
        }));
      }
      
      const albumsData = await fetchAllWithProgress<any>(
        "albums", 
        "id, name, artist_id", 
        "name",
        currentStats.albums,
        isBackground ? () => {} : (loaded) => setLoadingProgress(prev => ({ 
          ...prev, 
          albumsLoaded: loaded,
          current: prev.artistsLoaded + loaded 
        }))
      );
      setAlbums(albumsData || []);
      
      // Phase 3: Load Songs
      if (!isBackground) {
        setLoadingProgress(prev => ({ 
          ...prev, 
          phase: "songs", 
          phaseStartTime: Date.now() 
        }));
      }
      
      const songsData = await fetchAllWithProgress<any>(
        "songs", 
        "id, name, album_id, bpm, tonart, audio_url, generation_status, suno_task_id, created_at", 
        "track_number",
        currentStats.songs,
        isBackground ? () => {} : (loaded) => setLoadingProgress(prev => ({ 
          ...prev, 
          songsLoaded: loaded,
          current: prev.artistsLoaded + prev.albumsLoaded + loaded 
        }))
      );
      
      // Phase 4: Process data
      if (!isBackground) {
        setLoadingProgress(prev => ({ 
          ...prev, 
          phase: "processing", 
          phaseStartTime: Date.now() 
        }));
      }
      
      const processedSongs = mapSongsWithDetails(songsData as Song[] | null | undefined, artistsData, albumsData);
      
      // Update stats only after all data is loaded to prevent jumps
      const newStats = {
        artists: artistsData?.length || 0,
        albums: albumsData?.length || 0,
        songs: processedSongs.length,
      };
      
      // Batch update all state together to prevent intermediate renders
      setArtists(artistsData || []);
      setAlbums(albumsData || []);
      setSongs(processedSongs);
      setStats(newStats);
      
      // Save to cache after successful load
      saveToCache(newStats, artistsData || [], albumsData || [], processedSongs);
      setCacheAge(null); // Fresh data, no cache age to show
      
      if (!isBackground) {
        setLoadingProgress(prev => ({ ...prev, phase: "done" }));
      } else {
        toast.success("Daten im Hintergrund aktualisiert", { duration: 2000 });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      if (!isBackground) {
        toast.error("Fehler beim Laden der Daten");
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
      setIsBackgroundRefresh(false);
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
              instrumental: song.instrumentalOnly ?? isInstrumentalGenre(song.genre),
              language: song.language,
              // Persona fields - now properly passed to API
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
              // Suno persona ID for consistent voice/style
              sunoPersonaId: song.sunoPersonaId,
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
    
    // Add all songs to queue after generation started
    const songsWithUrls = songsToGenerate.filter(s => s.audio_url);
    if (songsWithUrls.length > 0) {
      clearQueue();
      songsWithUrls.forEach(song => {
        addToQueue({
          id: song.id,
          title: song.name,
          artist: song.artistName,
          artistImageUrl: song.artistImageUrl,
          album: song.albumName,
          audioUrl: song.audio_url!,
          songId: song.id,
          artistId: song.artistId,
          albumId: song.album_id,
        });
      });
    }
    
    if (errorCount === 0) {
      toast.success(`${successCount} Songs werden abgerufen!`);
    } else {
      toast.warning(`${successCount} erfolgreich, ${errorCount} fehlgeschlagen`);
    }
    loadDataDirect();
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
    
    // Play new track with IDs for editing
    play({
      id: song.id,
      title: song.name,
      artist: song.artistName,
      artistImageUrl: song.artistImageUrl,
      album: song.albumName,
      audioUrl: song.audio_url,
      songId: song.id,
      artistId: song.artistId,
      albumId: song.album_id,
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

      <main className="flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">
        <div className="container h-full py-4 md:py-6 px-3 md:px-6">
          <div className="h-full flex flex-col">
            {/* Page Header - Responsive */}
            <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full gradient-gold flex items-center justify-center flex-shrink-0">
                <Volume2 className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl font-display font-bold truncate">scoopas Audio</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Rufe echte Musik aus deinem Katalog ab mit scoopas.AI
                </p>
              </div>
              
              {/* Cache Indicator */}
              {(cacheAge !== null || isBackgroundRefresh) && (
                <div className="flex items-center gap-2">
                  {isBackgroundRefresh ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span className="hidden sm:inline">Aktualisiere...</span>
                    </div>
                  ) : cacheAge !== null && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                      <Database className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        Cache: {formatCacheAge(cacheAge)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Tabs defaultValue="select" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full grid grid-cols-2 mb-3 md:mb-4 h-10 md:h-11">
                <TabsTrigger value="select" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm px-2 md:px-4">
                  <Music className="h-3.5 w-3.5 md:h-4 md:w-4" /> 
                  <span className="truncate">Auswählen</span>
                </TabsTrigger>
                <TabsTrigger value="library" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm px-2 md:px-4">
                  <Volume2 className="h-3.5 w-3.5 md:h-4 md:w-4" /> 
                  <span className="truncate">Bibliothek ({generatedSongs.length})</span>
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                {/* Selection Tab */}
                <TabsContent value="select" className="mt-0 space-y-4 pr-4">
                  {loading ? (
                    <DataLoadingProgress progress={loadingProgress} stats={stats} />
                  ) : (
                    <>
                      {/* Persona Batch Update + Bulk Generation Panel */}
                      <div className="flex items-center gap-3 mb-4">
                        <PersonaBatchUpdateButton onComplete={() => loadDataDirect(true)} />
                      </div>
                      
                      <BulkGenerationPanel
                        songs={songs}
                        onSongUpdate={(songId, updates) => {
                          setSongs(prev => prev.map(s => 
                            s.id === songId ? { ...s, ...updates } : s
                          ));
                        }}
                        onComplete={() => loadDataDirect()}
                      />

                      {/* Generation Progress */}
                      {generating && (
                        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="text-primary font-medium">Songs werden abgerufen</span>
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
                          
                          <div className="grid grid-cols-3 gap-1.5 md:gap-2 text-[10px] md:text-xs">
                            <div className="flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded bg-background/50">
                              <Timer className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">
                                {generationState.completed}/{generationState.total}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded bg-green-500/10">
                              <CheckCircle2 className="h-3 w-3 md:h-3.5 md:w-3.5 text-green-500 flex-shrink-0" />
                              <span className="text-green-600 truncate">{generationState.successCount} OK</span>
                            </div>
                            {generationState.errorCount > 0 && (
                              <div className="flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded bg-red-500/10">
                                <AlertCircle className="h-3 w-3 md:h-3.5 md:w-3.5 text-red-500 flex-shrink-0" />
                                <span className="text-red-600 truncate">{generationState.errorCount} Err</span>
                              </div>
                            )}
                            {generationState.errorCount === 0 && (
                              <div className="flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded bg-background/50">
                                <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  ~{Math.ceil((generationState.total - generationState.completed) * 1.5)}s
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selection Summary - Mobile optimized (hide on mobile, FAB replaces) */}
                      <div className="flex items-center justify-between gap-2 p-2.5 md:p-3 rounded-lg bg-muted/50">
                        <span className="text-xs md:text-sm text-muted-foreground">
                          {selectedSongs.size} <span className="hidden xs:inline">Songs </span>ausgewählt
                        </span>
                        <Button 
                          onClick={generateSelected} 
                          disabled={generating || selectedSongs.size === 0}
                          className="gradient-gold text-xs md:text-sm h-8 md:h-9 px-3 md:px-4 hidden sm:flex"
                        >
                          {generating ? (
                            <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin mr-1.5 md:mr-2" />
                          ) : (
                            <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                          )}
                          Abrufen
                        </Button>
                      </div>

                      {/* Artist Tree - Mobile optimized */}
                      <div className="space-y-1.5 md:space-y-2">
                        {artists.map(artist => (
                          <div key={artist.id} className="border rounded-lg overflow-hidden">
                            <div 
                              className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 active:bg-muted/60"
                              onClick={() => toggleArtist(artist.id)}
                            >
                              {expandedArtists.has(artist.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <User className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-medium text-sm md:text-base truncate flex-1 min-w-0">{artist.name}</span>
                              <Badge variant="outline" className="text-[10px] md:text-xs flex-shrink-0 hidden sm:flex">{artist.genre}</Badge>
                              {/* Persona Editor Button */}
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 md:h-8 w-7 md:w-8 p-0 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setPersonaEditorArtist(artist); }}
                                title="Persona bearbeiten"
                              >
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 md:h-8 text-[10px] md:text-xs px-2 md:px-3 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); selectAllFromArtist(artist.id); }}
                              >
                                <span className="hidden md:inline">Alle auswählen</span>
                                <span className="md:hidden">Alle</span>
                              </Button>
                            </div>

                            {expandedArtists.has(artist.id) && (
                              <div className="pl-4 md:pl-6 pb-2">
                                {getArtistAlbums(artist.id).map(album => (
                                  <div key={album.id} className="mt-1.5 md:mt-2">
                                    <div 
                                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30 active:bg-muted/40 rounded"
                                      onClick={() => toggleAlbum(album.id)}
                                    >
                                      {expandedAlbums.has(album.id) ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <Disc className="h-3 w-3 text-primary flex-shrink-0" />
                                      <span className="text-xs md:text-sm truncate flex-1 min-w-0">{album.name}</span>
                                      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-6 text-[10px] md:text-xs px-2"
                                          onClick={(e) => { e.stopPropagation(); selectAllFromAlbum(album.id); }}
                                        >
                                          <span className="hidden md:inline">Album auswählen</span>
                                          <span className="md:hidden">Alle</span>
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-6 text-[10px] md:text-xs px-2 text-primary hover:text-primary"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const albumSongs = getAlbumSongs(album.id);
                                            albumSongs.forEach(song => {
                                              if (!selectedSongs.has(song.id)) {
                                                toggleSong(song.id);
                                              }
                                            });
                                            // Reset song statuses for this album to trigger re-generation
                                            albumSongs.forEach(async (song) => {
                                              await supabase
                                                .from("songs")
                                                .update({ 
                                                  generation_status: "pending",
                                                  audio_url: null,
                                                  suno_task_id: null
                                                })
                                                .eq("id", song.id);
                                            });
                                            setSongs(prev => prev.map(s => {
                                              if (albumSongs.some(as => as.id === s.id)) {
                                                return { ...s, generation_status: "pending", audio_url: null, suno_task_id: null };
                                              }
                                              return s;
                                            }));
                                            toast.success(`Album "${album.name}" zurückgesetzt - bereit zur Neugenerierung`);
                                          }}
                                          title="Album zurücksetzen für Neugenerierung"
                                        >
                                          <RefreshCw className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {expandedAlbums.has(album.id) && (
                                      <div className="pl-4 md:pl-6 space-y-0.5 md:space-y-1 mt-1">
                                        {getAlbumSongs(album.id).map(song => (
                                          <div 
                                            key={song.id} 
                                            className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded hover:bg-muted/30 active:bg-muted/40"
                                          >
                                            <Checkbox 
                                              checked={selectedSongs.has(song.id)}
                                              onCheckedChange={() => toggleSong(song.id)}
                                              className="h-4 w-4 md:h-5 md:w-5"
                                            />
                                            <Music className="h-3 w-3 text-muted-foreground flex-shrink-0 hidden sm:block" />
                                            <span className="text-xs md:text-sm flex-1 truncate min-w-0">{song.name}</span>
                                            <div className="hidden sm:block flex-shrink-0">
                                              {getStatusBadge(song.generation_status)}
                                            </div>
                                            {song.audio_url && (
                                              <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className={`h-7 w-7 md:h-6 md:w-6 flex-shrink-0 ${currentTrack?.id === song.id ? 'text-primary' : ''}`}
                                                onClick={() => playAudio(song)}
                                              >
                                                {currentTrack?.id === song.id && isPlaying ? (
                                                  <Pause className="h-3.5 w-3.5 md:h-3 md:w-3" />
                                                ) : (
                                                  <Play className="h-3.5 w-3.5 md:h-3 md:w-3" />
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
                      <h3 className="font-medium text-lg">Noch keine Songs abgerufen</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wähle Songs aus und rufe sie mit scoopas ab
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Sort Controls - Mobile optimized */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 md:p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
                          <ArrowUpDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">Sortierung:</span>
                          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                            <SelectTrigger className="w-24 md:w-32 h-7 md:h-8 text-xs md:text-sm">
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
                            className="h-7 md:h-8 px-2 text-xs md:text-sm"
                          >
                            {sortDirection === "asc" ? "↑" : "↓"}
                            <span className="hidden sm:inline ml-1">{sortDirection === "asc" ? "A-Z" : "Z-A"}</span>
                          </Button>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleRefresh}
                          disabled={isRefreshing}
                          className="h-7 md:h-8 text-xs md:text-sm w-full sm:w-auto"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                          <span className="sm:hidden">Aktualisieren</span>
                          <span className="hidden sm:inline">Aktualisieren</span>
                        </Button>
                      </div>

                      {/* Grouped Song List by Artist and Album - Mobile optimized */}
                      <div className="space-y-1.5 md:space-y-3">
                        {groupedLibrarySongs.map(({ artist, albums }) => (
                          <div key={artist.id} className="border rounded-lg overflow-hidden">
                            <div 
                              className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 active:bg-muted/60"
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
                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <User className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-medium text-sm md:text-base truncate flex-1 min-w-0">{artist.name}</span>
                              <Badge variant="outline" className="text-[10px] md:text-xs hidden sm:flex flex-shrink-0">{artist.genre}</Badge>
                              <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">
                                {Object.values(albums).reduce((acc, a) => acc + a.songs.length, 0)} <span className="hidden sm:inline">Songs</span>
                              </span>
                            </div>

                            {expandedLibraryArtists.has(artist.id) && (
                              <div className="pl-3 md:pl-4 pb-2">
                                {Object.values(albums).map(({ album, songs: albumSongs }) => (
                                  <div key={album.id} className="mt-1.5 md:mt-2">
                                    <div 
                                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30 active:bg-muted/40 rounded"
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
                                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <Disc className="h-3 w-3 text-primary flex-shrink-0" />
                                      <span className="text-xs md:text-sm truncate flex-1 min-w-0">{album.name}</span>
                                      <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">
                                        {albumSongs.length} <span className="hidden sm:inline">Songs</span>
                                      </span>
                                    </div>

                                    {expandedLibraryAlbums.has(album.id) && (
                                      <div className="pl-4 md:pl-6 space-y-0.5 md:space-y-1 mt-1">
                                        {albumSongs.map(song => (
                                          <div 
                                            key={song.id} 
                                            className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded hover:bg-muted/30 active:bg-muted/40"
                                          >
                                            <Music className="h-3 w-3 text-muted-foreground flex-shrink-0 hidden sm:block" />
                                            <span className="text-xs md:text-sm flex-1 truncate min-w-0">{song.name}</span>
                                            <div className="hidden sm:block flex-shrink-0">
                                              {getStatusBadge(song.generation_status)}
                                            </div>
                                            {song.audio_url && (
                                              <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
                                                <Button 
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className={`h-8 w-8 md:h-7 md:w-7 ${currentTrack?.id === song.id ? 'text-primary' : ''}`}
                                                  onClick={() => playAudio(song)}
                                                >
                                                  {currentTrack?.id === song.id && isPlaying ? (
                                                    <Pause className="h-4 w-4 md:h-3.5 md:w-3.5" />
                                                  ) : (
                                                    <Play className="h-4 w-4 md:h-3.5 md:w-3.5" />
                                                  )}
                                                </Button>
                                                <Button
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className="h-8 w-8 md:h-7 md:w-7"
                                                  onClick={() => downloadAudio(song.audio_url!, song.name)}
                                                >
                                                  <Download className="h-4 w-4 md:h-3.5 md:w-3.5" />
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

      {/* Mobile Floating Action Button */}
      {isMobile && selectedSongs.size > 0 && !generating && (
        <button
          onClick={generateSelected}
          className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full gradient-gold shadow-lg flex items-center justify-center glow-gold animate-in zoom-in-50 duration-200"
          aria-label="Songs abrufen"
        >
          <Zap className="h-6 w-6 text-primary-foreground" />
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background text-primary text-xs font-bold flex items-center justify-center border border-primary">
            {selectedSongs.size}
          </span>
        </button>
      )}

      {/* Persona Editor Dialog */}
      <PersonaEditorDialog
        open={!!personaEditorArtist}
        onOpenChange={(open) => !open && setPersonaEditorArtist(null)}
        artist={personaEditorArtist}
        onSave={() => loadDataDirect(true)}
      />
    </div>
  );
};

export default AudioGenerator;
