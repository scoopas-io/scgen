import { useState } from "react";
import { Sparkles, Music, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratorControls } from "@/components/GeneratorControls";
import { ArtistCard, type Artist } from "@/components/ArtistCard";
import { LoadingState } from "@/components/LoadingState";
import { toast } from "sonner";

const Index = () => {
  const [artistCount, setArtistCount] = useState(3);
  const [albumCount, setAlbumCount] = useState(2);
  const [songCount, setSongCount] = useState(5);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      toast.success(`${data.artists.length} Künstler generiert!`);
    } catch (error) {
      console.error("Error generating artists:", error);
      toast.error("Verbindungsfehler", {
        description: "Bitte überprüfe deine Internetverbindung.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="container relative py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Powered by AI
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight">
              <span className="text-foreground">KI Artist</span>{" "}
              <span className="text-gradient-gold">Generator</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              Generiere einzigartige Künstlerprofile mit Persönlichkeit, 
              SUNO Voice-Prompts, Alben und Songtiteln – vollautomatisch.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span>Einzigartige Namen</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span>SUNO-optimiert</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        <div className="grid lg:grid-cols-[400px_1fr] gap-8">
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
            
            {artists.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {artists.length} Künstler • {artists.reduce((acc, a) => acc + a.albums.length, 0)} Alben • {artists.reduce((acc, a) => acc + a.albums.reduce((acc2, al) => acc2 + al.songs.length, 0), 0)} Songs
              </p>
            )}
          </aside>

          {/* Results */}
          <section className="space-y-4">
            {isLoading ? (
              <LoadingState />
            ) : artists.length > 0 ? (
              artists.map((artist, index) => (
                <ArtistCard key={`${artist.name}-${index}`} artist={artist} index={index} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-24 w-24 rounded-2xl bg-secondary/50 flex items-center justify-center mb-6">
                  <Music className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  Bereit zur Generierung
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Wähle links die gewünschte Anzahl an Künstlern, Alben und Songs 
                  und klicke auf "Künstler generieren" um zu starten.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Alle generierten Inhalte sind einzigartig und frei von Urheberrechtskonflikten.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
