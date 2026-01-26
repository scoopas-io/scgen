import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Shuffle, Clock, Music, Disc, TrendingUp, Sparkles, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { cn } from "@/lib/utils";

interface PlaylistCard {
  id: string;
  title: string;
  description: string;
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
  "from-indigo-500/90 via-indigo-600/60 to-indigo-800/20",
  "from-amber-500/90 via-amber-600/60 to-amber-800/20",
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
    return [...allSongsWithAudio].slice(0, 12);
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
      .slice(0, 10);
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
      .slice(0, 8)
      .map(([genre, songs], idx) => {
        // Get unique artist images for the collage
        const uniqueArtists = [...new Map(songs.map(s => [s.artist.id, s.artist])).values()];
        const coverImages = uniqueArtists
          .filter(a => a.profile_image_url)
          .slice(0, 4)
          .map(a => a.profile_image_url!);

        return {
          id: genre,
          title: genre,
          description: `${songs.length} Songs • ${uniqueArtists.length} Künstler`,
          songs: songs.slice(0, 25),
          coverImages,
          accentColor: ACCENT_COLORS[idx % ACCENT_COLORS.length],
        };
      });
  }, [allSongsWithAudio]);

  // Random mix for "Shuffle All"
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
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Music className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground animate-pulse">Lade Musikbibliothek...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader stats={stats} />
      
      <ScrollArea className="flex-1">
        <div className="container py-6 px-4 md:px-6 space-y-10 pb-32">
          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/40 via-primary/10 to-background border border-primary/20 p-8 md:p-12">
            <div className="relative z-10 max-w-2xl">
              <p className="text-primary font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                scoopas Musikkatalog
              </p>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                Deine Musik,<br />
                <span className="text-gradient-primary">immer bereit</span>
              </h1>
              <p className="text-muted-foreground text-lg mb-8 max-w-md">
                {allSongsWithAudio.length > 0 
                  ? `${allSongsWithAudio.length} Songs aus ${stats.albums} Alben warten auf dich.`
                  : "Erstelle Künstler und erweitere deinen Katalog."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button 
                  size="lg" 
                  className="gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
                  onClick={handleShuffleAll}
                  disabled={allSongsWithAudio.length === 0}
                >
                  <Shuffle className="h-5 w-5" />
                  Zufallsmix starten
                </Button>
                <Button variant="outline" size="lg" className="gap-2 backdrop-blur-sm" asChild>
                  <Link to="/katalog">
                    <Disc className="h-5 w-5" />
                    Katalog
                  </Link>
                </Button>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-[100px]" />
            <div className="absolute right-20 bottom-0 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
            <div className="absolute right-10 top-10 opacity-10">
              <Music className="h-48 w-48" />
            </div>
          </section>

          {/* Quick Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { icon: Users, value: stats.artists, label: "Künstler", color: "text-primary" },
              { icon: Disc, value: stats.albums, label: "Alben", color: "text-violet-400" },
              { icon: Music, value: stats.songs, label: "Songs", color: "text-cyan-400" },
              { icon: Clock, value: allSongsWithAudio.length, label: "Abspielbar", color: "text-emerald-400" },
            ].map((stat, idx) => (
              <Card key={idx} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl md:text-4xl font-display font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                    </div>
                    <div className={cn("p-2.5 rounded-xl bg-muted/50 group-hover:bg-muted transition-colors", stat.color)}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* Genre Playlists with Image Collage */}
          {playlists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl font-bold">Genre-Mixe</h2>
                </div>
                <Link to="/katalog" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Alle anzeigen <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => handlePlayPlaylist(playlist)}
                    className="group relative overflow-hidden rounded-2xl aspect-square transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                  >
                    {/* Background Image Collage or Gradient */}
                    {playlist.coverImages.length >= 4 ? (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                        {playlist.coverImages.slice(0, 4).map((img, idx) => (
                          <div key={idx} className="overflow-hidden">
                            <img 
                              src={img} 
                              alt="" 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          </div>
                        ))}
                      </div>
                    ) : playlist.coverImages.length > 0 ? (
                      <div className="absolute inset-0">
                        <img 
                          src={playlist.coverImages[0]} 
                          alt="" 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                    ) : (
                      <div className={cn("absolute inset-0 bg-gradient-to-br", playlist.accentColor)} />
                    )}
                    
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-5">
                      <h3 className="font-display font-bold text-white text-xl md:text-2xl leading-tight drop-shadow-lg">
                        {playlist.title}
                      </h3>
                      <p className="text-white/70 text-sm mt-1">{playlist.description}</p>
                    </div>
                    
                    {/* Play button on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20">
                      <div className="p-4 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-8 w-8 ml-1" fill="currentColor" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Top Artists */}
          {topArtists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl font-bold">Top Künstler</h2>
                </div>
                <Link to="/katalog" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Alle anzeigen <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <ScrollArea className="w-full -mx-4 px-4">
                <div className="flex gap-5 pb-4">
                  {topArtists.map((artist) => {
                    const songCount = artist.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
                    return (
                      <Link
                        key={artist.id}
                        to="/katalog"
                        className="group flex-shrink-0 w-32 md:w-40"
                      >
                        <div className="relative aspect-square rounded-full overflow-hidden mb-4 ring-4 ring-transparent group-hover:ring-primary/50 transition-all duration-300 shadow-xl shadow-black/20 group-hover:shadow-primary/20">
                          {artist.profile_image_url ? (
                            <img
                              src={artist.profile_image_url}
                              alt={artist.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                              <Users className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          {/* Hover play indicator */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-10 w-10 text-white" fill="white" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-center truncate group-hover:text-primary transition-colors">
                          {artist.name}
                        </h3>
                        <p className="text-xs text-muted-foreground text-center mt-0.5">
                          {artist.genre} • {songCount} Songs
                        </p>
                      </Link>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Recently Added */}
          {recentlyAdded.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl font-bold">Kürzlich hinzugefügt</h2>
                </div>
              </div>
              <Card className="bg-card/30 backdrop-blur-sm border-border/50 overflow-hidden">
                <div className="divide-y divide-border/50">
                  {recentlyAdded.slice(0, 8).map((item, idx) => {
                    const isCurrentlyPlaying = currentTrack?.id === item.song.id && isPlaying;
                    return (
                      <button
                        key={item.song.id}
                        onClick={() => handlePlaySong(item)}
                        className={cn(
                          "flex items-center gap-4 p-4 transition-colors text-left w-full group",
                          "hover:bg-muted/30",
                          isCurrentlyPlaying && "bg-primary/10"
                        )}
                      >
                        <span className="w-8 text-center text-muted-foreground text-sm font-medium">
                          {isCurrentlyPlaying ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                              <span className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                              <span className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                          ) : (
                            <span className="group-hover:hidden">{idx + 1}</span>
                          )}
                          {!isCurrentlyPlaying && (
                            <Play className="h-4 w-4 hidden group-hover:block mx-auto text-primary" fill="currentColor" />
                          )}
                        </span>
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                          {item.artist.profile_image_url ? (
                            <img
                              src={item.artist.profile_image_url}
                              alt={item.artist.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                              <Music className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium truncate transition-colors",
                            isCurrentlyPlaying ? "text-primary" : "group-hover:text-primary"
                          )}>
                            {item.song.name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.artist.name} • {item.albumName}
                          </p>
                        </div>
                        <div className="hidden md:flex items-center gap-4 text-muted-foreground text-sm">
                          {item.song.bpm && (
                            <span className="tabular-nums">{item.song.bpm} BPM</span>
                          )}
                          {item.song.tonart && (
                            <span className="w-16 text-right">{item.song.tonart}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}

          {/* Empty State */}
          {allSongsWithAudio.length === 0 && (
            <section className="text-center py-20">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <div className="relative p-6 rounded-full bg-muted/50 border border-border">
                  <Music className="h-16 w-16 text-muted-foreground" />
                </div>
              </div>
              <h2 className="font-display text-3xl font-bold mb-3">Noch keine Musik verfügbar</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Erstelle Künstler und lade ihre Songs ab, um hier deine Musikbibliothek zu sehen.
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/erweitern">
                    <Sparkles className="h-5 w-5 mr-2" />
                    Künstler erstellen
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/katalog">Katalog ansehen</Link>
                </Button>
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
