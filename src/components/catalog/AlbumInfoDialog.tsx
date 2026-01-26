import { Disc, Calendar, Music, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Song {
  id: string;
  name: string;
  track_number?: number;
  bpm?: number | null;
  tonart?: string | null;
  audio_url?: string | null;
}

interface Album {
  id: string;
  name: string;
  release_date?: string;
  songs: Song[];
}

interface AlbumInfoDialogProps {
  album: Album | null;
  artistName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlbumInfoDialog({ album, artistName, open, onOpenChange }: AlbumInfoDialogProps) {
  if (!album) return null;

  const songsWithAudio = album.songs.filter(s => s.audio_url).length;
  const totalSongs = album.songs.length;

  // Calculate BPM range
  const bpmValues = album.songs.map(s => s.bpm).filter((b): b is number => b !== null && b !== undefined);
  const bpmMin = bpmValues.length > 0 ? Math.min(...bpmValues) : null;
  const bpmMax = bpmValues.length > 0 ? Math.max(...bpmValues) : null;

  // Get unique keys
  const uniqueKeys = [...new Set(album.songs.map(s => s.tonart).filter(Boolean))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Disc className="h-5 w-5 text-primary" />
            Album-Informationen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold text-lg">{album.name}</h3>
            <p className="text-sm text-muted-foreground">{artistName}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">
                <Music className="h-3 w-3 mr-1" />
                {totalSongs} Songs
              </Badge>
              {songsWithAudio > 0 && songsWithAudio < totalSongs && (
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  {songsWithAudio} verfügbar
                </Badge>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="grid gap-3">
            {album.release_date && (
              <div className="flex items-center gap-3 bg-card rounded-lg border border-border p-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Veröffentlichung</p>
                  <p className="text-sm font-medium">
                    {new Date(album.release_date).toLocaleDateString("de-DE", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </p>
                </div>
              </div>
            )}

            {bpmMin !== null && bpmMax !== null && (
              <div className="flex items-center gap-3 bg-card rounded-lg border border-border p-3">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">BPM-Bereich</p>
                  <p className="text-sm font-medium">
                    {bpmMin === bpmMax ? `${bpmMin} BPM` : `${bpmMin} - ${bpmMax} BPM`}
                  </p>
                </div>
              </div>
            )}

            {uniqueKeys.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-2">Tonarten</p>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueKeys.map(key => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Track List */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tracklist</h4>
            <div className="bg-card rounded-lg border border-border divide-y divide-border/50 max-h-48 overflow-y-auto">
              {album.songs
                .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                .map(song => (
                  <div key={song.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
                      {song.track_number || "-"}
                    </span>
                    <span className="text-sm flex-1 truncate">{song.name}</span>
                    {song.audio_url && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        ✓
                      </Badge>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
