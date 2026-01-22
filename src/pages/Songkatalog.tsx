import { useState, useEffect } from "react";
import { 
  Music, Database, Download, FileJson, FileSpreadsheet, Search, 
  ChevronDown, ChevronRight, User, Disc, Play, Pause, Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/AppHeader";
import { SunoGeneratorDialog } from "@/components/SunoGeneratorDialog";
import { SongDetailDialog } from "@/components/SongDetailDialog";
import { exportCatalogAsCSV, exportCatalogAsJSON } from "@/lib/exportCatalog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Song {
  id: string;
  name: string;
  album_id: string;
  track_number: number;
  song_id?: string;
  komponist?: string;
  textdichter?: string;
  isrc?: string;
  iswc?: string;
  gema_werknummer?: string;
  gema_status?: string;
  bpm?: number;
  tonart?: string;
  laenge?: string;
  version?: string;
  ki_generiert?: string;
  verwertungsstatus?: string;
  einnahmequelle?: string;
  vertragsart?: string;
  exklusivitaet?: string;
  vertragsbeginn?: string;
  vertragsende?: string;
  anteil_komponist?: number;
  anteil_text?: number;
  anteil_verlag?: number;
  jahresumsatz?: number;
  katalogwert?: number;
  bemerkungen?: string;
  audio_url?: string;
}

interface Album {
  id: string;
  name: string;
  release_date?: string;
  songs: Song[];
}

interface Artist {
  id: string;
  name: string;
  genre: string;
  style: string;
  language?: string;
  profile_image_url?: string;
  albums: Album[];
}

const LANGUAGE_FLAGS: Record<string, { flag: string; name: string }> = {
  de: { flag: "🇩🇪", name: "Deutsch" },
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Español" },
  fr: { flag: "🇫🇷", name: "Français" },
  it: { flag: "🇮🇹", name: "Italiano" },
  pt: { flag: "🇵🇹", name: "Português" },
  ja: { flag: "🇯🇵", name: "日本語" },
  ko: { flag: "🇰🇷", name: "한국어" },
  zh: { flag: "🇨🇳", name: "中文" },
};

