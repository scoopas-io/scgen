import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { usePersonaBatchUpdate } from "@/hooks/usePersonaBatchUpdate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PersonaBatchUpdateButtonProps {
  onComplete?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function PersonaBatchUpdateButton({
  onComplete,
  variant = "outline",
  size = "default",
  className,
}: PersonaBatchUpdateButtonProps) {
  const { isUpdating, progress, runBatchUpdate, getArtistsNeedingUpdate } = usePersonaBatchUpdate();
  const [needsUpdateCount, setNeedsUpdateCount] = useState<number | null>(null);
  const [isCheckingCount, setIsCheckingCount] = useState(false);

  // Check how many artists need updating on mount
  useEffect(() => {
    const checkCount = async () => {
      setIsCheckingCount(true);
      const count = await getArtistsNeedingUpdate();
      setNeedsUpdateCount(count);
      setIsCheckingCount(false);
    };
    checkCount();
  }, [getArtistsNeedingUpdate]);

  // Refresh count after completion
  const handleComplete = () => {
    getArtistsNeedingUpdate().then(setNeedsUpdateCount);
    onComplete?.();
  };

  if (isUpdating && progress) {
    const progressPercent = progress.total > 0 
      ? Math.round((progress.current / progress.total) * 100) 
      : 0;

    return (
      <div className="space-y-2 p-3 rounded-lg border border-border bg-card/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="font-medium">Persona-Update läuft...</span>
          </div>
          <span className="text-muted-foreground">
            {progress.current}/{progress.total}
          </span>
        </div>
        
        <Progress value={progressPercent} className="h-2" />
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate max-w-[200px]">{progress.currentArtist}</span>
          <div className="flex items-center gap-3">
            {progress.updated > 0 && (
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle2 className="h-3 w-3" /> {progress.updated}
              </span>
            )}
            {progress.errors > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" /> {progress.errors}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Don't show button if no artists need updating
  if (needsUpdateCount === 0) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isCheckingCount || needsUpdateCount === 0}
        >
          {isCheckingCount ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Personas befüllen
          {needsUpdateCount !== null && needsUpdateCount > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {needsUpdateCount}
            </Badge>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Persona-Daten automatisch befüllen?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Diese Funktion analysiert {needsUpdateCount} Künstler und extrahiert automatisch:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Stimmcharakteristik (Geschlecht, Textur, Range) aus Voice-Prompts</li>
              <li>Stil- und Stimmungs-Tags aus Persönlichkeitsbeschreibungen</li>
              <li>BPM-Bereiche und bevorzugte Tonarten aus Song-Metadaten</li>
              <li>Instrumental-Flag basierend auf Genre</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Bereits vorhandene Persona-Daten werden nicht überschrieben.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => runBatchUpdate(handleComplete)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Jetzt befüllen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
