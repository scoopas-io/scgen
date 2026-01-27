import { useState, useEffect, useCallback } from "react";
import { 
  Database, FileJson, FileSpreadsheet, Search, Users, Disc, Music
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        <div className="container h-full py-4 md:py-6 px-3 md:px-6">
          <div className="flex flex-col h-full gap-3 md:gap-4 min-h-0">
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
                    {stats.songs}
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
                  <span className="hidden xs:inline">Songs</span>
                  <span className="text-[10px] sm:text-xs opacity-70">({stats.songs})</span>
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
