import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Copy, Check, User, Mic, Disc, Music, Trash2, Image, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SongDetailDialog } from "./SongDetailDialog";
import { supabase } from "@/integrations/supabase/client";

interface SongData {
  id: string;
  name: string;
  album_id: string;
  track_number: number;
  song_id: string | null;
  komponist: string | null;
  textdichter: string | null;
  isrc: string | null;
  iswc: string | null;
  gema_werknummer: string | null;
  gema_status: string | null;
  bpm: number | null;
  tonart: string | null;
  laenge: string | null;
  version: string | null;
  ki_generiert: string | null;
  verwertungsstatus: string | null;
  einnahmequelle: string | null;
  vertragsart: string | null;
  exklusivitaet: string | null;
  vertragsbeginn: string | null;
  vertragsende: string | null;
  anteil_komponist: number | null;
  anteil_text: number | null;
  anteil_verlag: number | null;
  jahresumsatz: number | null;
  katalogwert: number | null;
  bemerkungen: string | null;
}

interface Album {
  id?: string;
  name: string;
  songs: string[];
}

export interface Artist {
  id?: string;
  name: string;
  personality: string;
  voicePrompt: string;
  genre: string;
  style: string;
  albums: Album[];
  created_at?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  katalognummer?: string;
}

interface ArtistCardProps {
  artist: Artist;
  index: number;
  onDelete?: (artistId: string) => void;
  showDelete?: boolean;
  onRefresh?: () => void;
}

export function ArtistCard({ artist, index, onDelete, showDelete = false, onRefresh }: ArtistCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [selectedAlbumName, setSelectedAlbumName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [songsData, setSongsData] = useState<Record<string, SongData[]>>({});

  const imageUrl = artist.profileImageUrl || artist.profile_image_url;

  useEffect(() => {
    if (expanded && artist.id) {
      loadSongsData();
    }
  }, [expanded, artist.id]);

  const loadSongsData = async () => {
    if (!artist.albums?.length) return;
    
    const albumIds = artist.albums.map(a => a.id).filter(Boolean);
    if (albumIds.length === 0) return;

    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .in("album_id", albumIds as string[])
      .order("track_number", { ascending: true });

    if (!error && data) {
      const grouped: Record<string, SongData[]> = {};
      data.forEach(song => {
        if (!grouped[song.album_id]) grouped[song.album_id] = [];
        grouped[song.album_id].push(song);
      });
      setSongsData(grouped);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Kopiert!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openSongDetail = (albumId: string, albumName: string, songName: string) => {
    const songs = songsData[albumId];
    const song = songs?.find(s => s.name === songName);
    if (song) {
      setSelectedSong(song);
      setSelectedAlbumName(albumName);
      setDialogOpen(true);
    }
  };

  const handleSongSaved = () => {
    loadSongsData();
    if (onRefresh) onRefresh();
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(text, field);
      }}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <>
      <div
        className="rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden animate-fade-in-up"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Header */}
        <div
          className="p-6 cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Profile Image */}
              <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 border-2 border-primary/30">
                {imageUrl && !imageError ? (
                  <img
                    src={imageUrl}
                    alt={artist.name}
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="h-full w-full gradient-gold flex items-center justify-center">
                    <User className="h-8 w-8 text-primary-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-display font-bold text-foreground truncate">
                    {artist.name}
                  </h3>
                  {artist.katalognummer && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {artist.katalognummer}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                    {artist.genre}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                    {artist.style}
                  </span>
                  {imageUrl && !imageError && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
                      <Image className="h-3 w-3" />
                      Bild
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {showDelete && artist.id && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(artist.id!);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <span className="text-sm text-muted-foreground hidden sm:block">
                {artist.albums.length} Alben
              </span>
              {expanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="px-6 pb-6 space-y-6 border-t border-border pt-6">
            {/* Large Profile Image */}
            {imageUrl && !imageError && (
              <div className="flex justify-center">
                <div className="w-48 h-48 rounded-xl overflow-hidden border border-border shadow-lg">
                  <img
                    src={imageUrl}
                    alt={artist.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Personality */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Persönlichkeitsprompt</span>
              </div>
              <div className="flex items-start gap-2 p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-foreground flex-1 leading-relaxed">
                  {artist.personality}
                </p>
                <CopyButton text={artist.personality} field={`personality-${artist.name}`} />
              </div>
            </div>

            {/* Voice Prompt */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mic className="h-4 w-4" />
                <span>SUNO Stimmfrequenz Prompt</span>
              </div>
              <div className="flex items-start gap-2 p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-foreground flex-1 leading-relaxed font-mono">
                  {artist.voicePrompt}
                </p>
                <CopyButton text={artist.voicePrompt} field={`voice-${artist.name}`} />
              </div>
            </div>

            {/* Albums */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Disc className="h-4 w-4" />
                <span>Alben & Songs</span>
                <span className="text-xs text-primary">(Klicken zum Bearbeiten)</span>
              </div>
              <div className="grid gap-4">
                {artist.albums.map((album, albumIndex) => (
                  <div
                    key={albumIndex}
                    className="p-4 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display font-semibold text-foreground flex items-center gap-2">
                        <Disc className="h-4 w-4 text-primary" />
                        {album.name}
                      </h4>
                      <CopyButton text={album.name} field={`album-${album.name}`} />
                    </div>
                    <div className="space-y-2">
                      {album.songs.map((song, songIndex) => (
                        <div
                          key={songIndex}
                          className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors group cursor-pointer"
                          onClick={() => album.id && openSongDetail(album.id, album.name, song)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                              {String(songIndex + 1).padStart(2, "0")}
                            </span>
                            <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-sm text-foreground truncate">{song}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {album.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  album.id && openSongDetail(album.id, album.name, song);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={song} field={`song-${song}`} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <SongDetailDialog
        song={selectedSong}
        albumName={selectedAlbumName}
        artistName={artist.name}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSongSaved}
      />
    </>
  );
}
