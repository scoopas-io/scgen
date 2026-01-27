import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  CheckCircle2, XCircle, UserCircle, Zap, Loader2, 
  AlertCircle, Music, RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Artist {
  id: string;
  name: string;
  genre: string;
  profile_image_url: string | null;
  suno_persona_id: string | null;
  vocal_gender: string | null;
}

interface Song {
  id: string;
  name: string;
  audio_url: string | null;
  suno_task_id: string | null;
  album: {
    artist_id: string;
  };
}

export function PersonaStatusDashboard() {
  const [open, setOpen] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load artists with persona status using raw query to include new column
      const { data: artistsData, error: artistsError } = await supabase
        .from("artists")
        .select("*")
        .order("name");

      if (artistsError) throw artistsError;

      // Map to our interface, extracting suno_persona_id from the raw data
      const artistsWithPersona: Artist[] = (artistsData || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        genre: a.genre,
        profile_image_url: a.profile_image_url,
        vocal_gender: a.vocal_gender,
        suno_persona_id: a.suno_persona_id || null,
      }));

      setArtists(artistsWithPersona);

      // Load songs with audio for potential persona creation
      const { data: songsData, error: songsError } = await supabase
        .from("songs")
        .select("id, name, audio_url, suno_task_id, albums!inner(artist_id)")
        .not("audio_url", "is", null)
        .not("suno_task_id", "is", null);

      if (songsError) throw songsError;
      
      // Transform to flat structure
      const flatSongs = (songsData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        audio_url: s.audio_url,
        suno_task_id: s.suno_task_id,
        album: { artist_id: s.albums.artist_id },
      }));
      
      setSongs(flatSongs);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const createPersonaForArtist = async (artistId: string) => {
    // Find a song with audio for this artist
    const artistSong = songs.find(s => s.album.artist_id === artistId);
    
    if (!artistSong) {
      toast.error("Kein Song mit Audio gefunden");
      return false;
    }

    setCreating(artistId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-suno-persona`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            artistId,
            songId: artistSong.id,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update local state
        setArtists(prev => prev.map(a => 
          a.id === artistId 
            ? { ...a, suno_persona_id: result.personaId } 
            : a
        ));
        
        if (!result.alreadyExists) {
          toast.success(`Persona für ${result.artistName} erstellt`);
        }
        return true;
      } else {
        toast.error(result.error || "Fehler bei Persona-Erstellung");
        return false;
      }
    } catch (error) {
      console.error("Error creating persona:", error);
      toast.error("Verbindungsfehler");
      return false;
    } finally {
      setCreating(null);
    }
  };

  const batchCreatePersonas = async () => {
    const artistsWithoutPersona = artists.filter(a => !a.suno_persona_id);
    const artistsWithSongs = artistsWithoutPersona.filter(a => 
      songs.some(s => s.album.artist_id === a.id)
    );

    if (artistsWithSongs.length === 0) {
      toast.info("Keine Künstler ohne Persona mit verfügbaren Songs");
      return;
    }

    setBatchCreating(true);
    setBatchProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < artistsWithSongs.length; i++) {
      const artist = artistsWithSongs[i];
      const success = await createPersonaForArtist(artist.id);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      setBatchProgress(((i + 1) / artistsWithSongs.length) * 100);
      
      // Delay between API calls
      if (i < artistsWithSongs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setBatchCreating(false);
    toast.success(`${successCount} Personas erstellt, ${errorCount} Fehler`);
  };

  const artistsWithPersona = artists.filter(a => a.suno_persona_id);
  const artistsWithoutPersona = artists.filter(a => !a.suno_persona_id);
  const artistsWithSongsButNoPersona = artistsWithoutPersona.filter(a => 
    songs.some(s => s.album.artist_id === a.id)
  );
  
  const completionPercent = artists.length > 0 
    ? Math.round((artistsWithPersona.length / artists.length) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "gap-1.5 h-7 px-2 text-xs hidden sm:flex",
                artistsWithPersona.length === artists.length && artists.length > 0
                  ? "text-green-500"
                  : artistsWithPersona.length > 0
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              )}
            >
              <UserCircle className="h-3.5 w-3.5" />
              <span>{artistsWithPersona.length}/{artists.length}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Suno Persona Status</TooltipContent>
        </Tooltip>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Suno Persona Status
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-500">{artistsWithPersona.length}</p>
                <p className="text-xs text-muted-foreground">Mit Persona</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-yellow-500">{artistsWithSongsButNoPersona.length}</p>
                <p className="text-xs text-muted-foreground">Erstellbar</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <XCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold">{artistsWithoutPersona.length - artistsWithSongsButNoPersona.length}</p>
                <p className="text-xs text-muted-foreground">Ohne Songs</p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fortschritt</span>
                <span className="font-medium">{completionPercent}%</span>
              </div>
              <Progress value={completionPercent} className="h-2" />
            </div>

            {/* Batch Actions */}
            {artistsWithSongsButNoPersona.length > 0 && (
              <div className="flex items-center gap-2">
                <Button 
                  onClick={batchCreatePersonas}
                  disabled={batchCreating}
                  className="gap-2"
                >
                  {batchCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Erstelle... {Math.round(batchProgress)}%
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Alle erstellen ({artistsWithSongsButNoPersona.length})
                    </>
                  )}
                </Button>
                <Button variant="outline" size="icon" onClick={loadData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}

            {batchCreating && (
              <Progress value={batchProgress} className="h-1" />
            )}

            {/* Artist List */}
            <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
              <div className="space-y-2 pb-4">
                {artists.map(artist => {
                  const hasPersona = !!artist.suno_persona_id;
                  const hasSongs = songs.some(s => s.album.artist_id === artist.id);
                  const isCreating = creating === artist.id;

                  return (
                    <div 
                      key={artist.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        hasPersona 
                          ? "bg-green-500/5 border-green-500/20" 
                          : hasSongs 
                            ? "bg-yellow-500/5 border-yellow-500/20"
                            : "bg-muted/30 border-border"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={artist.profile_image_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {artist.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{artist.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {artist.genre} 
                          {artist.vocal_gender && ` • ${artist.vocal_gender === 'f' ? '♀' : artist.vocal_gender === 'm' ? '♂' : artist.vocal_gender}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasPersona ? (
                          <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Persona
                          </Badge>
                        ) : hasSongs ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-xs"
                            onClick={() => createPersonaForArtist(artist.id)}
                            disabled={isCreating || batchCreating}
                          >
                            {isCreating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Zap className="h-3 w-3" />
                                Erstellen
                              </>
                            )}
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-muted-foreground">
                            <Music className="h-3 w-3" />
                            Kein Audio
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
