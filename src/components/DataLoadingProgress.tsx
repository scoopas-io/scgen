import { Progress } from "@/components/ui/progress";
import { User, Disc, Music, Loader2, CheckCircle2, Database } from "lucide-react";

interface LoadingProgressState {
  phase: "init" | "artists" | "albums" | "songs" | "processing" | "done";
  current: number;
  total: number;
  startTime: number | null;
  phaseStartTime: number | null;
  artistsLoaded: number;
  albumsLoaded: number;
  songsLoaded: number;
}

interface DataLoadingProgressProps {
  progress: LoadingProgressState;
  stats: { artists: number; albums: number; songs: number };
}

export function DataLoadingProgress({ progress, stats }: DataLoadingProgressProps) {
  const totalItems = stats.artists + stats.albums + stats.songs;
  const progressPercent = totalItems > 0 ? (progress.current / totalItems) * 100 : 0;
  
  const getElapsedTime = () => {
    if (!progress.startTime) return "0s";
    const elapsed = Math.floor((Date.now() - progress.startTime) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}m ${secs}s`;
  };

  const getEstimatedRemaining = () => {
    if (!progress.startTime || progress.current === 0) return "Berechne...";
    const elapsed = Date.now() - progress.startTime;
    const rate = progress.current / elapsed; // items per ms
    const remaining = totalItems - progress.current;
    const estimatedMs = remaining / rate;
    const estimatedSec = Math.ceil(estimatedMs / 1000);
    
    if (estimatedSec < 1) return "<1s";
    if (estimatedSec < 60) return `~${estimatedSec}s`;
    const mins = Math.floor(estimatedSec / 60);
    const secs = estimatedSec % 60;
    return `~${mins}m ${secs}s`;
  };

  const phases = [
    { 
      key: "artists", 
      label: "Künstler", 
      icon: User, 
      loaded: progress.artistsLoaded, 
      total: stats.artists 
    },
    { 
      key: "albums", 
      label: "Alben", 
      icon: Disc, 
      loaded: progress.albumsLoaded, 
      total: stats.albums 
    },
    { 
      key: "songs", 
      label: "Songs", 
      icon: Music, 
      loaded: progress.songsLoaded, 
      total: stats.songs 
    },
  ];

  const getPhaseStatus = (phaseKey: string) => {
    const phaseOrder = ["init", "artists", "albums", "songs", "processing", "done"];
    const currentIndex = phaseOrder.indexOf(progress.phase);
    const phaseIndex = phaseOrder.indexOf(phaseKey);
    
    if (phaseIndex < currentIndex) return "completed";
    if (phaseIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-full max-w-md p-6 rounded-xl bg-card border border-border shadow-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10">
            <Database className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold">Katalog wird geladen</h3>
          <p className="text-sm text-muted-foreground">
            {progress.phase === "processing" 
              ? "Daten werden verarbeitet..."
              : `${progress.current.toLocaleString()} von ${totalItems.toLocaleString()} Einträgen`
            }
          </p>
        </div>

        {/* Main Progress Bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Verstrichene Zeit: {getElapsedTime()}</span>
            <span>{Math.round(progressPercent)}%</span>
            <span>Verbleibend: {getEstimatedRemaining()}</span>
          </div>
        </div>

        {/* Phase Indicators */}
        <div className="space-y-3">
          {phases.map((phase) => {
            const status = getPhaseStatus(phase.key);
            const Icon = phase.icon;
            const phaseProgress = phase.total > 0 ? (phase.loaded / phase.total) * 100 : 0;
            
            return (
              <div 
                key={phase.key} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  status === "active" 
                    ? "bg-primary/10 border border-primary/30" 
                    : status === "completed"
                    ? "bg-green-500/5 border border-green-500/20"
                    : "bg-muted/30 border border-transparent"
                }`}
              >
                {/* Icon */}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  status === "active" 
                    ? "bg-primary/20" 
                    : status === "completed"
                    ? "bg-green-500/20"
                    : "bg-muted"
                }`}>
                  {status === "active" ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                {/* Label and Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      status === "active" ? "text-primary" : 
                      status === "completed" ? "text-green-600" : 
                      "text-muted-foreground"
                    }`}>
                      {phase.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {phase.loaded.toLocaleString()} / {phase.total.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Mini progress bar for active phase */}
                  {status === "active" && (
                    <Progress value={phaseProgress} className="h-1.5" />
                  )}
                  {status === "completed" && (
                    <div className="h-1.5 w-full bg-green-500/30 rounded-full">
                      <div className="h-full w-full bg-green-500 rounded-full" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Processing Phase */}
          {progress.phase === "processing" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-primary/20">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Verarbeitung</span>
                <p className="text-xs text-muted-foreground">Daten werden zugeordnet...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