const Songkatalog = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [sunoDialogOpen, setSunoDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSong, setSelectedSong] = useState<{ song: Song; artistName: string; albumName: string } | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [artistsRes, albumsRes, songsRes] = await Promise.all([
        supabase.from("artists").select("*").order("name"),
        supabase.from("albums").select("*").order("name"),
        supabase.from("songs").select("*").order("track_number"),
      ]);

      const artistsData = artistsRes.data || [];
      const albumsData = albumsRes.data || [];
      const songsData = songsRes.data || [];

      setStats({
        artists: artistsData.length,
        albums: albumsData.length,
        songs: songsData.length,
      });

      const artistsWithAlbums: Artist[] = artistsData.map(artist => ({
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        style: artist.style,
        language: artist.language,
        profile_image_url: artist.profile_image_url,
        albums: albumsData
          .filter(album => album.artist_id === artist.id)
          .map(album => ({
            id: album.id,
            name: album.name,
            release_date: album.release_date,
            songs: songsData
              .filter(song => song.album_id === album.id)
              .map(song => ({
                id: song.id,
                name: song.name,
                album_id: song.album_id,
                track_number: song.track_number,
                song_id: song.song_id,
                komponist: song.komponist,
                textdichter: song.textdichter,
                isrc: song.isrc,
                iswc: song.iswc,
                gema_werknummer: song.gema_werknummer,
                gema_status: song.gema_status,
                bpm: song.bpm,
                tonart: song.tonart,
                laenge: song.laenge,
                version: song.version,
                ki_generiert: song.ki_generiert,
                verwertungsstatus: song.verwertungsstatus,
                einnahmequelle: song.einnahmequelle,
                vertragsart: song.vertragsart,
                exklusivitaet: song.exklusivitaet,
                vertragsbeginn: song.vertragsbeginn,
                vertragsende: song.vertragsende,
                anteil_komponist: song.anteil_komponist,
                anteil_text: song.anteil_text,
                anteil_verlag: song.anteil_verlag,
                jahresumsatz: song.jahresumsatz,
                katalogwert: song.katalogwert,
                bemerkungen: song.bemerkungen,
                audio_url: song.audio_url,
              })),
          })),
      }));

      setArtists(artistsWithAlbums);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleArtist = (artistId: string) => {
    setExpandedArtists(prev => {
      const next = new Set(prev);
      if (next.has(artistId)) {
        next.delete(artistId);
      } else {
        next.add(artistId);
      }
      return next;
    });
  };

  const toggleAlbum = (albumId: string) => {
    setExpandedAlbums(prev => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  };

  const playAudio = (audioUrl: string) => {
    if (audioElement) {
      audioElement.pause();
    }
    if (playingAudio === audioUrl) {
      setPlayingAudio(null);
      return;
    }
    const audio = new Audio(audioUrl);
    audio.play();
    audio.onended = () => setPlayingAudio(null);
    setAudioElement(audio);
    setPlayingAudio(audioUrl);
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

  const filteredArtists = artists.filter(artist => {
    const query = searchQuery.toLowerCase();
    if (artist.name.toLowerCase().includes(query)) return true;
    if (artist.genre.toLowerCase().includes(query)) return true;
    if (artist.albums.some(album => album.name.toLowerCase().includes(query))) return true;
    if (artist.albums.some(album => album.songs.some(song => song.name.toLowerCase().includes(query)))) return true;
    return false;
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader 
        stats={stats} 
        onOpenSunoDialog={() => setSunoDialogOpen(true)} 
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container h-full py-6">
          <div className="flex flex-col h-full gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Künstler, Alben oder Songs suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{stats.artists} Künstler</Badge>
                  <Badge variant="secondary">{stats.albums} Alben</Badge>
                  <Badge variant="secondary">{stats.songs} Songs</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={isExporting || stats.songs === 0}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  disabled={isExporting || stats.songs === 0}
                >
                  <FileJson className="h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>

            {/* Catalog Tree */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">Lade Katalog...</p>
                  </div>
                </div>
              ) : filteredArtists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-xl bg-secondary/50 flex items-center justify-center mb-4">
                    <Database className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {searchQuery ? "Keine Ergebnisse" : "Katalog ist leer"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Versuche einen anderen Suchbegriff" : "Generiere Künstler im Generator"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredArtists.map(artist => (
                    <div key={artist.id} className="border border-border rounded-lg overflow-hidden">
                      {/* Artist Row */}
                      <button
                        onClick={() => toggleArtist(artist.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        {expandedArtists.has(artist.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {artist.profile_image_url ? (
                          <img 
                            src={artist.profile_image_url} 
                            alt={artist.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-medium flex items-center gap-2">
                            {artist.name}
                            {artist.language && LANGUAGE_FLAGS[artist.language] && (
                              <span title={LANGUAGE_FLAGS[artist.language].name}>
                                {LANGUAGE_FLAGS[artist.language].flag}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {artist.genre} • {artist.style} • {artist.albums.length} Alben
                          </div>
                        </div>
                      </button>

                      {/* Albums */}
                      {expandedArtists.has(artist.id) && (
                        <div className="border-t border-border bg-muted/20">
                          {artist.albums.map(album => (
                            <div key={album.id}>
                              <button
                                onClick={() => toggleAlbum(album.id)}
                                className="w-full flex items-center gap-3 p-3 pl-10 hover:bg-muted/50 transition-colors"
                              >
                                {expandedAlbums.has(album.id) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                  <Disc className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="font-medium text-sm">{album.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {album.songs.length} Songs • {album.release_date}
                                  </div>
                                </div>
                              </button>

                              {/* Songs */}
                              {expandedAlbums.has(album.id) && (
                                <div className="border-t border-border/50 bg-muted/30">
                                  {album.songs.map(song => (
                                    <div
                                      key={song.id}
                                      className="flex items-center gap-3 p-2 pl-20 hover:bg-muted/50 transition-colors group"
                                    >
                                      <span className="text-xs text-muted-foreground w-6 text-right">
                                        {song.track_number}
                                      </span>
                                      {song.audio_url && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => playAudio(song.audio_url!)}
                                        >
                                          {playingAudio === song.audio_url ? (
                                            <Pause className="h-3 w-3" />
                                          ) : (
                                            <Play className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}
                                      <button
                                        onClick={() => setSelectedSong({ song, artistName: artist.name, albumName: album.name })}
                                        className="flex-1 text-left text-sm hover:text-primary transition-colors"
                                      >
                                        {song.name}
                                      </button>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                        {song.bpm && <span>{song.bpm} BPM</span>}
                                        {song.tonart && <span>{song.tonart}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </main>

      <SunoGeneratorDialog 
        open={sunoDialogOpen} 
        onOpenChange={setSunoDialogOpen} 
      />

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

export default Songkatalog;
