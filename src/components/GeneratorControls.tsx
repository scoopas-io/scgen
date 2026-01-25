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
    <div className="space-y-4 md:space-y-5 p-3 md:p-4 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
      <div className="space-y-2 md:space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm font-medium text-foreground">
            Anzahl Künstler
          </Label>
          <span className="text-lg md:text-xl font-display font-bold text-primary tabular-nums">
            {artistCount}
          </span>
        </div>
        <Slider
          value={[artistCount]}
          onValueChange={(v) => onArtistCountChange(v[0])}
          min={1}
          max={200}
          step={1}
          className="w-full touch-pan-x"
        />
        <p className="text-[10px] md:text-xs text-muted-foreground">1 - 200 Künstler (Bulk ab 11)</p>
      </div>

      <div className="space-y-2 md:space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm font-medium text-foreground">
            Alben pro Künstler
          </Label>
          <span className="text-lg md:text-xl font-display font-bold text-primary tabular-nums">
            {albumCount}
          </span>
        </div>
        <Slider
          value={[albumCount]}
          onValueChange={(v) => onAlbumCountChange(v[0])}
          min={1}
          max={5}
          step={1}
          className="w-full touch-pan-x"
        />
        <p className="text-[10px] md:text-xs text-muted-foreground">1 - 5 Alben pro Künstler</p>
      </div>

      <div className="space-y-2 md:space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm font-medium text-foreground">
            Songs pro Album
          </Label>
          <span className="text-lg md:text-xl font-display font-bold text-primary tabular-nums">
            {songCount}
          </span>
        </div>
        <Slider
          value={[songCount]}
          onValueChange={(v) => onSongCountChange(v[0])}
          min={3}
          max={20}
          step={1}
          className="w-full touch-pan-x"
        />
        <p className="text-[10px] md:text-xs text-muted-foreground">3 - 20 Songs pro Album</p>
      </div>
    </div>
  );
}
