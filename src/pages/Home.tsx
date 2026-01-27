import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Shuffle, Music, Disc, TrendingUp, Sparkles, Users, ChevronRight, Clock, Flame, Headphones } from "lucide-react";
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

const getGenreImage = (genre: string): string | null => {
  if (GENRE_IMAGES[genre]) return GENRE_IMAGES[genre];
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

// Song Row Component for consistency
const SongRow = ({ 
  item, 
  index, 
  isCurrentlyPlaying, 
  onPlay 
}: { 
  item: { song: Song; artist: ArtistWithAlbums; albumName: string };
  index: number;
  isCurrentlyPlaying: boolean;
  onPlay: () => void;
}) => (
  <button
    onClick={onPlay}
    className={cn(
      "flex items-center gap-3 p-2.5 md:p-3 transition-all text-left w-full group rounded-lg",
      "hover:bg-white/5 active:scale-[0.98]",
      isCurrentlyPlaying && "bg-primary/10"
    )}
  >
    <span className="w-6 text-center text-muted-foreground text-xs font-medium">
      {isCurrentlyPlaying ? (
        <span className="flex items-center justify-center gap-0.5">
          <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" />
          <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
      ) : (
        <>
          <span className="group-hover:hidden">{index + 1}</span>
          <Play className="h-3.5 w-3.5 hidden group-hover:block mx-auto text-primary" fill="currentColor" />
        </>
      )}
    </span>
    <div className="w-10 h-10 md:w-11 md:h-11 rounded-md overflow-hidden flex-shrink-0 bg-muted/50 shadow-sm">
      {item.artist.profile_image_url ? (
        <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Music className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn(
        "text-sm font-medium truncate transition-colors",
        isCurrentlyPlaying ? "text-primary" : "group-hover:text-primary"
      )}>
        {item.song.name}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {item.artist.name} • {item.artist.genre}
      </p>
    </div>
  </button>
);

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

  // Recently added songs
  const recentlyAdded = useMemo(() => {
    const getGenerationTimestamp = (audioUrl: string): number => {
      const match = audioUrl.match(/_(\d{13})\.mp3$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return [...allSongsWithAudio]
      .sort((a, b) => getGenerationTimestamp(b.song.audio_url || "") - getGenerationTimestamp(a.song.audio_url || ""))
      .slice(0, 8);
  }, [allSongsWithAudio]);

  const recentlyPlayed = useMemo(() => history.slice(0, 8), [history]);

  const popularSongs = useMemo(() => {
    const artistSongCounts = new Map<string, number>();
    allSongsWithAudio.forEach(item => {
      artistSongCounts.set(item.artist.id, (artistSongCounts.get(item.artist.id) || 0) + 1);
    });
    return [...allSongsWithAudio]
      .sort((a, b) => (artistSongCounts.get(b.artist.id) || 0) - (artistSongCounts.get(a.artist.id) || 0))
      .slice(0, 8);
  }, [allSongsWithAudio]);

  const topArtists = useMemo(() => {
    return [...artists]
      .filter(a => a.albums.some(al => al.songs.some(s => s.audio_url)))
      .sort((a, b) => {
        const aSongs = a.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
        const bSongs = b.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
        return bSongs - aSongs;
      })
      .slice(0, 10);
  }, [artists]);

  const playlists = useMemo((): PlaylistCard[] => {
    const genreMap = new Map<string, Array<{ song: Song; artist: ArtistWithAlbums; albumName: string }>>();
    allSongsWithAudio.forEach(item => {
      if (!genreMap.has(item.artist.genre)) genreMap.set(item.artist.genre, []);
      genreMap.get(item.artist.genre)!.push(item);
    });
    return Array.from(genreMap.entries())
      .filter(([_, songs]) => songs.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([genre, songs], idx) => ({
        id: genre,
        title: genre,
        songs: songs.slice(0, 30),
        genreImage: getGenreImage(genre),
        accentColor: ACCENT_COLORS[idx % ACCENT_COLORS.length],
      }));
  }, [allSongsWithAudio]);

  const shuffledSongs = useMemo(() => 
    [...allSongsWithAudio].sort(() => Math.random() - 0.5).slice(0, 50), 
  [allSongsWithAudio]);

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
    clearQueue();
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
    toast.success(`${playlist.title} Mix`, {
      description: `${playlist.songs.length} Songs in der Warteschlange`,
    });
  };

  const handleShuffleAll = () => {
    if (shuffledSongs.length === 0) return;
    clearQueue();
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
            <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Lädt Musik...</p>
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
          className="py-4 md:py-6 px-4 md:px-6 space-y-6 md:space-y-8 max-w-6xl mx-auto" 
          style={{ paddingBottom: Math.max(playerHeight + 24, 32) }}
        >
          
          {/* Hero Section - Compact & Modern */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-background p-4 md:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">Dein Katalog</span>
                </div>
                <h1 className="font-display text-xl md:text-2xl font-bold">
                  {allSongsWithAudio.length} Songs verfügbar
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {stats.artists} Künstler • {playlists.length} Genre-Mixe
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  size="sm" 
                  className="gap-2 flex-1 sm:flex-initial shadow-lg shadow-primary/20"
                  onClick={handleShuffleAll}
                  disabled={allSongsWithAudio.length === 0}
                >
                  <Shuffle className="h-4 w-4" />
                  <span className="hidden xs:inline">Zufalls</span>mix
                </Button>
                <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-initial">
                  <Link to="/katalog">
                    <Disc className="h-4 w-4 mr-1.5" />
                    Katalog
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Genre Playlists - Larger Cards with Better Layout */}
          {playlists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="font-display text-base md:text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Genre-Mixe
                </h2>
                <Link to="/katalog" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                  Alle <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <ScrollArea className="w-full -mx-4 px-4">
                <div className="flex gap-3 pb-2">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handlePlayPlaylist(playlist)}
                      className="group relative overflow-hidden rounded-xl flex-shrink-0 w-32 md:w-40 aspect-square transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                    >
                      {playlist.genreImage ? (
                        <img 
                          src={playlist.genreImage} 
                          alt={playlist.title} 
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className={cn("absolute inset-0 bg-gradient-to-br", playlist.accentColor)} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      <div className="absolute inset-0 flex flex-col justify-end p-3">
                        <h3 className="font-bold text-white text-sm md:text-base leading-tight truncate drop-shadow-lg">
                          {playlist.title}
                        </h3>
                        <p className="text-white/70 text-xs mt-0.5">{playlist.songs.length} Songs</p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-sm">
                        <div className="p-3 rounded-full bg-primary text-primary-foreground shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>
            </section>
          )}

          {/* Top Artists - Improved Cards */}
          {topArtists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="font-display text-base md:text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Top Künstler
                </h2>
                <Link to="/katalog" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                  Alle <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <ScrollArea className="w-full -mx-4 px-4">
                <div className="flex gap-3 md:gap-4 pb-2">
                  {topArtists.map((artist) => {
                    const songCount = artist.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
                    return (
                      <Link
                        key={artist.id}
                        to="/katalog"
                        className="group flex-shrink-0 w-20 md:w-24"
                      >
                        <div className="relative aspect-square rounded-full overflow-hidden mb-2 ring-2 ring-border group-hover:ring-primary/50 transition-all shadow-lg bg-muted">
                          {artist.profile_image_url ? (
                            <img
                              src={artist.profile_image_url}
                              alt={artist.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Users className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-5 w-5 md:h-6 md:w-6 text-white" fill="white" />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-center truncate group-hover:text-primary transition-colors">
                          {artist.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground text-center">
                          {songCount} Songs
                        </p>
                      </Link>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>
            </section>
          )}

          {/* Song Lists - Modern Cards */}
          {(recentlyAdded.length > 0 || popularSongs.length > 0) && (
            <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
              {/* Recently Added */}
              {recentlyAdded.length > 0 && (
                <section className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
                  <div className="p-3 md:p-4 border-b border-border/50 bg-muted/20">
                    <h2 className="font-display text-sm md:text-base font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Kürzlich hinzugefügt
                    </h2>
                  </div>
                  <div className="p-1.5 md:p-2 space-y-0.5">
                    {recentlyAdded.slice(0, 5).map((item, idx) => (
                      <SongRow
                        key={item.song.id}
                        item={item}
                        index={idx}
                        isCurrentlyPlaying={currentTrack?.id === item.song.id && isPlaying}
                        onPlay={() => handlePlaySong(item)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Popular Songs */}
              {popularSongs.length > 0 && (
                <section className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
                  <div className="p-3 md:p-4 border-b border-border/50 bg-muted/20">
                    <h2 className="font-display text-sm md:text-base font-semibold flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Beliebteste Songs
                    </h2>
                  </div>
                  <div className="p-1.5 md:p-2 space-y-0.5">
                    {popularSongs.slice(0, 5).map((item, idx) => (
                      <SongRow
                        key={item.song.id}
                        item={item}
                        index={idx}
                        isCurrentlyPlaying={currentTrack?.id === item.song.id && isPlaying}
                        onPlay={() => handlePlaySong(item)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Recently Played - Horizontal Scroll Cards */}
          {recentlyPlayed.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="font-display text-base md:text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Kürzlich gespielt
                </h2>
              </div>
              <ScrollArea className="w-full -mx-4 px-4">
                <div className="flex gap-3 pb-2">
                  {recentlyPlayed.map((track, idx) => {
                    const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
                    return (
                      <button
                        key={`${track.id}-${idx}`}
                        onClick={() => play(track)}
                        className="group flex-shrink-0 w-28 md:w-32 text-left"
                      >
                        <div className={cn(
                          "relative aspect-square rounded-lg overflow-hidden mb-2 shadow-md transition-all bg-muted",
                          "ring-2 ring-transparent group-hover:ring-primary/50 active:scale-95",
                          isCurrentlyPlaying && "ring-primary"
                        )}>
                          {track.artistImageUrl || track.coverUrl ? (
                            <img
                              src={track.artistImageUrl || track.coverUrl}
                              alt={track.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
                            isCurrentlyPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            {isCurrentlyPlaying ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <span className="w-1 h-4 bg-white rounded-full animate-pulse" />
                                <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                              </div>
                            ) : (
                              <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-lg">
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
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>
            </section>
          )}

          {/* Empty State */}
          {allSongsWithAudio.length === 0 && (
            <section className="text-center py-12 md:py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">Noch keine Musik</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Erstelle Künstler und lade ihre Songs ab, um deinen Katalog zu füllen.
              </p>
              <div className="flex gap-3 justify-center">
                <Button size="sm" asChild className="shadow-lg shadow-primary/20">
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
