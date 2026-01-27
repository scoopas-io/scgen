import { useState, useMemo } from "react";
import { RefreshCw, Check, Loader2, Music2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { ArtistWithAlbums } from "@/hooks/useCatalogData";

// V2 can only be fetched for songs created in the last 48 hours
const SUNO_TASK_EXPIRY_MS = 48 * 60 * 60 * 1000;

interface V2ProgressPanelProps {
  artists: ArtistWithAlbums[];
  onRefresh: () => void;
}

export function V2ProgressPanel({ artists, onRefresh }: V2ProgressPanelProps) {
  const { isAdmin } = useAuth();
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  // Calculate V2 stats across all artists
  const v2Stats = useMemo(() => {
    let totalWithAudio = 0;
    let totalWithV2 = 0;
    let totalFetchable = 0;
    const fetchableSongs: Array<{ id: string; suno_task_id: string }> = [];

    artists.forEach(artist => {
      artist.albums.forEach(album => {
        album.songs.forEach(song => {
          if (song.audio_url) {
            totalWithAudio++;
            
            if (song.alternative_audio_url) {
              totalWithV2++;
            } else if (song.suno_task_id && song.created_at) {
              const createdAt = new Date(song.created_at).getTime();
              const now = Date.now();
              if (now - createdAt < SUNO_TASK_EXPIRY_MS) {
                totalFetchable++;
                fetchableSongs.push({
                  id: song.id,
                  suno_task_id: song.suno_task_id,
                });
              }
            }
          }
        });
      });
    });

    const percentComplete = totalWithAudio > 0 
      ? Math.round((totalWithV2 / totalWithAudio) * 100) 
      : 0;

    return {
      totalWithAudio,
      totalWithV2,
      totalFetchable,
      percentComplete,
      fetchableSongs,
    };
  }, [artists]);

  const handleFetchAllV2 = async () => {
    if (v2Stats.fetchableSongs.length === 0) return;

    setIsFetching(true);
    setFetchProgress({ current: 0, total: v2Stats.fetchableSongs.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < v2Stats.fetchableSongs.length; i++) {
      const song = v2Stats.fetchableSongs[i];
      setFetchProgress({ current: i + 1, total: v2Stats.fetchableSongs.length });

      try {
        const { error } = await supabase.functions.invoke("fetch-alternative-version", {
          body: { songId: song.id, taskId: song.suno_task_id },
        });

        if (error) {
          console.error(`Error fetching V2 for song ${song.id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Exception fetching V2 for song ${song.id}:`, err);
        errorCount++;
      }

      // Small delay to avoid overwhelming the API
      if (i < v2Stats.fetchableSongs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsFetching(false);
    setFetchProgress({ current: 0, total: 0 });

    if (successCount > 0) {
      toast.success(`${successCount} V2-Version${successCount > 1 ? "en" : ""} geladen`);
      onRefresh();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} V2-Version${errorCount > 1 ? "en" : ""} fehlgeschlagen`);
    }
  };

  // Don't show if no songs with audio
  if (v2Stats.totalWithAudio === 0) return null;

  // Only show to admins
  if (!isAdmin) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Progress Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Music2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">V2-Versionen</span>
                <Badge 
                  variant={v2Stats.percentComplete === 100 ? "default" : "secondary"}
                  className="text-[10px] px-1.5"
                >
                  {v2Stats.totalWithV2} / {v2Stats.totalWithAudio}
                </Badge>
              </div>
              <Progress value={v2Stats.percentComplete} className="h-2" />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {v2Stats.percentComplete}% abgedeckt
                </span>
                {v2Stats.totalFetchable > 0 && (
                  <span className="text-[10px] text-primary">
                    {v2Stats.totalFetchable} abrufbar
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Fetch Button or Status */}
          <div className="flex items-center gap-2 shrink-0">
            {isFetching ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  {fetchProgress.current} / {fetchProgress.total}
                </span>
              </div>
            ) : v2Stats.totalFetchable > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleFetchAllV2}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Alle V2 laden ({v2Stats.totalFetchable})
              </Button>
            ) : v2Stats.percentComplete === 100 ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/50 gap-1">
                <Check className="h-3 w-3" />
                Vollständig
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1 text-[10px]">
                Keine abrufbar
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
