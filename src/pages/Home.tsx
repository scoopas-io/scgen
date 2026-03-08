import { useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Disc, 
  Music, 
  Play,
  PieChart,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";
import { cn } from "@/lib/utils";

// Genre card for discovery
const GenreCard = ({ 
  genre, 
  count, 
  artistCount,
  onClick 
}: { 
  genre: string; 
  count: number; 
  artistCount: number;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start p-4 rounded-xl transition-all duration-300",
      "bg-gradient-to-br from-card/80 to-card/40 border border-border/50",
      "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
      "active:scale-[0.98]"
    )}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="p-1.5 rounded-md bg-primary/10 text-primary">
        <Music className="h-3.5 w-3.5" />
      </div>
      <span className="text-sm font-semibold">{genre}</span>
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>{count} Titel</span>
      <span>•</span>
      <span>{artistCount} Künstler</span>
    </div>
    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
  </button>
);

// Playable song suggestion card
const SongSuggestionCard = ({ 
  item, 
  onPlay,
  isPlaying 
}: { 
  item: { song: Song; artist: ArtistWithAlbums; albumName: string };
  onPlay: () => void;
  isPlaying: boolean;
}) => (
  <button
    onClick={onPlay}
    className={cn(
      "group relative flex items-center gap-3 p-3 w-full text-left rounded-xl transition-all duration-300",
      "bg-gradient-to-br from-card/80 to-card/40 border border-border/50",
      "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
      "active:scale-[0.99]",
      isPlaying && "border-primary bg-primary/5"
    )}
  >
    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted/50">
      {item.artist.profile_image_url ? (
        <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Music className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className={cn(
        "absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity",
        isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <Play className="h-5 w-5 text-white" fill="white" />
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("text-sm font-medium truncate", isPlaying && "text-primary")}>{item.song.name}</p>
      <p className="text-xs text-muted-foreground truncate">{item.artist.name}</p>
    </div>
    <Badge variant="outline" className="text-xs hidden sm:inline-flex shrink-0">{item.artist.genre}</Badge>
  </button>
);

export default function Home() {
  const { artists, stats, isLoading } = useCatalogData();
  const { play, currentTrack, addToQueue, clearQueue } = useAudioPlayer();
  const playerHeight = usePlayerHeight();

  // All songs with audio (V1)
  const allSongsWithAudio = useMemo(() => {
    const songs: Array<{ song: Song; artist: ArtistWithAlbums; albumName: string }> = [];
    artists.forEach(artist => {
      artist.albums.forEach(album => {
        album.songs.forEach(song => {
          if (song.audio_url) {
            songs.push({ song, artist, albumName: album.name });
          }
        });
      });
    });
    return songs;
  }, [artists]);

  // Total songs (with and without audio)
  const totalSongs = useMemo(() => {
    return artists.reduce((acc, artist) => 
      acc + artist.albums.reduce((a, album) => a + album.songs.length, 0), 0
    );
  }, [artists]);

  // Count songs with V2 versions available
  const songsWithV2Count = useMemo(() => {
    let count = 0;
    artists.forEach(artist => {
      artist.albums.forEach(album => {
        album.songs.forEach(song => {
          if (song.alternative_audio_url) {
            count++;
          }
        });
      });
    });
    return count;
  }, [artists]);

  const totalAvailableTracks = useMemo(() => totalSongs + songsWithV2Count, [totalSongs, songsWithV2Count]);

  // Random song selection for discovery (shuffled from all available)
  const randomSongSelection = useMemo(() => {
    const shuffled = [...allSongsWithAudio];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 12);
  }, [allSongsWithAudio]);

  // Genre distribution
  const genreStats = useMemo(() => {
    const genreMap = new Map<string, { songs: number; artists: Set<string> }>();
    allSongsWithAudio.forEach(item => {
      const existing = genreMap.get(item.artist.genre) || { songs: 0, artists: new Set() };
      existing.songs++;
      existing.artists.add(item.artist.id);
      genreMap.set(item.artist.genre, existing);
    });
    return Array.from(genreMap.entries())
      .map(([genre, data]) => ({ genre, count: data.songs, artistCount: data.artists.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allSongsWithAudio]);
  const handlePlaySong = (item: { song: Song; artist: ArtistWithAlbums; albumName: string }) => {
    if (!item.song.audio_url) return;
    play({
      id: item.song.id,
      title: item.song.name,
      artist: item.artist.name,
      album: item.albumName,
      audioUrl: item.song.audio_url,
      coverUrl: item.artist.profile_image_url,
      artistImageUrl: item.artist.profile_image_url,
      songId: item.song.id,
      artistId: item.artist.id,
    });
  };

  // Convert song item to Track format
  const itemToTrack = (item: { song: Song; artist: ArtistWithAlbums; albumName: string }) => ({
    id: item.song.id,
    title: item.song.name,
    artist: item.artist.name,
    album: item.albumName,
    audioUrl: item.song.audio_url!,
    coverUrl: item.artist.profile_image_url,
    artistImageUrl: item.artist.profile_image_url,
    songId: item.song.id,
    artistId: item.artist.id,
  });

  // Play a genre playlist (shuffled songs from that genre)
  const handlePlayGenre = (genre: string) => {
    const genreSongs = allSongsWithAudio.filter(s => s.artist.genre === genre);
    if (genreSongs.length === 0) return;
    
    // Shuffle the genre songs
    const shuffled = [...genreSongs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Clear existing queue and add all songs
    clearQueue();
    
    // Play the first song immediately
    play(itemToTrack(shuffled[0]));
    
    // Add remaining songs to queue
    shuffled.slice(1).forEach(item => {
      addToQueue(itemToTrack(item));
    });
  };
  
  // Play random selection as playlist
  const handlePlayRandomSelection = () => {
    if (randomSongSelection.length === 0) return;
    
    // Clear existing queue
    clearQueue();
    
    // Play first song
    play(itemToTrack(randomSongSelection[0]));
    
    // Add rest to queue
    randomSongSelection.slice(1).forEach(item => {
      addToQueue(itemToTrack(item));
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader stats={stats} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Katalog wird geladen...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader stats={stats} />
      
      <ScrollArea className="flex-1">
        <div 
          className="py-4 md:py-6 px-4 md:px-6 max-w-6xl mx-auto" 
          style={{ paddingBottom: Math.max(playerHeight + 24, 32) }}
        >
          {/* Header Section */}
          <div className="mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Disc className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">Katalog</span>
                </div>
                <h1 className="font-display text-xl md:text-2xl font-bold">
                  Willkommen bei scoopas
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Entdecke {totalAvailableTracks.toLocaleString('de-DE')} Titel von {stats.artists} Künstlern
                </p>
              </div>
              <Button size="sm" className="gap-2" asChild>
                <Link to="/katalog">
                  <Music className="h-4 w-4" />
                  Zum Katalog
                </Link>
              </Button>
            </div>
          </div>

          {/* Compact Stats Row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 md:mb-8 px-1 text-sm">
            <div>
              <span className="font-bold tabular-nums">{totalAvailableTracks.toLocaleString('de-DE')}</span>
              <span className="text-muted-foreground ml-1">Titel (V1+V2)</span>
            </div>
            <div>
              <span className="font-bold tabular-nums">{songsWithV2Count.toLocaleString('de-DE')}</span>
              <span className="text-muted-foreground ml-1">V2-Versionen</span>
            </div>
            <div>
              <span className="font-bold tabular-nums">{stats.artists}</span>
              <span className="text-muted-foreground ml-1">Künstler</span>
            </div>
            <div>
              <span className="font-bold tabular-nums">{stats.albums}</span>
              <span className="text-muted-foreground ml-1">Alben</span>
            </div>
          </div>

          {/* Genre Discovery Section */}
          <div className="mb-6 md:mb-8">
          <div className="flex items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Beliebte Genres entdecken
            </h2>
          </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {genreStats.map((item) => (
                <GenreCard
                  key={item.genre}
                  genre={item.genre}
                  count={item.count}
                  artistCount={item.artistCount}
                  onClick={() => handlePlayGenre(item.genre)}
                />
              ))}
            </div>
          </div>

          {/* Music Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Musik hören
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handlePlayRandomSelection}
                disabled={randomSongSelection.length === 0}
              >
                <Play className="h-3 w-3" />
                Alle abspielen
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {randomSongSelection.map((item) => (
                <SongSuggestionCard
                  key={item.song.id}
                  item={item}
                  onPlay={() => handlePlaySong(item)}
                  isPlaying={currentTrack?.id === item.song.id}
                />
              ))}
            </div>
            {randomSongSelection.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Keine Titel verfügbar
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
