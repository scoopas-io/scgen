import { useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  BarChart3, 
  Users, 
  Disc, 
  Music, 
  FileText, 
  Download,
  Play,
  PieChart,
  Building2,
  Shield,
  Coins,
  Info,
  Printer,
  TrendingUp,
  ChevronRight,
  Calendar,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { exportCatalogAsPDF } from "@/lib/exportCatalogPDF";

// Compact stat card for key metrics
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  trend 
}: { 
  icon: React.ElementType;
  label: string; 
  value: string | number; 
  subValue?: string;
  trend?: "up" | "stable";
}) => (
  <Card className="bg-card/50 border-border/50">
    <CardContent className="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
          <p className="text-2xl md:text-3xl font-bold tabular-nums">{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          )}
        </div>
        <div className={cn(
          "p-2.5 rounded-lg",
          trend === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Genre distribution row
const GenreRow = ({ 
  genre, 
  count, 
  percentage, 
  artistCount 
}: { 
  genre: string; 
  count: number; 
  percentage: number;
  artistCount: number;
}) => (
  <div className="flex items-center gap-3 py-2.5">
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium truncate">{genre}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{artistCount} Künstler</p>
    </div>
  </div>
);

// Top artist row for the table
const ArtistRow = ({ 
  artist, 
  songCount, 
  albumCount,
  rank
}: { 
  artist: ArtistWithAlbums; 
  songCount: number; 
  albumCount: number;
  rank: number;
}) => (
  <div className="flex items-center gap-3 py-2.5 px-1 hover:bg-muted/30 rounded-lg transition-colors">
    <span className="w-6 text-center text-xs text-muted-foreground font-medium">{rank}</span>
    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted/50">
      {artist.profile_image_url ? (
        <img src={artist.profile_image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{artist.name}</p>
      <p className="text-xs text-muted-foreground">{artist.genre}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-medium tabular-nums">{songCount}</p>
      <p className="text-xs text-muted-foreground">{albumCount} Alben</p>
    </div>
  </div>
);

// Recent song row with play button
const RecentSongRow = ({ 
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
      "flex items-center gap-3 py-2.5 px-1 w-full text-left rounded-lg transition-colors",
      "hover:bg-muted/30 active:scale-[0.99]",
      isPlaying && "bg-primary/10"
    )}
  >
    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted/50 relative group">
      {item.artist.profile_image_url ? (
        <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Music className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
        <Play className="h-4 w-4 text-white" fill="white" />
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("text-sm font-medium truncate", isPlaying && "text-primary")}>{item.song.name}</p>
      <p className="text-xs text-muted-foreground truncate">{item.artist.name}</p>
    </div>
    <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{item.artist.genre}</Badge>
  </button>
);

export default function Home() {
  const { artists, stats, isLoading } = useCatalogData();
  const { play, currentTrack } = useAudioPlayer();
  const playerHeight = usePlayerHeight();
  const { isAdmin } = useAuth();

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

  // Total available audio tracks (V1 + V2)
  const totalAvailableTracks = useMemo(() => {
    return allSongsWithAudio.length + songsWithV2Count;
  }, [allSongsWithAudio.length, songsWithV2Count]);

  // Total songs (with and without audio)
  const totalSongs = useMemo(() => {
    return artists.reduce((acc, artist) => 
      acc + artist.albums.reduce((a, album) => a + album.songs.length, 0), 0
    );
  }, [artists]);

  // Recently added songs
  const recentlyAdded = useMemo(() => {
    const getGenerationTimestamp = (audioUrl: string): number => {
      const match = audioUrl.match(/_(\d{13})\.mp3$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return [...allSongsWithAudio]
      .sort((a, b) => getGenerationTimestamp(b.song.audio_url || "") - getGenerationTimestamp(a.song.audio_url || ""))
      .slice(0, 6);
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
    const total = allSongsWithAudio.length;
    return Array.from(genreMap.entries())
      .map(([genre, data]) => ({
        genre,
        count: data.songs,
        artistCount: data.artists.size,
        percentage: total > 0 ? (data.songs / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allSongsWithAudio]);

  // Top artists by song count
  const topArtists = useMemo(() => {
    return [...artists]
      .map(artist => {
        const songCount = artist.albums.reduce((acc, al) => acc + al.songs.filter(s => s.audio_url).length, 0);
        const albumCount = artist.albums.filter(al => al.songs.some(s => s.audio_url)).length;
        return { artist, songCount, albumCount };
      })
      .filter(a => a.songCount > 0)
      .sort((a, b) => b.songCount - a.songCount)
      .slice(0, 8);
  }, [artists]);

  // Coverage percentage
  const coveragePercent = useMemo(() => {
    if (totalSongs === 0) return 0;
    return Math.round((allSongsWithAudio.length / totalSongs) * 100);
  }, [allSongsWithAudio.length, totalSongs]);

  // Catalog value estimation (Eigeneinschätzung) - includes V2 versions
  const catalogValuation = useMemo(() => {
    // Use total available tracks (V1 + V2) for valuation
    const trackCount = totalAvailableTracks;
    const genreCount = genreStats.length;
    const artistCount = stats.artists;
    
    // Base value per track (in EUR)
    const baseValuePerTrack = 850;
    
    // Genre diversity multiplier (more genres = more versatile catalog)
    const genreDiversityBonus = Math.min(genreCount / 10, 1) * 0.25; // up to 25% bonus
    
    // Artist diversity multiplier
    const artistDiversityBonus = Math.min(artistCount / 20, 1) * 0.15; // up to 15% bonus
    
    // Rights status bonus (100% Eigenproduktion = full control)
    const rightsBonus = 0.20; // 20% premium for full rights
    
    // V2 coverage bonus (having alternative versions increases value)
    const v2CoverageRatio = allSongsWithAudio.length > 0 ? songsWithV2Count / allSongsWithAudio.length : 0;
    const v2Bonus = v2CoverageRatio * 0.10; // up to 10% bonus for full V2 coverage
    
    // Calculate total multiplier
    const totalMultiplier = 1 + genreDiversityBonus + artistDiversityBonus + rightsBonus + v2Bonus;
    
    // Calculate estimated value
    const estimatedValue = Math.round(trackCount * baseValuePerTrack * totalMultiplier);
    
    return {
      estimatedValue,
      baseValue: trackCount * baseValuePerTrack,
      genreDiversityBonus: Math.round(genreDiversityBonus * 100),
      artistDiversityBonus: Math.round(artistDiversityBonus * 100),
      rightsBonus: Math.round(rightsBonus * 100),
      v2Bonus: Math.round(v2Bonus * 100),
      totalMultiplier: Math.round(totalMultiplier * 100),
      trackCount,
    };
  }, [totalAvailableTracks, genreStats.length, stats.artists, allSongsWithAudio.length, songsWithV2Count]);

  // GEMA/ISRC/ISWC Statistics
  const registrationStats = useMemo(() => {
    const allSongs: Song[] = [];
    artists.forEach(artist => {
      artist.albums.forEach(album => {
        album.songs.forEach(song => allSongs.push(song));
      });
    });

    const total = allSongs.length;
    const gemaRegistered = allSongs.filter(s => s.gema_werknummer && s.gema_werknummer.trim() !== "").length;
    const isrcRegistered = allSongs.filter(s => s.isrc && s.isrc.trim() !== "").length;
    const iswcRegistered = allSongs.filter(s => s.iswc && s.iswc.trim() !== "").length;

    return {
      total,
      gema: { registered: gemaRegistered, pending: total - gemaRegistered, percent: total > 0 ? Math.round((gemaRegistered / total) * 100) : 0 },
      isrc: { registered: isrcRegistered, pending: total - isrcRegistered, percent: total > 0 ? Math.round((isrcRegistered / total) * 100) : 0 },
      iswc: { registered: iswcRegistered, pending: total - iswcRegistered, percent: total > 0 ? Math.round((iswcRegistered / total) * 100) : 0 },
    };
  }, [artists]);

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
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">Katalogübersicht</span>
                </div>
                <h1 className="font-display text-xl md:text-2xl font-bold">
                  Musikkatalog Analyse
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => exportCatalogAsPDF()}
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">PDF-Report</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => exportCatalogAsCSV()}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => exportCatalogAsJSON()}
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">JSON</span>
                </Button>
                <Button size="sm" className="gap-2" asChild>
                  <Link to="/katalog">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Vollständiger </span>Katalog
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Catalog Valuation - Compact */}
          <Card className="bg-card/50 border-border/50 mb-6 md:mb-8">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Value */}
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Geschätzter Katalogwert</p>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {catalogValuation.estimatedValue.toLocaleString('de-DE')} €
                    </p>
                  </div>
                </div>
                
                {/* Right: Breakdown */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{catalogValuation.trackCount.toLocaleString('de-DE')} Tracks × 850 €</span>
                  <span className="text-emerald-500">+{catalogValuation.genreDiversityBonus}% Genre</span>
                  <span className="text-blue-500">+{catalogValuation.artistDiversityBonus}% Künstler</span>
                  <span className="text-amber-500">+{catalogValuation.rightsBonus}% Vollrechte</span>
                  {catalogValuation.v2Bonus > 0 && (
                    <span className="text-purple-500">+{catalogValuation.v2Bonus}% V2</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
            <StatCard 
              icon={Music}
              label="Titel im Katalog"
              value={totalSongs.toLocaleString('de-DE')}
              subValue={coveragePercent === 100 ? "100% mit Audio ✓" : `${allSongsWithAudio.length.toLocaleString('de-DE')} mit Audio (${coveragePercent}%)`}
              trend={coveragePercent === 100 ? "up" : undefined}
            />
            <StatCard 
              icon={Disc}
              label="Verfügbare Tracks"
              value={totalAvailableTracks.toLocaleString('de-DE')}
              subValue={songsWithV2Count > 0 ? `inkl. ${songsWithV2Count} V2-Versionen` : "V1 Versionen"}
              trend={songsWithV2Count > 0 ? "up" : undefined}
            />
            <StatCard 
              icon={Users}
              label="Künstler"
              value={stats.artists}
              subValue={`${genreStats.length} Genres`}
            />
            <StatCard 
              icon={Disc}
              label="Alben"
              value={stats.albums}
              subValue="im Katalog"
            />
            <StatCard 
              icon={Shield}
              label="Rechtestatus"
              value="100%"
              subValue="Eigenproduktion"
              trend="stable"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            
            {/* Genre Distribution */}
            <Card className="lg:col-span-1 bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Genre-Verteilung
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {genreStats.map((item) => (
                    <GenreRow
                      key={item.genre}
                      genre={item.genre}
                      count={item.count}
                      percentage={item.percentage}
                      artistCount={item.artistCount}
                    />
                  ))}
                </div>
                {genreStats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Daten verfügbar
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top Artists */}
            <Card className="lg:col-span-1 bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Top Künstler
                  </CardTitle>
                  <Link to="/katalog" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5">
                    Alle <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-0.5">
                  {topArtists.map((item, idx) => (
                    <ArtistRow
                      key={item.artist.id}
                      artist={item.artist}
                      songCount={item.songCount}
                      albumCount={item.albumCount}
                      rank={idx + 1}
                    />
                  ))}
                </div>
                {topArtists.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Künstler verfügbar
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Additions */}
            <Card className="lg:col-span-1 bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Zuletzt hinzugefügt
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-0.5">
                  {recentlyAdded.map((item) => (
                    <RecentSongRow
                      key={item.song.id}
                      item={item}
                      onPlay={() => handlePlaySong(item)}
                      isPlaying={currentTrack?.id === item.song.id}
                    />
                  ))}
                </div>
                {recentlyAdded.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Titel verfügbar
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Footer Info */}
          <div className="mt-6 md:mt-8 pt-4 border-t border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Alle Rechte gesichert
                </span>
                <span>Eigenproduktion</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Datenexport verfügbar</span>
                <Separator orientation="vertical" className="h-3" />
                <Link to="/katalog" className="hover:text-primary transition-colors flex items-center gap-1">
                  Detailansicht <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
