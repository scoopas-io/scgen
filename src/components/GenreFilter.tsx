import { useState } from "react";
import { Check, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GENRE_CONFIG, isInstrumentalGenre } from "@/lib/genreConfig";

interface GenreFilterProps {
  selectedGenres: string[];
  onGenresChange: (genres: string[]) => void;
}

export function GenreFilter({ selectedGenres, onGenresChange }: GenreFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      onGenresChange(selectedGenres.filter((g) => g !== genre));
    } else {
      onGenresChange([...selectedGenres, genre]);
    }
  };

  const clearAll = () => onGenresChange([]);
  const selectAll = () => onGenresChange(GENRE_CONFIG.map(g => g.name));
  const selectInstrumental = () => onGenresChange(GENRE_CONFIG.filter(g => g.instrumental).map(g => g.name));
  const selectVocal = () => onGenresChange(GENRE_CONFIG.filter(g => !g.instrumental).map(g => g.name));

  const displayedGenres = expanded ? GENRE_CONFIG : GENRE_CONFIG.slice(0, 12);

  const selectedInstrumentalCount = selectedGenres.filter(g => isInstrumentalGenre(g)).length;
  const selectedVocalCount = selectedGenres.length - selectedInstrumentalCount;

  return (
    <div className="space-y-2 md:space-y-3 p-3 md:p-4 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs md:text-sm font-medium text-foreground">Genre-Filter</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-[10px] md:text-xs h-6 md:h-7 px-1.5 md:px-2">
            Keine
          </Button>
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-[10px] md:text-xs h-6 md:h-7 px-1.5 md:px-2">
            Alle
          </Button>
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={selectInstrumental}
          className="text-[10px] md:text-xs h-6 md:h-7 px-2 gap-1"
        >
          <Music2 className="h-3 w-3" />
          Nur Instrumental
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={selectVocal}
          className="text-[10px] md:text-xs h-6 md:h-7 px-2"
        >
          Nur Vocal
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-1 md:gap-1.5">
        {displayedGenres.map((genreConfig) => {
          const isSelected = selectedGenres.includes(genreConfig.name);
          return (
            <button
              key={genreConfig.name}
              onClick={() => toggleGenre(genreConfig.name)}
              className={cn(
                "px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium transition-all",
                "border flex items-center gap-0.5 md:gap-1 active:scale-95",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-secondary-foreground border-border hover:border-primary/50 active:bg-secondary"
              )}
            >
              {isSelected && <Check className="h-2 w-2 md:h-2.5 md:w-2.5" />}
              {genreConfig.name}
              {genreConfig.instrumental && (
                <Music2 className="h-2 w-2 md:h-2.5 md:w-2.5 opacity-60" />
              )}
            </button>
          );
        })}
      </div>

      {GENRE_CONFIG.length > 12 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-[10px] md:text-xs text-muted-foreground h-6 md:h-7"
        >
          {expanded ? "Weniger" : `+${GENRE_CONFIG.length - 12} mehr`}
        </Button>
      )}

      <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
        <span>
          {selectedGenres.length > 0 
            ? `${selectedGenres.length} Genre${selectedGenres.length > 1 ? "s" : ""} ausgewählt`
            : "Keine Auswahl = alle Genres"
          }
        </span>
        {selectedGenres.length > 0 && (
          <span className="flex items-center gap-1">
            <Music2 className="h-3 w-3" />
            {selectedInstrumentalCount} instrumental, {selectedVocalCount} vocal
          </span>
        )}
      </div>
    </div>
  );
}

// Re-export for convenience
export { isInstrumentalGenre, GENRES } from "@/lib/genreConfig";
