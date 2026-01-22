import { useState, useEffect } from "react";
import { Music, Zap, History, X, Database, Download, FileJson, FileSpreadsheet, Volume2, ListMusic, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratorControls } from "@/components/GeneratorControls";
import { GenreFilter } from "@/components/GenreFilter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ArtistCard, type Artist } from "@/components/ArtistCard";
import { LoadingState, type GenerationPhase } from "@/components/LoadingState";
import { SunoGeneratorDialog } from "@/components/SunoGeneratorDialog";
import { ScoopasIcon } from "@/components/ScoopasIcon";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

const BATCH_SIZE = 10; // Artists per batch for bulk generation

const Index = () => {
  const [artistCount, setArtistCount] = useState(3);
  const [albumCount, setAlbumCount] = useState(2);
  const [songCount, setSongCount] = useState(5);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [savedArtists, setSavedArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0 });
  const [sunoDialogOpen, setSunoDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generationState, setGenerationState] = useState<{
    phase: GenerationPhase;
    currentBatch: number;
    totalBatches: number;
    generated: number;
    progress: number;
    currentArtist?: string;
    imagesGenerated: number;
    imagesTotal: number;
    startTime?: number;
  }>({
    phase: "preparing",
    currentBatch: 0,
    totalBatches: 0,
    generated: 0,
    progress: 0,
    imagesGenerated: 0,
    imagesTotal: 0,
  });

  useEffect(() => {
    loadSavedArtists();
    loadStats();
  }, []);

  const loadStats = async () => {
    const [artistsRes, albumsRes, songsRes] = await Promise.all([
      supabase.from("artists").select("id", { count: "exact", head: true }),
      supabase.from("albums").select("id", { count: "exact", head: true }),
      supabase.from("songs").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      artists: artistsRes.count || 0,
      albums: albumsRes.count || 0,
      songs: songsRes.count || 0,
    });
  };

  const loadSavedArtists = async () => {
    const { data: artistsData, error } = await supabase
      .from("artists")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading artists:", error);
      return;
    }

    const artistsWithAlbums: Artist[] = [];
    for (const artist of artistsData || []) {
      const { data: albumsData } = await supabase
        .from("albums")
        .select("*")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: true });

      const albumsWithSongs = [];
      for (const album of albumsData || []) {
        const { data: songsData } = await supabase
          .from("songs")
          .select("*")
          .eq("album_id", album.id)
          .order("track_number", { ascending: true });

        albumsWithSongs.push({
          id: album.id,
          name: album.name,
          songs: (songsData || []).map((s) => s.name),
        });
      }

      artistsWithAlbums.push({
        id: artist.id,
        name: artist.name,
        personality: artist.personality,
        voicePrompt: artist.voice_prompt,
        genre: artist.genre,
        style: artist.style,
        albums: albumsWithSongs,
        created_at: artist.created_at,
        profile_image_url: artist.profile_image_url,
        katalognummer: artist.katalognummer,
        language: artist.language,
      });
    }

    setSavedArtists(artistsWithAlbums);
  };

  const deleteArtist = async (artistId: string) => {
    const { error } = await supabase.from("artists").delete().eq("id", artistId);
    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }
    toast.success("Künstler gelöscht");
    loadSavedArtists();
    loadStats();
  };

  const generateBatch = async (count: number): Promise<Artist[]> => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-artists`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          artistCount: count,
          albumCount,
          songCount,
          selectedGenres,
          selectedLanguages,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 429) {
        throw new Error("Rate Limit erreicht. Warte 30 Sekunden...");
      } else if (response.status === 402) {
        throw new Error("Kontingent erschöpft.");
      }
      throw new Error(error.error || "Ein Fehler ist aufgetreten.");
    }

    const data = await response.json();
    return data.artists || [];
  };

  const generateArtists = async () => {
    setIsLoading(true);
    setArtists([]);
    
    const totalBatches = Math.ceil(artistCount / BATCH_SIZE);
    const startTime = Date.now();
    
    setGenerationState({
      phase: "preparing",
      currentBatch: 0,
      totalBatches,
      generated: 0,
      progress: 0,
      imagesGenerated: 0,
      imagesTotal: artistCount,
      startTime,
    });

    try {
      let allArtists: Artist[] = [];
      let remaining = artistCount;
      
      for (let batch = 1; batch <= totalBatches; batch++) {
        const batchCount = Math.min(remaining, BATCH_SIZE);
        
        setGenerationState(prev => ({
          ...prev,
          phase: "generating_text",
          currentBatch: batch,
          progress: ((batch - 1) / totalBatches) * 100,
        }));
        
        try {
          const batchArtists = await generateBatch(batchCount);
          allArtists = [...allArtists, ...batchArtists];
          setArtists([...allArtists]);
          
          setGenerationState(prev => ({
            ...prev,
            phase: "complete",
            generated: allArtists.length,
            progress: (batch / totalBatches) * 100,
            imagesGenerated: allArtists.filter(a => a.profileImageUrl || a.profile_image_url).length,
          }));
          
          remaining -= batchCount;
          
          // Small delay between batches to avoid rate limits
          if (batch < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (batchError) {
          console.error(`Batch ${batch} error:`, batchError);
          if (batchError instanceof Error && batchError.message.includes("Rate Limit")) {
            toast.warning("Rate Limit - Warte 30 Sekunden...");
            await new Promise(resolve => setTimeout(resolve, 30000));
            batch--; // Retry this batch
          } else {
            throw batchError;
          }
        }
      }
      
      toast.success(`${allArtists.length} Künstler mit Profilbildern generiert!`);
      await loadSavedArtists();
      await loadStats();
    } catch (error) {
      console.error("Error generating artists:", error);
      toast.error(error instanceof Error ? error.message : "Verbindungsfehler");
    } finally {
      setIsLoading(false);
      setGenerationState({
        phase: "preparing",
        currentBatch: 0,
        totalBatches: 0,
        generated: 0,
        progress: 0,
        imagesGenerated: 0,
        imagesTotal: 0,
      });
    }
  };

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

  const totalBatches = Math.ceil(artistCount / BATCH_SIZE);
  const isBulkMode = totalBatches > 1;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Compact Header */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="container py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
                <span className="text-foreground">KI Musikkatalog</span>{" "}
                <span className="text-gradient-gold">Generator</span>
              </h1>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                <ScoopasIcon size={16} />
                <span className="text-xs font-medium text-primary">
                  Powered by scoopas.AI
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Generator
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2"
                >
                  <ListMusic className="h-4 w-4" />
                  Songkatalog
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Social-Tools
                </Button>
              </nav>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setSunoDialogOpen(true)}
              >
                <Volume2 className="h-4 w-4" />
                <span className="hidden sm:inline">scoopas Audio</span>
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-primary" />
                  <span>{stats.artists}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-primary" />
                  <span>{stats.albums}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span>{stats.songs}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Fixed Height */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container h-full py-4">
          <div className="grid lg:grid-cols-[420px_1fr] gap-6 h-full">
            {/* Controls Sidebar - Scrollable */}
            <ScrollArea className="h-full pr-4">
              <aside className="space-y-4 pb-4">
                <GeneratorControls
                  artistCount={artistCount}
                  albumCount={albumCount}
                  songCount={songCount}
                  onArtistCountChange={setArtistCount}
                  onAlbumCountChange={setAlbumCount}
                  onSongCountChange={setSongCount}
                />
                
                <GenreFilter
                  selectedGenres={selectedGenres}
                  onGenresChange={setSelectedGenres}
                />
                
                <LanguageSelector
                  selectedLanguages={selectedLanguages}
                  onLanguagesChange={setSelectedLanguages}
                />

                <div className="space-y-2">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full"
                    onClick={generateArtists}
                    disabled={isLoading}
                  >
                    <ScoopasIcon size={18} />
                    {isLoading 
                      ? isBulkMode 
                        ? `Batch ${generationState.currentBatch}/${generationState.totalBatches}...` 
                        : "Generiere..." 
                      : isBulkMode 
                        ? `${artistCount} Künstler generieren (${totalBatches} Batches)` 
                        : "Künstler generieren"
                    }
                  </Button>
                  
                  {isBulkMode && !isLoading && (
                    <p className="text-xs text-muted-foreground text-center">
                      Bulk-Modus: {BATCH_SIZE} pro Batch, automatische Pausen
                    </p>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="default"
                  className="w-full"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-4 w-4" />
                  {showHistory ? "Neue Ergebnisse" : `Datenbank (${stats.artists})`}
                </Button>

                {/* Export Buttons */}
                {stats.songs > 0 && (
                  <div className="p-3 rounded-lg border border-border bg-card/50 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Download className="h-3.5 w-3.5 text-primary" />
                      <span>Katalog exportieren</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportCSV}
                        disabled={isExporting}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        CSV
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportJSON}
                        disabled={isExporting}
                      >
                        <FileJson className="h-3.5 w-3.5" />
                        JSON
                      </Button>
                    </div>
                  </div>
                )}
              </aside>
            </ScrollArea>

            {/* Results - Scrollable */}
            <ScrollArea className="h-full">
              <section className="space-y-3 pr-4 pb-4">
                {showHistory ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-2 -mt-2 z-10">
                      <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        Gespeicherte Künstler ({savedArtists.length})
                      </h2>
                      <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {savedArtists.length > 0 ? (
                      savedArtists.map((artist, index) => (
                        <ArtistCard
                          key={artist.id || `${artist.name}-${index}`}
                          artist={artist}
                          index={index}
                          onDelete={deleteArtist}
                          showDelete
                          onRefresh={loadSavedArtists}
                        />
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-16 w-16 rounded-xl bg-secondary/50 flex items-center justify-center mb-4">
                          <Database className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-display font-semibold text-foreground mb-1">
                          Keine gespeicherten Künstler
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Generiere Künstler, um sie in der Datenbank zu speichern.
                        </p>
                      </div>
                    )}
                  </div>
                ) : isLoading ? (
                  <LoadingState 
                    progress={generationState.progress}
                    currentBatch={generationState.currentBatch}
                    totalBatches={generationState.totalBatches}
                    generatedCount={generationState.generated}
                    totalCount={artistCount}
                    phase={generationState.phase}
                    currentArtist={generationState.currentArtist}
                    imagesGenerated={generationState.imagesGenerated}
                    imagesTotal={generationState.imagesTotal}
                    startTime={generationState.startTime}
                  />
                ) : artists.length > 0 ? (
                  <>
                    <div className="sticky top-0 bg-background/95 backdrop-blur py-2 -mt-2 z-10">
                      <p className="text-sm text-muted-foreground">
                        {artists.length} Künstler generiert
                      </p>
                    </div>
                    {artists.map((artist, index) => (
                      <ArtistCard key={`${artist.name}-${index}`} artist={artist} index={index} onRefresh={loadSavedArtists} />
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 rounded-xl bg-secondary/50 flex items-center justify-center mb-4">
                      <Music className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-display font-semibold text-foreground mb-1">
                      Bereit zur Generierung
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Wähle Anzahl, Filter und klicke auf "Künstler generieren".
                    </p>
                  </div>
                )}
              </section>
            </ScrollArea>
          </div>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="shrink-0 border-t border-border py-2 bg-background/95">
        <div className="container flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ScoopasIcon size={14} />
          <span>Alle Inhalte sind KI-generiert und exportierbar als vollständiger Musikkatalog</span>
        </div>
      </footer>

      {/* Suno Generator Dialog */}
      <SunoGeneratorDialog 
        open={sunoDialogOpen} 
        onOpenChange={setSunoDialogOpen} 
      />
    </div>
  );
};

export default Index;
