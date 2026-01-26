import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Shuffle, Music, Disc, TrendingUp, Sparkles, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { cn } from "@/lib/utils";

interface PlaylistCard {
  id: string;
  title: string;
  artistCount: number;
  songs: Array<{
    song: Song;
    artist: ArtistWithAlbums;
    albumName: string;
  }>;
  coverImages: string[];
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
  const { play, currentTrack, isPlaying } = useAudioPlayer();

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

  // Recently added songs
  const recentlyAdded = useMemo(() => {
    return [...allSongsWithAudio].slice(0, 6);
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

  // Generate dynamic playlists based on genres with cover images
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
      .map(([genre, songs], idx) => {
        const uniqueArtists = [...new Map(songs.map(s => [s.artist.id, s.artist])).values()];
        const coverImages = uniqueArtists
          .filter(a => a.profile_image_url)
          .slice(0, 4)
          .map(a => a.profile_image_url!);

        return {
          id: genre,
          title: genre,
          artistCount: uniqueArtists.length,
          songs: songs.slice(0, 25),
          coverImages,
          accentColor: ACCENT_COLORS[idx % ACCENT_COLORS.length],
        };
      });
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
    handlePlaySong(playlist.songs[0]);
  };

  const handleShuffleAll = () => {
    if (shuffledSongs.length === 0) return;
    handlePlaySong(shuffledSongs[0]);
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
        <div className="container py-6 px-4 md:px-6 space-y-8 pb-32 max-w-6xl">
          
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

          {/* Genre Playlists - Compact Grid */}
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
                    {/* Background */}
                    {playlist.coverImages.length >= 4 ? (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                        {playlist.coverImages.slice(0, 4).map((img, idx) => (
                          <img key={idx} src={img} alt="" className="w-full h-full object-cover" />
                        ))}
                      </div>
                    ) : playlist.coverImages.length > 0 ? (
                      <img src={playlist.coverImages[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className={cn("absolute inset-0 bg-gradient-to-br", playlist.accentColor)} />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    
                    <div className="absolute inset-0 flex flex-col justify-end p-2.5">
                      <h3 className="font-semibold text-white text-sm leading-tight truncate">
                        {playlist.title}
                      </h3>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="p-2.5 rounded-full bg-primary text-primary-foreground">
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

          {/* Recently Added - Compact List */}
          {recentlyAdded.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
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
