import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Database, FileJson, FileSpreadsheet, Search, Users, Disc, Music,
  Coins, Shield, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppHeader } from "@/components/AppHeader";
import { SongDetailDialog } from "@/components/SongDetailDialog";
import { SongInfoDialog } from "@/components/catalog/SongInfoDialog";
import { Pagination } from "@/components/Pagination";
import { ArtistTreeRow } from "@/components/catalog/CatalogSongTree";
import { ArtistWithSocialCard } from "@/components/catalog/ArtistWithSocialCard";
import { EmptyState } from "@/components/catalog/EmptyState";
import { LoadingSpinner } from "@/components/catalog/LoadingSpinner";
import { V2ProgressPanel } from "@/components/catalog/V2ProgressPanel";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useCatalogData, 
  useFilteredCatalog, 
  usePagination,
  type Song 
} from "@/hooks/useCatalogData";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const Katalog = () => {
  const { artists, stats, isLoading, loadData, deleteArtist } = useCatalogData();
  const { play, currentTrack, isPlaying, pause, resume } = useAudioPlayer();
  const playerHeight = usePlayerHeight();
  const { isAdmin } = useAuth();

  // Valuation calculations
  const allSongsWithAudio = useMemo(() => {
    const songs: Array<{ song: Song; artistGenre: string; artistId: string }> = [];
    artists.forEach(artist => {
      artist.albums.forEach(album => {
        album.songs.forEach(song => {
          if (song.audio_url) songs.push({ song, artistGenre: artist.genre, artistId: artist.id });
        });
      });
    });
    return songs;
  }, [artists]);

  const totalSongs = useMemo(() =>
    artists.reduce((acc, a) => acc + a.albums.reduce((b, al) => b + al.songs.length, 0), 0),
  [artists]);

  const songsWithV2Count = useMemo(() => {
    let count = 0;
    artists.forEach(a => a.albums.forEach(al => al.songs.forEach(s => { if (s.alternative_audio_url) count++; })));
    return count;
  }, [artists]);

  const totalAvailableTracks = totalSongs + songsWithV2Count;
  const potentialV2Count = allSongsWithAudio.length;
  const totalPotentialTracks = totalSongs + potentialV2Count;

  const genreStats = useMemo(() => {
    const map = new Map<string, { songs: number; artists: Set<string> }>();
    allSongsWithAudio.forEach(({ artistGenre, artistId }) => {
      const e = map.get(artistGenre) || { songs: 0, artists: new Set<string>() };
      e.songs++; e.artists.add(artistId);
      map.set(artistGenre, e);
    });
    return Array.from(map.entries()).map(([g, d]) => ({ genre: g, count: d.songs, artistCount: d.artists.size }));
  }, [allSongsWithAudio]);

  const catalogValuation = useMemo(() => {
    const genreDiversityBonus = Math.min(genreStats.length / 10, 1) * 0.25;
    const artistDiversityBonus = Math.min(stats.artists / 20, 1) * 0.15;
    const totalMultiplier = 1 + genreDiversityBonus + artistDiversityBonus + 0.20;
    return Math.round(totalPotentialTracks * 850 * totalMultiplier);
  }, [totalPotentialTracks, genreStats.length, stats.artists]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSong, setSelectedSong] = useState<{ 
    song: Song; 
    artistName: string; 
    albumName: string 
  } | null>(null);
  
  // Pagination state
  const [artistsPage, setArtistsPage] = useState(1);
  const [songsPage, setSongsPage] = useState(1);
  const [artistsPerPage, setArtistsPerPage] = useState(10);
  const [songsPerPage, setSongsPerPage] = useState(25);

  // Filter and paginate
  const filteredArtists = useFilteredCatalog(artists, searchQuery);
  const artistsPagination = usePagination(filteredArtists, artistsPage, artistsPerPage);
  const songsPagination = usePagination(filteredArtists, songsPage, songsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setArtistsPage(1);
    setSongsPage(1);
  }, [searchQuery]);

  const toggleArtist = useCallback((artistId: string) => {
    setExpandedArtists(prev => {
      const next = new Set(prev);
      if (next.has(artistId)) {
        next.delete(artistId);
      } else {
        next.add(artistId);
      }
      return next;
    });
  }, []);

  const toggleAlbum = useCallback((albumId: string) => {
    setExpandedAlbums(prev => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  }, []);

  // Play audio using global player with full metadata for editing
  const handlePlayAudio = useCallback((params: {
    url: string;
    songId: string;
    songName: string;
    artistId: string;
    artistName: string;
    albumId: string;
    albumName: string;
    artistImageUrl?: string;
  }) => {
    // If same track is playing, toggle pause/resume
    if (currentTrack?.audioUrl === params.url) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }
    
    // Play new track with all IDs for editing
    play({
      id: params.songId,
      title: params.songName,
      artist: params.artistName,
      artistImageUrl: params.artistImageUrl,
      album: params.albumName,
      audioUrl: params.url,
      songId: params.songId,
      artistId: params.artistId,
      albumId: params.albumId,
    });
  }, [currentTrack, isPlaying, pause, resume, play]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await exportCatalogAsCSV();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      await exportCatalogAsJSON();
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectSong = useCallback((song: Song, artistName: string, albumName: string) => {
    setSelectedSong({ song, artistName, albumName });
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader stats={stats} />

      <main className="flex-1 min-h-0 overflow-hidden" style={{ paddingBottom: playerHeight }}>
        <div className="container h-full py-4 md:py-6">
          <div className="flex flex-col h-full gap-3 md:gap-4 min-h-0">

            {/* Valuation Card — Admin only */}
            {isAdmin && (
              <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/50 shrink-0">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <Coins className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Rechnerischer Katalogwert</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-left">
                              <p className="font-medium mb-1">Berechnungsmethodik</p>
                              <p className="text-xs text-muted-foreground">
                                Basiswert: 850 € pro Titel (V1+V2)<br />
                                + Genre-Vielfalt: bis zu +25%<br />
                                + Künstler-Diversität: bis zu +15%<br />
                                + Vollrechte (scoopas GmbH): +20%
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-2xl font-bold text-primary tabular-nums">
                          {catalogValuation.toLocaleString('de-DE')} €
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 text-center">
                      <div>
                        <p className="text-lg font-bold tabular-nums">{totalAvailableTracks.toLocaleString('de-DE')}</p>
                        <p className="text-xs text-muted-foreground">Titel (V1+V2)</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums">{songsWithV2Count.toLocaleString('de-DE')}</p>
                        <p className="text-xs text-muted-foreground">V2-Versionen</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums">{stats.artists}</p>
                        <p className="text-xs text-muted-foreground">Künstler</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums">{stats.albums}</p>
                        <p className="text-xs text-muted-foreground">Alben</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>100% Eigenproduktion</span>
                    <span>•</span>
                    <span>{genreStats.length} Genres</span>
                    <span>•</span>
                    <span>{potentialV2Count} potenzielle V2</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Toolbar - Mobile optimized */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 text-sm"
                  />
                </div>
                {/* Stats badges - hidden on mobile, shown in header drawer */}
                <div className="hidden lg:flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5">
                    <Users className="h-3 w-3" />
                    {stats.artists}
                  </Badge>
                  <Badge variant="secondary" className="gap-1.5">
                    <Disc className="h-3 w-3" />
                    {stats.albums}
                  </Badge>
                  <Badge variant="secondary" className="gap-1.5">
                    <Music className="h-3 w-3" />
                    {stats.totalTracks}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={isExporting || stats.songs === 0}
                  className="h-8 sm:h-9 flex-1 sm:flex-initial text-xs sm:text-sm"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="ml-1.5">CSV</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  disabled={isExporting || stats.songs === 0}
                  className="h-8 sm:h-9 flex-1 sm:flex-initial text-xs sm:text-sm"
                >
                  <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="ml-1.5">JSON</span>
                </Button>
              </div>
            </div>

            {/* V2 Progress Panel */}
            <V2ProgressPanel artists={artists} onRefresh={loadData} />

            {/* Tabs - Mobile optimized */}
            <Tabs defaultValue="artists" className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TabsList className="shrink-0 w-full sm:w-fit grid grid-cols-2 sm:flex h-9 sm:h-10">
                <TabsTrigger value="artists" className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Künstler</span>
                  <span className="text-[10px] sm:text-xs opacity-70">({filteredArtists.length})</span>
                </TabsTrigger>
                <TabsTrigger value="songs" className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Disc className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Titel</span>
                  <span className="text-[10px] sm:text-xs opacity-70">({stats.totalTracks})</span>
                </TabsTrigger>
              </TabsList>

              {/* Artists Tab - Shows artist info + social content */}
              <TabsContent value="artists" className="flex-1 min-h-0 mt-3 md:mt-4 flex flex-col data-[state=active]:flex">
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {isLoading ? (
                    <LoadingSpinner message="Lade Künstler..." />
                  ) : filteredArtists.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title={searchQuery ? "Keine Ergebnisse" : "Keine Künstler"}
                      description={searchQuery 
                        ? "Versuche einen anderen Suchbegriff" 
                        : "Generiere Künstler im Generator, um sie hier zu sehen"
                      }
                      actionLabel={!searchQuery ? "Zum Generator" : undefined}
                      actionHref={!searchQuery ? "/" : undefined}
                    />
                  ) : (
                    <div className="space-y-2 sm:space-y-3 pr-1 sm:pr-2">
                      {artistsPagination.items.map(artist => (
                        <ArtistWithSocialCard
                          key={artist.id}
                          artist={artist}
                          onDelete={deleteArtist}
                          onRefresh={loadData}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {artistsPagination.totalPages > 1 && (
                  <div className="shrink-0 pt-2 sm:pt-3 border-t border-border mt-2 sm:mt-3">
                    <Pagination
                      currentPage={artistsPage}
                      totalPages={artistsPagination.totalPages}
                      totalItems={artistsPagination.totalItems}
                      itemsPerPage={artistsPerPage}
                      itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
                      onPageChange={setArtistsPage}
                      onItemsPerPageChange={(count) => {
                        setArtistsPerPage(count);
                        setArtistsPage(1);
                      }}
                      itemLabel="Künstler"
                    />
                  </div>
                )}
              </TabsContent>

              {/* Albums & Songs Tab */}
              <TabsContent value="songs" className="flex-1 min-h-0 mt-3 md:mt-4 flex flex-col data-[state=active]:flex">
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {isLoading ? (
                    <LoadingSpinner message="Lade Katalog..." />
                  ) : filteredArtists.length === 0 ? (
                    <EmptyState
                      icon={Disc}
                      title={searchQuery ? "Keine Ergebnisse" : "Katalog ist leer"}
                      description={searchQuery 
                        ? "Versuche einen anderen Suchbegriff" 
                        : "Generiere Künstler im Generator, um den Katalog zu füllen"
                      }
                      actionLabel={!searchQuery ? "Zum Generator" : undefined}
                      actionHref={!searchQuery ? "/" : undefined}
                    />
                  ) : (
                    <div className="space-y-1.5 sm:space-y-2 pr-1 sm:pr-2 pb-20">
                      {songsPagination.items.map(artist => (
                        <ArtistTreeRow
                          key={artist.id}
                          artist={artist}
                          isExpanded={expandedArtists.has(artist.id)}
                          expandedAlbums={expandedAlbums}
                          onToggleArtist={() => toggleArtist(artist.id)}
                          onToggleAlbum={toggleAlbum}
                          currentTrackUrl={currentTrack?.audioUrl || null}
                          isPlaying={isPlaying}
                          onPlayAudio={handlePlayAudio}
                          onSelectSong={handleSelectSong}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {songsPagination.totalPages > 1 && (
                  <div className="shrink-0 pt-2 sm:pt-3 border-t border-border mt-2 sm:mt-3">
                    <Pagination
                      currentPage={songsPage}
                      totalPages={songsPagination.totalPages}
                      totalItems={songsPagination.totalItems}
                      itemsPerPage={songsPerPage}
                      itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
                      onPageChange={setSongsPage}
                      onItemsPerPageChange={(count) => {
                        setSongsPerPage(count);
                        setSongsPage(1);
                      }}
                      itemLabel="Künstler"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {selectedSong && isAdmin && (
        <SongDetailDialog
          open={!!selectedSong}
          onOpenChange={() => setSelectedSong(null)}
          song={{
            ...selectedSong.song,
            song_id: selectedSong.song.song_id || null,
          } as any}
          artistName={selectedSong.artistName}
          albumName={selectedSong.albumName}
          onSaved={loadData}
        />
      )}
      
      {selectedSong && !isAdmin && (
        <SongInfoDialog
          open={!!selectedSong}
          onOpenChange={() => setSelectedSong(null)}
          song={selectedSong.song}
          artistName={selectedSong.artistName}
          albumName={selectedSong.albumName}
        />
      )}
    </div>
  );
};

export default Katalog;
