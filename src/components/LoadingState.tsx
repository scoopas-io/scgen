import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LoadingStateProps {
  progress?: number;
  currentBatch?: number;
  totalBatches?: number;
  generatedCount?: number;
  totalCount?: number;
}

export function LoadingState({ 
  progress, 
  currentBatch, 
  totalBatches,
  generatedCount,
  totalCount 
}: LoadingStateProps) {
  const isBatchMode = totalBatches && totalBatches > 1;
  
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full gradient-gold animate-pulse-glow flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary-foreground animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-display font-medium text-foreground">
          {isBatchMode ? `Batch ${currentBatch} von ${totalBatches}` : "Generiere Künstler..."}
        </p>
        {isBatchMode && generatedCount !== undefined && totalCount !== undefined ? (
          <p className="text-sm text-muted-foreground">
            {generatedCount} von {totalCount} Künstlern erstellt
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            KI erstellt einzigartige Artist-Profile mit Profilbildern
          </p>
        )}
      </div>
      
      {progress !== undefined && (
        <div className="w-full max-w-sm">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center mt-2">
            {Math.round(progress)}% abgeschlossen
          </p>
        </div>
      )}
      
      {/* Compact skeleton cards */}
      <div className="w-full max-w-lg space-y-2 mt-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg animate-shimmer"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
