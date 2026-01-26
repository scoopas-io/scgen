import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Shuffle, Clock, Music, Disc, TrendingUp, Sparkles, Users } from "lucide-react";
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
  gradient: string;
}

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

  // Recently added (newest songs) - use album songs order as proxy
  const recentlyAdded = useMemo(() => {
    return [...allSongsWithAudio].slice(0, 10);
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

  // Generate dynamic playlists based on genres
  const playlists = useMemo((): PlaylistCard[] => {
    const genreMap = new Map<string, Array<{ song: Song; artist: ArtistWithAlbums; albumName: string }>>();
    
    allSongsWithAudio.forEach(item => {
      const genre = item.artist.genre;
      if (!genreMap.has(genre)) {
        genreMap.set(genre, []);
      }
      genreMap.get(genre)!.push(item);
    });

    const gradients = [
      "from-primary/80 to-primary/20",
      "from-purple-600/80 to-purple-900/20",
      "from-blue-600/80 to-blue-900/20",
      "from-emerald-600/80 to-emerald-900/20",
      "from-orange-600/80 to-orange-900/20",
      "from-rose-600/80 to-rose-900/20",
    ];

    return Array.from(genreMap.entries())
      .filter(([_, songs]) => songs.length >= 3)
      .slice(0, 6)
      .map(([genre, songs], idx) => ({
        id: genre,
        title: `${genre} Mix`,
        description: `${songs.length} Songs`,
        songs: songs.slice(0, 20),
        gradient: gradients[idx % gradients.length],
      }));
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
          <div className="animate-pulse text-muted-foreground">Lade Musikbibliothek...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader stats={stats} />
      
      <ScrollArea className="flex-1">
        <div className="container py-6 px-4 md:px-6 space-y-8">
          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/30 via-background to-background p-6 md:p-8">
            <div className="relative z-10">
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
                Willkommen zurück
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                {allSongsWithAudio.length} Songs bereit zum Abspielen
              </p>
              <div className="flex gap-3">
                <Button 
                  size="lg" 
                  className="gap-2"
                  onClick={handleShuffleAll}
                  disabled={allSongsWithAudio.length === 0}
                >
                  <Shuffle className="h-5 w-5" />
                  Zufallsmix
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/katalog">
                    <Disc className="h-5 w-5 mr-2" />
                    Katalog durchsuchen
                  </Link>
                </Button>
              </div>
            </div>
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
          </section>

          {/* Quick Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{stats.artists}</p>
                  <p className="text-xs text-muted-foreground">Künstler</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Disc className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{stats.albums}</p>
                  <p className="text-xs text-muted-foreground">Alben</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{stats.songs}</p>
                  <p className="text-xs text-muted-foreground">Songs</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{allSongsWithAudio.length}</p>
                  <p className="text-xs text-muted-foreground">Abspielbar</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Genre Playlists */}
          {playlists.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-bold">Genre-Mixe</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => handlePlayPlaylist(playlist)}
                    className="group relative overflow-hidden rounded-xl aspect-square transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br",
                      playlist.gradient
                    )} />
                    <div className="absolute inset-0 flex flex-col justify-end p-4">
                      <h3 className="font-display font-bold text-white text-lg leading-tight">{playlist.title}</h3>
                      <p className="text-white/70 text-sm">{playlist.description}</p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="p-3 rounded-full bg-primary text-primary-foreground">
                        <Play className="h-6 w-6" />
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
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-bold">Top Künstler</h2>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {topArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      to="/katalog"
                      className="group flex-shrink-0 w-36 md:w-44"
                    >
                      <div className="relative aspect-square rounded-full overflow-hidden mb-3 ring-2 ring-transparent group-hover:ring-primary transition-all">
                        {artist.profile_image_url ? (
                          <img
                            src={artist.profile_image_url}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Users className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-medium text-center truncate">{artist.name}</h3>
                      <p className="text-xs text-muted-foreground text-center">{artist.genre}</p>
                    </Link>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Recently Added */}
          {recentlyAdded.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-bold">Kürzlich hinzugefügt</h2>
              </div>
              <div className="grid gap-2">
                {recentlyAdded.slice(0, 8).map((item, idx) => {
                  const isCurrentlyPlaying = currentTrack?.id === item.song.id && isPlaying;
                  return (
                    <button
                      key={item.song.id}
                      onClick={() => handlePlaySong(item)}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg transition-colors text-left w-full",
                        "hover:bg-muted/50",
                        isCurrentlyPlaying && "bg-primary/10"
                      )}
                    >
                      <span className="w-6 text-center text-muted-foreground text-sm">
                        {isCurrentlyPlaying ? (
                          <Music className="h-4 w-4 text-primary animate-pulse mx-auto" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                        {item.artist.profile_image_url ? (
                          <img
                            src={item.artist.profile_image_url}
                            alt={item.artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium truncate",
                          isCurrentlyPlaying && "text-primary"
                        )}>
                          {item.song.name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.artist.name} • {item.albumName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground text-sm">
                        {item.song.bpm && <span>{item.song.bpm} BPM</span>}
                        {item.song.tonart && <span>{item.song.tonart}</span>}
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
              <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Noch keine Musik verfügbar</h2>
              <p className="text-muted-foreground mb-6">
                Erstelle Künstler und lade ihre Songs ab, um hier Musik zu sehen.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link to="/erweitern">Künstler erstellen</Link>
                </Button>
                <Button variant="outline" asChild>
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
