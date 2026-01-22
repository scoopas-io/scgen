import { useState, useEffect } from "react";
import { Sparkles, Music, Zap, History, X, Database, Download, FileJson, FileSpreadsheet, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratorControls } from "@/components/GeneratorControls";
import { GenreFilter } from "@/components/GenreFilter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ArtistCard, type Artist } from "@/components/ArtistCard";
import { LoadingState } from "@/components/LoadingState";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [isExporting, setIsExporting] = useState(false);

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

  const generateArtists = async () => {
    setIsLoading(true);
    setArtists([]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-artists`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            artistCount,
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
          toast.error("Rate Limit erreicht", {
            description: "Bitte warte einen Moment und versuche es erneut.",
          });
        } else if (response.status === 402) {
          toast.error("Kontingent erschöpft", {
            description: "Bitte lade Credits auf, um weiterzumachen.",
          });
        } else {
          toast.error("Fehler", {
            description: error.error || "Ein Fehler ist aufgetreten.",
          });
        }
        return;
      }

      const data = await response.json();
      setArtists(data.artists);
      toast.success(`${data.artists.length} Künstler mit Profilbildern generiert!`);
      
      await loadSavedArtists();
      await loadStats();
    } catch (error) {
      console.error("Error generating artists:", error);
      toast.error("Verbindungsfehler", {
        description: "Bitte überprüfe deine Internetverbindung.",
      });
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="container relative py-10 md:py-16">
          <div className="flex flex-col items-center text-center space-y-5 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Powered by AI + Bildgenerierung
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
              <span className="text-foreground">KI Artist</span>{" "}
              <span className="text-gradient-gold">Generator</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Generiere einzigartige Künstlerprofile mit KI-Profilbildern, 
              SUNO Voice-Prompts, Alben und vollständigem Musikkatalog.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap justify-center">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span>{stats.artists} Künstler</span>
              </div>
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span>{stats.albums} Alben</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span>{stats.songs} Songs</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="grid lg:grid-cols-[420px_1fr] gap-8">
          {/* Controls Sidebar */}
          <aside className="space-y-6">
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

            <Button
              variant="gold"
              size="xl"
              className="w-full"
              onClick={generateArtists}
              disabled={isLoading}
            >
              <Sparkles className="h-5 w-5" />
              {isLoading ? "Generiere..." : "Künstler generieren"}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-5 w-5" />
              {showHistory ? "Neue Ergebnisse" : `Datenbank (${stats.artists})`}
            </Button>

            {/* Export Buttons */}
            {stats.songs > 0 && (
              <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Download className="h-4 w-4 text-primary" />
                  <span>Katalog exportieren</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={isExporting}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportJSON}
                    disabled={isExporting}
                  >
                    <FileJson className="h-4 w-4" />
                    JSON
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vollständiger Musikkatalog mit allen Feldern
                </p>
              </div>
            )}
            
            {artists.length > 0 && !showHistory && (
              <p className="text-center text-sm text-muted-foreground">
                {artists.length} neu generiert
              </p>
            )}
          </aside>

          {/* Results */}
          <section className="space-y-4">
            {showHistory ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Gespeicherte Künstler ({savedArtists.length})
                  </h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                    <X className="h-5 w-5" />
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
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-20 w-20 rounded-2xl bg-secondary/50 flex items-center justify-center mb-6">
                      <Database className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                      Keine gespeicherten Künstler
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      Generiere Künstler, um sie in der Datenbank zu speichern.
                    </p>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <LoadingState />
            ) : artists.length > 0 ? (
              artists.map((artist, index) => (
                <ArtistCard key={`${artist.name}-${index}`} artist={artist} index={index} onRefresh={loadSavedArtists} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-24 w-24 rounded-2xl bg-secondary/50 flex items-center justify-center mb-6">
                  <Music className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  Bereit zur Generierung
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Wähle Anzahl, Genre-Filter und klicke auf "Künstler generieren".
                  Jeder Künstler erhält ein KI-generiertes Profilbild.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Alle Inhalte sind einzigartig, KI-generiert und exportierbar als vollständiger Musikkatalog.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
