import { useState, useEffect } from "react";
import { Music, Zap, History, X, Database, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratorControls } from "@/components/GeneratorControls";
import { GenreFilter } from "@/components/GenreFilter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ArtistCard, type Artist } from "@/components/ArtistCard";
import { LoadingState, type GenerationPhase } from "@/components/LoadingState";
import { ScoopasIcon } from "@/components/ScoopasIcon";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";

const BATCH_SIZE = 10;

const Generator = () => {
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

  const generateWithStreaming = async (count: number): Promise<Artist[]> => {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-artists?stream=true`
      );
      
      // We need to send POST data, so use fetch with SSE reader instead
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-artists?stream=true`,
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
      ).then(async (response) => {
        if (!response.ok) {
          if (response.status === 429) {
            reject(new Error("Rate Limit erreicht. Warte 30 Sekunden..."));
          } else if (response.status === 402) {
            reject(new Error("Kontingent erschöpft."));
          } else {
            const error = await response.json().catch(() => ({}));
            reject(new Error(error.error || "Ein Fehler ist aufgetreten."));
          }
          return;
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          reject(new Error("Streaming nicht verfügbar"));
          return;
        }
        
        const decoder = new TextDecoder();
        let buffer = "";
        let finalArtists: Artist[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              const eventType = line.replace("event: ", "").trim();
              continue;
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                
                if (data.phase) {
                  setGenerationState(prev => ({
                    ...prev,
                    phase: data.phase as GenerationPhase,
                    progress: data.progress || prev.progress,
                    currentArtist: data.currentArtist,
                    imagesGenerated: data.imagesGenerated ?? prev.imagesGenerated,
                    imagesTotal: data.imagesTotal ?? prev.imagesTotal,
                  }));
                }
                
                if (data.progress !== undefined) {
                  setGenerationState(prev => ({
                    ...prev,
                    progress: data.progress,
                    currentArtist: data.currentArtist || prev.currentArtist,
                    imagesGenerated: data.imagesGenerated ?? prev.imagesGenerated,
                    generated: data.current || prev.generated,
                  }));
                }
                
                if (data.artists) {
                  finalArtists = data.artists;
                }
                
                if (data.error) {
                  reject(new Error(data.error));
                  return;
                }
              } catch (e) {
                console.warn("SSE parse error:", e);
              }
            }
          }
        }
        
        resolve(finalArtists);
      }).catch(reject);
    });
  };
  
  const generateBatch = async (count: number): Promise<Artist[]> => {
    // Use streaming for real-time progress updates
    return generateWithStreaming(count);
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
          
          if (batch < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (batchError) {
          console.error(`Batch ${batch} error:`, batchError);
          if (batchError instanceof Error && batchError.message.includes("Rate Limit")) {
            toast.warning("Rate Limit - Warte 30 Sekunden...");
            await new Promise(resolve => setTimeout(resolve, 30000));
            batch--;
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
      <AppHeader stats={stats} />

      <main className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="container py-3 md:py-4 px-3 md:px-6 pb-20 md:pb-4">
            <div className="flex flex-col lg:grid lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
              {/* Controls - flows naturally on mobile */}
              <aside className="space-y-3 md:space-y-4">
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
                    className="w-full text-sm md:text-base h-10 md:h-11"
                    onClick={generateArtists}
                    disabled={isLoading}
                  >
                    <ScoopasIcon size={18} className="shrink-0" />
                    <span className="truncate">
                      {isLoading 
                        ? isBulkMode 
                          ? `Batch ${generationState.currentBatch}/${generationState.totalBatches}...` 
                          : "Erstelle..." 
                        : isBulkMode 
                          ? `${artistCount} Künstler (${totalBatches} Batches)` 
                          : "Künstler erstellen"
                      }
                    </span>
                  </Button>
                
                  {isBulkMode && !isLoading && (
                    <p className="text-[10px] md:text-xs text-muted-foreground text-center">
                      Bulk-Modus: {BATCH_SIZE} pro Batch
                    </p>
                  )}
                </div>
              
                <Button
                  variant="outline"
                  size="default"
                  className="w-full text-sm h-9 md:h-10"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {showHistory ? "Neue Ergebnisse" : `Datenbank (${stats.artists})`}
                  </span>
                </Button>

                {stats.songs > 0 && (
                  <div className="p-2.5 md:p-3 rounded-lg border border-border bg-card/50 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Download className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Katalog exportieren</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="h-8 text-xs"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        CSV
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportJSON}
                        disabled={isExporting}
                        className="h-8 text-xs"
                      >
                        <FileJson className="h-3.5 w-3.5" />
                        JSON
                      </Button>
                    </div>
                  </div>
                )}
              </aside>

              {/* Results Section */}
              <section className="space-y-2 md:space-y-3">
                {showHistory ? (
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm md:text-lg font-display font-semibold text-foreground flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">Gespeichert ({savedArtists.length})</span>
                      </h2>
                      <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="h-8 w-8">
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
                      <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                        <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl bg-secondary/50 flex items-center justify-center mb-3 md:mb-4">
                          <Database className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-base md:text-lg font-display font-semibold text-foreground mb-1">
                          Keine gespeicherten Künstler
                        </h3>
                        <p className="text-xs md:text-sm text-muted-foreground max-w-sm px-4">
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
                    imagesGenerated={generationState.imagesGenerated}
                    imagesTotal={generationState.imagesTotal}
                    startTime={generationState.startTime}
                  />
                ) : artists.length > 0 ? (
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm md:text-lg font-display font-semibold text-foreground flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary shrink-0" />
                        Neue Künstler ({artists.length})
                      </h2>
                    </div>
                    {artists.map((artist, index) => (
                      <ArtistCard
                        key={artist.id || `${artist.name}-${index}`}
                        artist={artist}
                        index={index}
                        onRefresh={loadSavedArtists}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                    <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 md:mb-6">
                      <ScoopasIcon size={32} className="md:hidden" />
                      <ScoopasIcon size={40} className="hidden md:block" />
                    </div>
                    <h3 className="text-lg md:text-xl font-display font-semibold text-foreground mb-2">
                      scoopas Musikkatalog
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground max-w-md px-4">
                      Erstelle vollständige Künstlerprofile mit Albums, Songs und
                      professionellen Metadaten.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </ScrollArea>
      </main>

      <footer className="shrink-0 border-t border-border py-2 md:py-3 hidden md:block">
        <div className="container">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ScoopasIcon size={14} />
              <span>scoopas Musikkatalog</span>
            </div>
            <span className="hidden sm:inline">Powered by scoopas</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Generator;
