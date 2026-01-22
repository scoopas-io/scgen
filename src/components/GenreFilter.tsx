import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "R&B", "Jazz", "Blues", "Country", "Folk",
  "Electronic", "House", "Techno", "Ambient", "Classical", "Opera",
  "Reggae", "Ska", "Punk", "Metal", "Indie", "Alternative",
  "Soul", "Funk", "Disco", "Latin", "World Music", "Afrobeat",
  "K-Pop", "J-Pop", "Schlager", "Volksmusik", "Experimental"
];

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
  const selectAll = () => onGenresChange([...GENRES]);

  const displayedGenres = expanded ? GENRES : GENRES.slice(0, 12);

  return (
    <div className="space-y-3 p-4 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Genre-Filter</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 px-2">
            Keine
          </Button>
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7 px-2">
            Alle
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        {displayedGenres.map((genre) => {
          const isSelected = selectedGenres.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={cn(
                "px-2 py-1 rounded-full text-xs font-medium transition-all",
                "border flex items-center gap-1",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-secondary-foreground border-border hover:border-primary/50"
              )}
            >
              {isSelected && <Check className="h-2.5 w-2.5" />}
              {genre}
            </button>
          );
        })}
      </div>

      {GENRES.length > 12 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-muted-foreground h-7"
        >
          {expanded ? "Weniger" : `+${GENRES.length - 12} mehr`}
        </Button>
      )}

      {selectedGenres.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedGenres.length} Genre{selectedGenres.length > 1 ? "s" : ""} ausgewählt
        </p>
      )}
      {selectedGenres.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Keine Auswahl = alle Genres möglich
        </p>
      )}
    </div>
  );
}
