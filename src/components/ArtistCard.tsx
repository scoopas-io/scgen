import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check, User, Mic, Disc, Music, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
}

interface ArtistCardProps {
  artist: Artist;
  index: number;
  onDelete?: (artistId: string) => void;
  showDelete?: boolean;
}

export function ArtistCard({ artist, index, onDelete, showDelete = false }: ArtistCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Kopiert!");
    setTimeout(() => setCopiedField(null), 2000);
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
            <div className="h-14 w-14 rounded-full gradient-gold flex items-center justify-center glow-gold shrink-0">
              <User className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-display font-bold text-foreground truncate">
                {artist.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  {artist.genre}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                  {artist.style}
                </span>
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
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                            {String(songIndex + 1).padStart(2, "0")}
                          </span>
                          <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate">{song}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <CopyButton text={song} field={`song-${song}`} />
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
  );
}
