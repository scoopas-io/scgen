import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isInstrumentalGenre } from "@/lib/genreConfig";
import { 
  Play, Pause, Square, Zap, Clock, CheckCircle2, XCircle, 
  AlertCircle, Timer, Music, Settings2, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Song {
  id: string;
  name: string;
  album_id: string;
  bpm: number | null;
  tonart: string | null;
  audio_url: string | null;
  generation_status: string | null;
  suno_task_id: string | null;
  artistName: string;
  artistId: string;
  albumName: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
}

interface BulkGenerationPanelProps {
  songs: Song[];
  onSongUpdate: (songId: string, updates: Partial<Song>) => void;
  onComplete: () => void;
}

type GenerationStatus = "idle" | "running" | "paused" | "stopped";

export function BulkGenerationPanel({ songs, onSongUpdate, onComplete }: BulkGenerationPanelProps) {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [delayBetweenSongs, setDelayBetweenSongs] = useState(3); // seconds
  const [maxConcurrent, setMaxConcurrent] = useState(1); // sequential by default
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    currentSong: "",
    currentArtist: "",
    startTime: null as number | null,
    estimatedRemaining: 0,
  });
  
  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  const isRunningRef = useRef(false);

  // Filter songs that need generation
  const pendingSongs = songs.filter(song => 
    !song.audio_url && 
    song.generation_status !== "processing" &&
    song.generation_status !== "generating" &&
    song.generation_status !== "completed"
  );

  const generateSong = async (song: Song): Promise<"success" | "error" | "skipped"> => {
    // Check if already generated or in progress
    if (song.audio_url || song.generation_status === "completed") {
      return "skipped";
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-song-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            songId: song.id,
            title: song.name,
            genre: song.genre,
            style: song.style,
            voicePrompt: song.voicePrompt,
            personality: song.personality,
            bpm: song.bpm,
            tonart: song.tonart,
            artistName: song.artistName,
            instrumental: isInstrumentalGenre(song.genre),
          }),
        }
      );

      const result = await response.json();
      
      if (result.success) {
        onSongUpdate(song.id, { 
          generation_status: result.status, 
          suno_task_id: result.taskId 
        });
        return "success";
      } else {
        onSongUpdate(song.id, { generation_status: "error" });
        console.error(`Generation failed for ${song.name}:`, result.error);
        return "error";
      }
    } catch (error) {
      console.error(`Error generating ${song.name}:`, error);
      onSongUpdate(song.id, { generation_status: "error" });
      return "error";
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runBulkGeneration = useCallback(async () => {
    if (isRunningRef.current) return;
    
    isRunningRef.current = true;
    stopRef.current = false;
    pauseRef.current = false;
    setStatus("running");

    const songsToProcess = [...pendingSongs];
    const total = songsToProcess.length;
    
    if (total === 0) {
      toast.info("Keine Songs zum Generieren gefunden");
      setStatus("idle");
      isRunningRef.current = false;
      return;
    }

    setProgress({
      current: 0,
      total,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      currentSong: "",
      currentArtist: "",
      startTime: Date.now(),
      estimatedRemaining: total * (delayBetweenSongs + 2), // rough estimate
    });

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < songsToProcess.length; i++) {
      // Check for stop
      if (stopRef.current) {
        toast.info("Generierung gestoppt");
        break;
      }

      // Handle pause
      while (pauseRef.current && !stopRef.current) {
        await sleep(500);
      }

      if (stopRef.current) {
        toast.info("Generierung gestoppt");
        break;
      }

      const song = songsToProcess[i];
      
      setProgress(prev => ({
        ...prev,
        current: i,
        currentSong: song.name,
        currentArtist: song.artistName,
        estimatedRemaining: Math.max(0, (songsToProcess.length - i) * (delayBetweenSongs + 2)),
      }));

      const result = await generateSong(song);
      
      if (result === "success") {
        successCount++;
      } else if (result === "error") {
        errorCount++;
      } else {
        skippedCount++;
      }

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        successCount,
        errorCount,
        skippedCount,
      }));

      // Rate limit delay (skip for last song)
      if (i < songsToProcess.length - 1 && !stopRef.current) {
        // Check pause during delay
        let delayRemaining = delayBetweenSongs * 1000;
        while (delayRemaining > 0 && !stopRef.current) {
          if (pauseRef.current) {
            while (pauseRef.current && !stopRef.current) {
              await sleep(500);
            }
          }
          await sleep(Math.min(500, delayRemaining));
          delayRemaining -= 500;
        }
      }
    }

    setStatus("idle");
    isRunningRef.current = false;
    
    const message = stopRef.current
      ? `Gestoppt: ${successCount} gestartet, ${errorCount} Fehler`
      : `Fertig: ${successCount} gestartet, ${errorCount} Fehler, ${skippedCount} übersprungen`;
    
    if (errorCount > 0) {
      toast.warning(message);
    } else {
      toast.success(message);
    }
    
    onComplete();
  }, [pendingSongs, delayBetweenSongs, onSongUpdate, onComplete]);

  const handleStart = () => {
    if (status === "paused") {
      pauseRef.current = false;
      setStatus("running");
    } else {
      runBulkGeneration();
    }
  };

  const handlePause = () => {
    pauseRef.current = true;
    setStatus("paused");
  };

  const handleStop = () => {
    stopRef.current = true;
    pauseRef.current = false;
    setStatus("stopped");
  };

  const progressPercent = progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  if (pendingSongs.length === 0 && status === "idle") {
    return (
      <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Alle Songs wurden bereits generiert oder sind in Bearbeitung</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-primary/30 bg-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Bulk-Generierung</h3>
            <p className="text-xs text-muted-foreground">
              {pendingSongs.length} Songs bereit zum Abrufen
            </p>
          </div>
        </div>
        
        <Badge variant="outline" className={
          status === "running" ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
          status === "paused" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
          status === "stopped" ? "bg-red-500/10 text-red-500 border-red-500/30" :
          ""
        }>
          {status === "running" && "Läuft"}
          {status === "paused" && "Pausiert"}
          {status === "stopped" && "Gestoppt"}
          {status === "idle" && "Bereit"}
        </Badge>
      </div>

      {/* Settings Collapsible */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-xs">Einstellungen</span>
            </div>
            {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Verzögerung zwischen Songs</Label>
              <span className="text-sm font-mono text-primary">{delayBetweenSongs}s</span>
            </div>
            <Slider
              value={[delayBetweenSongs]}
              onValueChange={(v) => setDelayBetweenSongs(v[0])}
              min={1}
              max={10}
              step={1}
              disabled={status !== "idle"}
            />
            <p className="text-[10px] text-muted-foreground">
              Längere Verzögerung = weniger API-Fehler, aber langsamer
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Progress Section */}
      {(status !== "idle" || progress.current > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-mono">{progress.current}/{progress.total}</span>
          </div>
          
          <Progress value={progressPercent} className="h-2" />
          
          {progress.currentSong && status === "running" && (
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <Music className="h-4 w-4 text-muted-foreground shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{progress.currentSong}</p>
                <p className="text-xs text-muted-foreground truncate">{progress.currentArtist}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>~{formatTime(progress.estimatedRemaining)}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-green-500/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600">{progress.successCount}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600">{progress.errorCount}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{progress.skippedCount} skip</span>
            </div>
          </div>
        </div>
      )}

      {/* API Info */}
      <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 text-xs">
        <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-yellow-700">
          Die Suno API hat Rate Limits. Bei zu vielen Anfragen werden Songs automatisch mit Verzögerung abgerufen.
        </p>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {status === "idle" && (
          <Button 
            onClick={handleStart} 
            className="flex-1 gradient-gold"
            disabled={pendingSongs.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Alle {pendingSongs.length} Songs abrufen
          </Button>
        )}
        
        {status === "running" && (
          <>
            <Button 
              onClick={handlePause} 
              variant="outline" 
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pausieren
            </Button>
            <Button 
              onClick={handleStop} 
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stoppen
            </Button>
          </>
        )}
        
        {status === "paused" && (
          <>
            <Button 
              onClick={handleStart} 
              className="flex-1 gradient-gold"
            >
              <Play className="h-4 w-4 mr-2" />
              Fortsetzen
            </Button>
            <Button 
              onClick={handleStop} 
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stoppen
            </Button>
          </>
        )}
        
        {status === "stopped" && (
          <Button 
            onClick={handleStart} 
            className="flex-1 gradient-gold"
          >
            <Play className="h-4 w-4 mr-2" />
            Neu starten
          </Button>
        )}
      </div>
    </div>
  );
}
