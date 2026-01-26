import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Shuffle, Music, Disc, TrendingUp, Sparkles, Users, ChevronRight, Clock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Genre images
import genreHipHop from "@/assets/genres/hip-hop.jpg";
import genreSoul from "@/assets/genres/soul.jpg";
import genreElectronica from "@/assets/genres/electronica.jpg";
import genreReggae from "@/assets/genres/reggae.jpg";
import genreAmericana from "@/assets/genres/americana.jpg";
import genreChamberFolk from "@/assets/genres/chamber-folk.jpg";
import genrePop from "@/assets/genres/pop.jpg";
import genreRock from "@/assets/genres/rock.jpg";
import genreJazz from "@/assets/genres/jazz.jpg";
import genreRnb from "@/assets/genres/rnb.jpg";
import genreTechno from "@/assets/genres/techno.jpg";
import genreClassical from "@/assets/genres/classical.jpg";

// Map genre names to images
const GENRE_IMAGES: Record<string, string> = {
  "Hip-Hop": genreHipHop,
  "Soul": genreSoul,
  "Electronica": genreElectronica,
  "Reggae": genreReggae,
  "Americana": genreAmericana,
  "Chamber Folk": genreChamberFolk,
  "Pop": genrePop,
  "Rock": genreRock,
  "Jazz": genreJazz,
  "R&B": genreRnb,
  "Techno": genreTechno,
  "Classical": genreClassical,
  // Fallback mappings for similar genres
  "Electronic": genreElectronica,
  "Folk": genreChamberFolk,
  "Country": genreAmericana,
  "Blues": genreSoul,
  "Funk": genreSoul,
  "Disco": genrePop,
  "House": genreTechno,
  "Trap": genreHipHop,
  "Rap": genreHipHop,
  "Neo-Soul": genreSoul,
  "Indie": genreRock,
  "Alternative": genreRock,
  "Metal": genreRock,
  "Punk": genreRock,
  "Latin": genreReggae,
  "World": genreReggae,
  "Afrobeat": genreReggae,
};

// Get genre image with fuzzy matching
const getGenreImage = (genre: string): string | null => {
  // Direct match
  if (GENRE_IMAGES[genre]) return GENRE_IMAGES[genre];
  
  // Partial match
  const lowerGenre = genre.toLowerCase();
  for (const [key, image] of Object.entries(GENRE_IMAGES)) {
    if (lowerGenre.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerGenre)) {
      return image;
    }
  }
  
  return null;
};

interface PlaylistCard {
  id: string;
  title: string;
  songs: Array<{
    song: Song;
    artist: ArtistWithAlbums;
    albumName: string;
  }>;
  genreImage: string | null;
  accentColor: string;
}

const ACCENT_COLORS = [
  "from-primary/90 via-primary/60 to-primary/20",
  "from-violet-600/90 via-violet-700/60 to-violet-900/20",
  "from-cyan-500/90 via-cyan-600/60 to-cyan-800/20",
  "from-emerald-500/90 via-emerald-600/60 to-emerald-800/20",
  "from-orange-500/90 via-orange-600/60 to-orange-800/20",
  "from-rose-500/90 via-rose-600/60 to-rose-800/20",
];

