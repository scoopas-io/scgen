import { Loader2, ImageIcon, Database, Brain, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

export type GenerationPhase = 
  | "preparing" 
  | "generating_text" 
  | "saving_db" 
  | "generating_images" 
  | "uploading_images"
  | "complete";

interface LoadingStateProps {
  progress?: number;
  currentBatch?: number;
  totalBatches?: number;
  generatedCount?: number;
  totalCount?: number;
  phase?: GenerationPhase;
  currentArtist?: string;
  imagesGenerated?: number;
  imagesTotal?: number;
  startTime?: number;
}

const PHASE_INFO: Record<GenerationPhase, { label: string; icon: React.ElementType; description: string }> = {
  preparing: { label: "Vorbereitung", icon: Loader2, description: "Lade existierende Daten..." },
  generating_text: { label: "KI-Generierung", icon: Brain, description: "Erstelle Künstlerprofile mit KI..." },
  saving_db: { label: "Speichern", icon: Database, description: "Speichere Daten in Datenbank..." },
  generating_images: { label: "Bildgenerierung", icon: ImageIcon, description: "Generiere Profilbilder mit KI..." },
  uploading_images: { label: "Upload", icon: RefreshCw, description: "Lade Bilder hoch..." },
  complete: { label: "Fertig", icon: CheckCircle2, description: "Alle Künstler generiert!" },
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export function LoadingState({ 
  progress = 0, 
  currentBatch = 0, 
  totalBatches = 0,
  generatedCount = 0,
  totalCount = 0,
  phase = "preparing",
  currentArtist,
  imagesGenerated = 0,
  imagesTotal = 0,
  startTime
}: LoadingStateProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);
  
  const isBatchMode = totalBatches > 1;
  const phaseInfo = PHASE_INFO[phase];
  const PhaseIcon = phaseInfo.icon;
  
  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed);
      
      // Estimate remaining time based on progress
      if (progress > 5 && progress < 100) {
        const totalEstimated = elapsed / (progress / 100);
        const remaining = totalEstimated - elapsed;
        setEstimatedRemaining(Math.max(0, remaining));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, progress]);
  
  // Calculate overall progress combining phases
  const phaseWeights: Record<GenerationPhase, number> = {
    preparing: 5,
    generating_text: 25,
    saving_db: 10,
    generating_images: 50,
    uploading_images: 10,
    complete: 0,
  };
  
  const getPhaseProgress = () => {
    const phases: GenerationPhase[] = ["preparing", "generating_text", "saving_db", "generating_images", "uploading_images", "complete"];
    const currentIndex = phases.indexOf(phase);
    let baseProgress = 0;
    for (let i = 0; i < currentIndex; i++) {
      baseProgress += phaseWeights[phases[i]];
    }
    
    // Add partial progress within current phase
    if (phase === "generating_images" && imagesTotal > 0) {
      baseProgress += (imagesGenerated / imagesTotal) * phaseWeights.generating_images;
    } else if (phase === "saving_db" && totalCount > 0) {
      baseProgress += (generatedCount / totalCount) * phaseWeights.saving_db;
    }
    
    return Math.min(100, baseProgress);
  };
  
  const displayProgress = phase === "complete" ? 100 : Math.max(progress, getPhaseProgress());
  
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      {/* Animated Icon */}
      <div className="relative">
        <div className="h-20 w-20 rounded-full gradient-gold animate-pulse-glow flex items-center justify-center">
          <PhaseIcon className={`h-10 w-10 text-primary-foreground ${phase !== "complete" ? "animate-spin" : ""}`} 
            style={{ animationDuration: phase === "generating_images" ? "3s" : "1s" }} />
        </div>
        {phase === "generating_images" && (
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{imagesGenerated}/{imagesTotal}</span>
          </div>
        )}
      </div>
      
      {/* Phase Status */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
            {phaseInfo.label}
          </span>
          {isBatchMode && currentBatch > 0 && (
            <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
              Batch {currentBatch}/{totalBatches}
            </span>
          )}
        </div>
        
        <p className="text-lg font-display font-medium text-foreground">
          {phaseInfo.description}
        </p>
        
        {currentArtist && (
          <p className="text-sm text-primary font-medium">
            {phase === "generating_images" ? "Bild für: " : ""}
            {currentArtist}
          </p>
        )}
        
        {generatedCount > 0 && totalCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {generatedCount} von {totalCount} Künstlern erstellt
          </p>
        )}
      </div>
      
      {/* Progress Bar */}
      <div className="w-full max-w-md space-y-2">
        <Progress value={displayProgress} className="h-3" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(displayProgress)}%</span>
          <div className="flex items-center gap-3">
            {startTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(elapsedTime)}
              </span>
            )}
            {estimatedRemaining !== null && estimatedRemaining > 0 && (
              <span className="text-primary">
                ~{formatTime(estimatedRemaining)} verbleibend
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Phase Timeline */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-border" />
          {(["preparing", "generating_text", "saving_db", "generating_images", "complete"] as GenerationPhase[]).map((p, i) => {
            const phases: GenerationPhase[] = ["preparing", "generating_text", "saving_db", "generating_images", "complete"];
            const currentIndex = phases.indexOf(phase);
            const isCompleted = phases.indexOf(p) < currentIndex;
            const isCurrent = p === phase || (phase === "uploading_images" && p === "generating_images");
            const info = PHASE_INFO[p];
            const Icon = info.icon;
            
            return (
              <div key={p} className="relative z-10 flex flex-col items-center">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                  isCompleted ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted"
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <Icon className={`h-3 w-3 ${isCurrent ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  )}
                </div>
                <span className={`text-[10px] mt-1 ${isCurrent ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {info.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Skeleton cards */}
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
