import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Database, FileJson, FileSpreadsheet, Search, Users, Disc, Music
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { SongDetailDialog } from "@/components/SongDetailDialog";
import { Pagination } from "@/components/Pagination";
import { ArtistTreeRow } from "@/components/catalog/CatalogSongTree";
import { ArtistWithSocialCard } from "@/components/catalog/ArtistWithSocialCard";
import { EmptyState } from "@/components/catalog/EmptyState";
import { LoadingSpinner } from "@/components/catalog/LoadingSpinner";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { 
  useCatalogData, 
  useFilteredCatalog, 
  usePagination,
  type Song 
} from "@/hooks/useCatalogData";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const Katalog = () => {
  const { artists, stats, isLoading, loadData, deleteArtist } = useCatalogData();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSong, setSelectedSong] = useState<{ 
    song: Song; 
    artistName: string; 
    albumName: string 
  } | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
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

  const playAudio = useCallback((audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingAudio === audioUrl) {
      setPlayingAudio(null);
      return;
    }
    const audio = new Audio(audioUrl);
    audio.play();
    audio.onended = () => setPlayingAudio(null);
    audioRef.current = audio;
    setPlayingAudio(audioUrl);
  }, [playingAudio]);

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

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container h-full py-6">
          <div className="flex flex-col h-full gap-4 min-h-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={isExporting || stats.songs === 0}
                  className="h-9"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  disabled={isExporting || stats.songs === 0}
                  className="h-9"
                >
                  <FileJson className="h-4 w-4" />
                  <span className="hidden sm:inline">JSON</span>
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="artists" className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TabsList className="shrink-0 w-fit">
                <TabsTrigger value="artists" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Künstler</span>
                  <span className="text-xs opacity-70">({filteredArtists.length})</span>
                </TabsTrigger>
                <TabsTrigger value="songs" className="gap-2">
                  <Disc className="h-4 w-4" />
                  <span className="hidden sm:inline">Alben & Songs</span>
                  <span className="text-xs opacity-70">({stats.songs})</span>
                </TabsTrigger>
              </TabsList>

              {/* Artists Tab - Shows artist info + social content */}
              <TabsContent value="artists" className="flex-1 min-h-0 mt-4 flex flex-col data-[state=active]:flex">
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
                    <div className="space-y-3 pr-2">
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
                  <div className="shrink-0 pt-3 border-t border-border mt-3">
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
              <TabsContent value="songs" className="flex-1 min-h-0 mt-4 flex flex-col data-[state=active]:flex">
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
                    <div className="space-y-2 pr-2">
                      {songsPagination.items.map(artist => (
                        <ArtistTreeRow
                          key={artist.id}
                          artist={artist}
                          isExpanded={expandedArtists.has(artist.id)}
                          expandedAlbums={expandedAlbums}
                          onToggleArtist={() => toggleArtist(artist.id)}
                          onToggleAlbum={toggleAlbum}
                          playingAudio={playingAudio}
                          onPlayAudio={playAudio}
                          onSelectSong={handleSelectSong}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {songsPagination.totalPages > 1 && (
                  <div className="shrink-0 pt-3 border-t border-border mt-3">
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

      {selectedSong && (
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
    </div>
  );
};

export default Katalog;