export default function Home() {
  const { artists, stats, isLoading } = useCatalogData();
  const { play, clearQueue, addToQueue, currentTrack, isPlaying, history } = useAudioPlayer();
  const playerHeight = usePlayerHeight();

  // Get all songs with audio
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

  // Recently added songs - sorted by song created_at
  const recentlyAdded = useMemo(() => {
    return [...allSongsWithAudio]
      .sort((a, b) => new Date(b.song.created_at).getTime() - new Date(a.song.created_at).getTime())
      .slice(0, 6);
  }, [allSongsWithAudio]);

  // Recently played from history
  const recentlyPlayed = useMemo(() => {
    return history.slice(0, 6);
  }, [history]);

  // Most popular songs (songs that have audio, sorted by artist with most songs as proxy for popularity)
  const popularSongs = useMemo(() => {
    // Create a map of artist song counts
    const artistSongCounts = new Map<string, number>();
    allSongsWithAudio.forEach(item => {
      const count = artistSongCounts.get(item.artist.id) || 0;
      artistSongCounts.set(item.artist.id, count + 1);
    });
    
    // Sort songs by their artist's song count (as a proxy for popularity)
    return [...allSongsWithAudio]
      .sort((a, b) => {
        const aCount = artistSongCounts.get(a.artist.id) || 0;
        const bCount = artistSongCounts.get(b.artist.id) || 0;
        return bCount - aCount;
      })
      .slice(0, 6);
  }, [allSongsWithAudio]);

  // Top artists (by song count)
  const topArtists = useMemo(() => {
    return [...artists]
      .filter(a => a.albums.some(al => al.songs.some(s => s.audio_url)))
      .sort((a, b) => {
        const aSongs = a.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
        const bSongs = b.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
        return bSongs - aSongs;
      })
      .slice(0, 8);
  }, [artists]);

  // Generate dynamic playlists based on genres with genre images
  const playlists = useMemo((): PlaylistCard[] => {
    const genreMap = new Map<string, Array<{ song: Song; artist: ArtistWithAlbums; albumName: string }>>();
    
    allSongsWithAudio.forEach(item => {
      const genre = item.artist.genre;
      if (!genreMap.has(genre)) {
        genreMap.set(genre, []);
      }
      genreMap.get(genre)!.push(item);
    });

    return Array.from(genreMap.entries())
      .filter(([_, songs]) => songs.length >= 2)
      .slice(0, 6)
      .map(([genre, songs], idx) => ({
        id: genre,
        title: genre,
        songs: songs.slice(0, 25),
        genreImage: getGenreImage(genre),
        accentColor: ACCENT_COLORS[idx % ACCENT_COLORS.length],
      }));
  }, [allSongsWithAudio]);

  // Random mix
  const shuffledSongs = useMemo(() => {
    return [...allSongsWithAudio].sort(() => Math.random() - 0.5).slice(0, 50);
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

  const handlePlayPlaylist = (playlist: PlaylistCard) => {
    if (playlist.songs.length === 0) return;
    
    // Clear queue and add all songs
    clearQueue();
    
    // Play the first song
    const firstItem = playlist.songs[0];
    play({
      id: firstItem.song.id,
      title: firstItem.song.name,
      artist: firstItem.artist.name,
      album: firstItem.albumName,
      audioUrl: firstItem.song.audio_url!,
      coverUrl: firstItem.artist.profile_image_url,
      artistImageUrl: firstItem.artist.profile_image_url,
      songId: firstItem.song.id,
      artistId: firstItem.artist.id,
    });
    
    // Add the rest to the queue
    playlist.songs.slice(1).forEach(item => {
      if (item.song.audio_url) {
        addToQueue({
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
      }
    });
    
    toast.success(`${playlist.title} Mix gestartet`, {
      description: `${playlist.songs.length} Songs in der Warteschlange`,
    });
  };

  const handleShuffleAll = () => {
    if (shuffledSongs.length === 0) return;
    
    // Clear queue and add all shuffled songs
    clearQueue();
    
    // Play the first song
    const firstItem = shuffledSongs[0];
    play({
      id: firstItem.song.id,
      title: firstItem.song.name,
      artist: firstItem.artist.name,
      album: firstItem.albumName,
      audioUrl: firstItem.song.audio_url!,
      coverUrl: firstItem.artist.profile_image_url,
      artistImageUrl: firstItem.artist.profile_image_url,
      songId: firstItem.song.id,
      artistId: firstItem.artist.id,
    });
    
    // Add the rest to the queue
    shuffledSongs.slice(1).forEach(item => {
      if (item.song.audio_url) {
        addToQueue({
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
      }
    });
    
    toast.success("Zufallsmix gestartet", {
      description: `${shuffledSongs.length} Songs in der Warteschlange`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader stats={stats} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Lädt...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader stats={stats} />
      
      <ScrollArea className="flex-1">
        <div className="container py-6 px-4 md:px-6 space-y-8 max-w-6xl" style={{ paddingBottom: Math.max(playerHeight + 24, 32) }}>
          
          {/* Hero - Compact */}
          <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">
                Willkommen zurück
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Entdecke und höre deine Musik
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="gap-2"
                onClick={handleShuffleAll}
                disabled={allSongsWithAudio.length === 0}
              >
                <Shuffle className="h-4 w-4" />
                Zufallsmix
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/katalog">
                  <Disc className="h-4 w-4 mr-1.5" />
                  Katalog
                </Link>
              </Button>
            </div>
          </section>

          {/* Genre Playlists with Genre Images */}
          {playlists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Genre-Mixe
                </h2>
                <Link to="/katalog" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                  Alle <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => handlePlayPlaylist(playlist)}
                    className="group relative overflow-hidden rounded-xl aspect-square transition-all duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {/* Genre Image or Gradient Fallback */}
                    {playlist.genreImage ? (
                      <img 
                        src={playlist.genreImage} 
                        alt={playlist.title} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className={cn("absolute inset-0 bg-gradient-to-br", playlist.accentColor)} />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    <div className="absolute inset-0 flex flex-col justify-end p-2.5">
                      <h3 className="font-semibold text-white text-sm leading-tight truncate drop-shadow-lg">
                        {playlist.title}
                      </h3>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg">
                        <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Top Artists - Horizontal Scroll */}
          {topArtists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Top Künstler
                </h2>
                <Link to="/katalog" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                  Alle <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <ScrollArea className="w-full -mx-4 px-4">
                <div className="flex gap-4 pb-2">
                  {topArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      to="/katalog"
                      className="group flex-shrink-0 w-24 md:w-28"
                    >
                      <div className="relative aspect-square rounded-full overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary/50 transition-all shadow-lg">
                        {artist.profile_image_url ? (
                          <img
                            src={artist.profile_image_url}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Users className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-6 w-6 text-white" fill="white" />
                        </div>
                      </div>
                      <p className="text-xs font-medium text-center truncate group-hover:text-primary transition-colors">
                        {artist.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground text-center truncate">
                        {artist.genre}
                      </p>
                    </Link>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Two Column Grid: Recently Added & Popular Songs */}
          {(recentlyAdded.length > 0 || popularSongs.length > 0) && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recently Added */}
              {recentlyAdded.length > 0 && (
                <section>
                  <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Kürzlich hinzugefügt
                  </h2>
                  <div className="grid gap-1 rounded-xl overflow-hidden border border-border/50 bg-card/30">
                    {recentlyAdded.map((item, idx) => {
                      const isCurrentlyPlaying = currentTrack?.id === item.song.id && isPlaying;
                      return (
                        <button
                          key={item.song.id}
                          onClick={() => handlePlaySong(item)}
                          className={cn(
                            "flex items-center gap-3 p-3 transition-colors text-left w-full group",
                            "hover:bg-muted/40",
                            isCurrentlyPlaying && "bg-primary/10"
                          )}
                        >
                          <span className="w-5 text-center text-muted-foreground text-xs">
                            {isCurrentlyPlaying ? (
                              <span className="flex items-center justify-center gap-px">
                                <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" />
                                <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                              </span>
                            ) : (
                              <>
                                <span className="group-hover:hidden">{idx + 1}</span>
                                <Play className="h-3 w-3 hidden group-hover:block mx-auto text-primary" fill="currentColor" />
                              </>
                            )}
                          </span>
                          <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0">
                            {item.artist.profile_image_url ? (
                              <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Music className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              isCurrentlyPlaying && "text-primary"
                            )}>
                              {item.song.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.artist.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Popular Songs */}
              {popularSongs.length > 0 && (
                <section>
                  <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Beliebteste Songs
                  </h2>
                  <div className="grid gap-1 rounded-xl overflow-hidden border border-border/50 bg-card/30">
                    {popularSongs.map((item, idx) => {
                      const isCurrentlyPlaying = currentTrack?.id === item.song.id && isPlaying;
                      return (
                        <button
                          key={item.song.id}
                          onClick={() => handlePlaySong(item)}
                          className={cn(
                            "flex items-center gap-3 p-3 transition-colors text-left w-full group",
                            "hover:bg-muted/40",
                            isCurrentlyPlaying && "bg-primary/10"
                          )}
                        >
                          <span className="w-5 text-center text-muted-foreground text-xs">
                            {isCurrentlyPlaying ? (
                              <span className="flex items-center justify-center gap-px">
                                <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" />
                                <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                              </span>
                            ) : (
                              <>
                                <span className="group-hover:hidden">{idx + 1}</span>
                                <Play className="h-3 w-3 hidden group-hover:block mx-auto text-primary" fill="currentColor" />
                              </>
                            )}
                          </span>
                          <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0">
                            {item.artist.profile_image_url ? (
                              <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Music className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              isCurrentlyPlaying && "text-primary"
                            )}>
                              {item.song.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.artist.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Recently Played */}
          {recentlyPlayed.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Kürzlich gespielt
              </h2>
              <ScrollArea className="w-full -mx-4">
                <div className="flex gap-3 pb-2 px-4">
                  {recentlyPlayed.map((track, idx) => {
                    const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
                    return (
                      <button
                        key={`${track.id}-${idx}`}
                        onClick={() => play(track)}
                        className="group flex-shrink-0 w-32 md:w-36 text-left"
                      >
                        <div className={cn(
                          "relative aspect-square rounded-lg overflow-hidden mb-2 shadow-md transition-all",
                          "ring-2 ring-transparent group-hover:ring-primary/50",
                          isCurrentlyPlaying && "ring-primary"
                        )}>
                          {track.artistImageUrl || track.coverUrl ? (
                            <img
                              src={track.artistImageUrl || track.coverUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Music className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
                            isCurrentlyPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            {isCurrentlyPlaying ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <span className="w-1 h-4 bg-white rounded-full animate-pulse" />
                                <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                              </div>
                            ) : (
                              <div className="p-2 rounded-full bg-primary text-primary-foreground">
                                <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
                              </div>
                            )}
                          </div>
                        </div>
                        <p className={cn(
                          "text-xs font-medium truncate transition-colors",
                          isCurrentlyPlaying ? "text-primary" : "group-hover:text-primary"
                        )}>
                          {track.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {track.artist}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Empty State */}
          {allSongsWithAudio.length === 0 && (
            <section className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                <Music className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">Noch keine Musik</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Erstelle Künstler und lade ihre Songs ab.
              </p>
              <div className="flex gap-3 justify-center">
                <Button size="sm" asChild>
                  <Link to="/erweitern">Künstler erstellen</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/katalog">Katalog</Link>
                </Button>
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
