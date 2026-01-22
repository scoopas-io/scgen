import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface GeneratorControlsProps {
  artistCount: number;
  albumCount: number;
  songCount: number;
  onArtistCountChange: (value: number) => void;
  onAlbumCountChange: (value: number) => void;
  onSongCountChange: (value: number) => void;
}

export function GeneratorControls({
  artistCount,
  albumCount,
  songCount,
  onArtistCountChange,
  onAlbumCountChange,
  onSongCountChange,
}: GeneratorControlsProps) {
  return (
    <div className="space-y-8 p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium text-foreground">
            Anzahl Künstler
          </Label>
          <span className="text-2xl font-display font-bold text-primary">
            {artistCount}
          </span>
        </div>
        <Slider
          value={[artistCount]}
          onValueChange={(v) => onArtistCountChange(v[0])}
          min={1}
          max={50}
          step={1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">1 - 50 Künstler generieren</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium text-foreground">
            Alben pro Künstler
          </Label>
          <span className="text-2xl font-display font-bold text-primary">
            {albumCount}
          </span>
        </div>
        <Slider
          value={[albumCount]}
          onValueChange={(v) => onAlbumCountChange(v[0])}
          min={1}
          max={5}
          step={1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">1 - 5 Alben pro Künstler</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium text-foreground">
            Songs pro Album
          </Label>
          <span className="text-2xl font-display font-bold text-primary">
            {songCount}
          </span>
        </div>
        <Slider
          value={[songCount]}
          onValueChange={(v) => onSongCountChange(v[0])}
          min={3}
          max={12}
          step={1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">3 - 12 Songs pro Album</p>
      </div>
    </div>
  );
}
