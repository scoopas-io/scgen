import { useState, useEffect, useRef } from "react";
import { 
  Share2, User, Sparkles, Instagram, Twitter, Facebook, Linkedin, 
  Youtube, Music2, Download, Trash2, RefreshCw, Image as ImageIcon,
  FileText, Video, MessageSquare, Loader2, Calendar, Clock, Link2,
  ExternalLink, Play, CheckCircle2, XCircle, Send, CalendarDays, Eye, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AppHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Artist {
  id: string;
  name: string;
  genre: string;
  style: string;
  personality: string;
  voice_prompt: string;
  profile_image_url?: string;
}

interface SocialContent {
  id: string;
  artist_id: string;
  content_type: string;
  platform: string;
  title?: string;
  caption?: string;
  hashtags?: string[];
  image_url?: string;
  video_url?: string;
  prompt?: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  published_url?: string;
  created_at: string;
}

interface PlatformConnection {
  id: string;
  platform: string;
  platform_username?: string;
  platform_avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  { id: "tiktok", name: "TikTok", icon: Music2, color: "text-foreground", bgColor: "bg-muted" },
  { id: "youtube", name: "YouTube", icon: Youtube, color: "text-red-500", bgColor: "bg-red-500/10" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "text-blue-600", bgColor: "bg-blue-600/10" },
  { id: "twitter", name: "Twitter/X", icon: Twitter, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "text-blue-700", bgColor: "bg-blue-700/10" },
];

const CONTENT_TYPES = [
  { id: "post", name: "Post", icon: ImageIcon },
  { id: "story", name: "Story", icon: MessageSquare },
  { id: "reel", name: "Reel/Video", icon: Video },
  { id: "text", name: "Text/Caption", icon: FileText },
];

type GenerationPhase = "idle" | "text" | "image" | "video" | "saving" | "complete";

const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: "",
  text: "Erstelle Caption & Hashtags...",
  image: "Generiere Bild...",
  video: "Generiere Video...",
  saving: "Speichere Content...",
  complete: "Fertig!",
};

const PHASE_DURATIONS: Record<GenerationPhase, number> = {
  idle: 0,
  text: 5,
  image: 15,
  video: 30,
  saving: 3,
  complete: 0,
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

const SocialTools = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [selectedContentType, setSelectedContentType] = useState<string>("post");
  const [customPrompt, setCustomPrompt] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);
  const [generatedContent, setGeneratedContent] = useState<SocialContent[]>([]);
  const [platformConnections, setPlatformConnections] = useState<PlatformConnection[]>([]);
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0 });
  const [activeTab, setActiveTab] = useState("generator");
  const [calendarWeekStart, setCalendarWeekStart] = useState(startOfWeek(new Date(), { locale: de }));
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<SocialContent | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isRegeneratingVideo, setIsRegeneratingVideo] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadArtists();
    loadStats();
    loadGeneratedContent();
    loadPlatformConnections();
  }, []);

  // Progress timer effect
  useEffect(() => {
    if (isGenerating && generationStartTime) {
      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - generationStartTime) / 1000;
        
        // Calculate total expected duration based on content type
        let totalDuration = PHASE_DURATIONS.text + PHASE_DURATIONS.saving;
        if (selectedContentType === "reel") {
          totalDuration += PHASE_DURATIONS.video;
        } else if (selectedContentType === "post" || selectedContentType === "story") {
          totalDuration += PHASE_DURATIONS.image;
        }
        
        const progress = Math.min(95, (elapsed / totalDuration) * 100);
        setGenerationProgress(progress);
        
        const remaining = Math.max(0, totalDuration - elapsed);
        setEstimatedRemaining(remaining);
      }, 500);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isGenerating, generationStartTime, selectedContentType]);

  const loadStats = async () => {
    const [artistsRes, albumsRes, songsRes] = await Promise.all([
      supabase.from("artists").select("id", { count: "exact", head: true }),
      supabase.from("albums").select("id", { count: "exact", head: true }),
      supabase.from("songs").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      artists: artistsRes.count || 0,
      albums: albumsRes.count || 0,
      songs: songsRes.count || 0,
    });
  };

  const loadArtists = async () => {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name, genre, style, personality, voice_prompt, profile_image_url")
      .order("name");
    
    if (error) {
      console.error("Error loading artists:", error);
      return;
    }
    setArtists(data || []);
  };

  const loadGeneratedContent = async () => {
    const { data, error } = await supabase
      .from("social_content")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error loading content:", error);
      return;
    }
    setGeneratedContent(data || []);
  };

  const loadPlatformConnections = async () => {
    const { data, error } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error loading connections:", error);
      return;
    }
    setPlatformConnections(data || []);
  };

  const selectedArtist = artists.find(a => a.id === selectedArtistId);

  const generateContent = async () => {
    if (!selectedArtist) {
      toast.error("Bitte wähle einen Künstler aus");
      return;
    }

    setIsGenerating(true);
    setGenerationPhase("text");
    setGenerationProgress(0);
    setGenerationStartTime(Date.now());
    setEstimatedRemaining(null);
    
    try {
      // Schedule phase updates based on content type
      const phaseTimeouts: NodeJS.Timeout[] = [];
      
      phaseTimeouts.push(setTimeout(() => {
        if (selectedContentType === "reel") {
          setGenerationPhase("video");
        } else if (selectedContentType === "post" || selectedContentType === "story") {
          setGenerationPhase("image");
        }
      }, 3000));

      if (selectedContentType === "reel") {
        phaseTimeouts.push(setTimeout(() => setGenerationPhase("saving"), 25000));
      } else if (selectedContentType === "post" || selectedContentType === "story") {
        phaseTimeouts.push(setTimeout(() => setGenerationPhase("saving"), 12000));
      }

      // Build scheduled datetime if provided
      let scheduledAt = null;
      if (scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-social-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            artistId: selectedArtist.id,
            artistName: selectedArtist.name,
            artistPersonality: selectedArtist.personality,
            artistGenre: selectedArtist.genre,
            artistStyle: selectedArtist.style,
            artistImageUrl: selectedArtist.profile_image_url,
            platform: selectedPlatform,
            contentType: selectedContentType,
            customPrompt,
            scheduledAt,
          }),
        }
      );

      // Clear phase timeouts
      phaseTimeouts.forEach(t => clearTimeout(t));

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler bei der Generierung");
      }

      setGenerationPhase("saving");
      setGenerationProgress(90);
      const data = await response.json();
      
      setGenerationPhase("complete");
      setGenerationProgress(100);
      
      const message = data.hasVideo 
        ? "Video erfolgreich generiert!" 
        : data.hasImage 
          ? "Content mit Bild generiert!"
          : "Content erfolgreich generiert!";
      
      toast.success(message);

       // Optional backend hint (e.g. video fallback reasons)
       if (data.note) {
         toast(String(data.note));
       }
      await loadGeneratedContent();
      
      // Show preview of generated content
      if (data.content) {
        setPreviewContent(data.content);
        setShowPreview(true);
      }
      
      // Reset scheduling inputs
      setScheduledDate("");
      setScheduledTime("");
      
      setTimeout(() => {
        setGenerationPhase("idle");
        setGenerationProgress(0);
        setGenerationStartTime(null);
        setEstimatedRemaining(null);
      }, 1500);
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error(error instanceof Error ? error.message : "Fehler bei der Generierung");
      setGenerationPhase("idle");
      setGenerationProgress(0);
      setGenerationStartTime(null);
      setEstimatedRemaining(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const publishContent = async (contentId: string, platform: string) => {
    const connection = platformConnections.find(c => c.platform === platform);
    if (!connection) {
      toast.error(`Keine ${platform} Verbindung gefunden. Bitte verbinde zuerst dein Konto.`);
      return;
    }

    setIsPublishing(contentId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish-social-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            contentId,
            platform,
            connectionId: connection.id,
          }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success("Erfolgreich veröffentlicht!");
        loadGeneratedContent();
      } else {
        toast.error(data.error || "Veröffentlichung fehlgeschlagen");
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast.error("Fehler beim Veröffentlichen");
    } finally {
      setIsPublishing(null);
    }
  };

  const deleteContent = async (id: string) => {
    const { error } = await supabase.from("social_content").delete().eq("id", id);
    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }
    toast.success("Content gelöscht");
    loadGeneratedContent();
  };

  const downloadMedia = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast.error("Fehler beim Download");
    }
  };

  const regenerateVideo = async (content: SocialContent) => {
    const artist = getArtistForContent(content.artist_id);
    if (!artist) {
      toast.error("Künstler nicht gefunden");
      return;
    }

    setIsRegeneratingVideo(content.id);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-social-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            artistId: artist.id,
            artistName: artist.name,
            artistPersonality: artist.personality,
            artistGenre: artist.genre,
            artistStyle: artist.style,
            artistImageUrl: artist.profile_image_url,
            platform: content.platform,
            contentType: "reel",
            customPrompt: content.prompt || "",
            regenerateVideoFor: content.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler bei der Video-Generierung");
      }

      const data = await response.json();
      
      if (data.hasVideo) {
        toast.success("Video erfolgreich generiert!");
      } else {
        toast(data.note || "Video konnte nicht generiert werden, neues Cover erstellt.");
      }
      
      await loadGeneratedContent();
    } catch (error) {
      console.error("Error regenerating video:", error);
      toast.error(error instanceof Error ? error.message : "Fehler bei der Video-Generierung");
    } finally {
      setIsRegeneratingVideo(null);
    }
  };

  const getArtistForContent = (artistId: string) => {
    return artists.find(a => a.id === artistId);
  };

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId);
  };

  const getStatusBadge = (content: SocialContent) => {
    switch (content.status) {
      case "scheduled":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Geplant</Badge>;
      case "publishing":
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Wird veröffentlicht</Badge>;
      case "published":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Veröffentlicht</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="h-3 w-3 mr-1" />Fehlgeschlagen</Badge>;
      default:
        return <Badge variant="secondary">Generiert</Badge>;
    }
  };

  // Calendar data
  const calendarDays = eachDayOfInterval({
    start: calendarWeekStart,
    end: addDays(calendarWeekStart, 6),
  });

  const getContentForDay = (date: Date) => {
    return generatedContent.filter(c => {
      if (c.scheduled_at) {
        return isSameDay(parseISO(c.scheduled_at), date);
      }
      if (c.published_at) {
        return isSameDay(parseISO(c.published_at), date);
      }
      return false;
    });
  };

  const scheduledContent = generatedContent.filter(c => c.status === "scheduled");
  const publishedContent = generatedContent.filter(c => c.status === "published");

  // Content Preview Dialog Component
  const ContentPreviewDialog = () => {
    if (!previewContent) return null;
    
    const artist = getArtistForContent(previewContent.artist_id);
    const platform = getPlatformInfo(previewContent.platform);
    const PlatformIcon = platform?.icon || Share2;
    
    return (
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Content Vorschau
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Platform & Type Header */}
            <div className="flex items-center gap-2">
              <PlatformIcon className={cn("h-5 w-5", platform?.color)} />
              <span className="font-medium">{platform?.name}</span>
              <Badge variant="outline">
                {previewContent.content_type === "reel" ? "Video" : previewContent.content_type}
              </Badge>
              {artist && (
                <span className="text-sm text-muted-foreground ml-auto">
                  von {artist.name}
                </span>
              )}
            </div>
            
            {/* Media Preview */}
            {(previewContent.image_url || previewContent.video_url) && (
              <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-muted">
                {previewContent.video_url ? (
                  <video
                    src={previewContent.video_url}
                    className="w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                  />
                ) : previewContent.image_url ? (
                  <img
                    src={previewContent.image_url}
                    alt={previewContent.title || "Generated content"}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
            )}
            
            {/* Text Content */}
            <div className="space-y-3">
              {previewContent.title && (
                <h3 className="font-semibold text-lg">{previewContent.title}</h3>
              )}
              
              {previewContent.caption && (
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {previewContent.caption}
                </p>
              )}
              
              {previewContent.hashtags && previewContent.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {previewContent.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              {(previewContent.image_url || previewContent.video_url) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadMedia(
                    previewContent.video_url || previewContent.image_url!,
                    `${artist?.name || 'content'}-${previewContent.content_type}.${previewContent.video_url ? 'mp4' : 'png'}`
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPreview(false);
                  setActiveTab("generator");
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Zur Bibliothek
              </Button>
              
              <Button
                variant="default"
                size="sm"
                className="ml-auto"
                onClick={() => setShowPreview(false)}
              >
                Schließen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader stats={stats} />
      
      {/* Content Preview Dialog */}
      <ContentPreviewDialog />

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container h-full py-3 md:py-6 px-3 md:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-3 h-9 md:h-10">
              <TabsTrigger value="generator" className="gap-1.5 text-xs md:text-sm">
                <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden xs:inline">Generator</span>
                <span className="xs:hidden">Gen</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5 text-xs md:text-sm">
                <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden xs:inline">Kalender</span>
                <span className="xs:hidden">Kal</span>
              </TabsTrigger>
              <TabsTrigger value="connections" className="gap-1.5 text-xs md:text-sm">
                <Link2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden xs:inline">Verbindungen</span>
                <span className="xs:hidden">Verb</span>
              </TabsTrigger>
            </TabsList>

            {/* Generator Tab */}
            <TabsContent value="generator" className="flex-1 min-h-0 mt-3 md:mt-6 overflow-hidden">
              <div className="flex flex-col lg:grid lg:grid-cols-[360px_1fr] gap-4 md:gap-6 h-full min-h-0">
                {/* Generator Panel */}
                <div className="lg:h-full lg:overflow-hidden shrink-0">
                  <ScrollArea className="h-full max-h-[45vh] lg:max-h-full">
                    <div className="space-y-4 md:space-y-6 pb-4 pr-2 md:pr-4">
                      <div className="hidden md:block">
                        <h2 className="text-base md:text-lg font-semibold mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                          Social Content Generator
                        </h2>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Generiere Social Media Content basierend auf deinen Künstlerprofilen.
                        </p>
                      </div>

                      {/* Artist Selection */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-medium">Künstler auswählen</label>
                        <Select value={selectedArtistId} onValueChange={setSelectedArtistId}>
                          <SelectTrigger className="h-9 md:h-10">
                            <SelectValue placeholder="Künstler wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {artists.map(artist => (
                              <SelectItem key={artist.id} value={artist.id}>
                                <div className="flex items-center gap-2">
                                  {artist.profile_image_url ? (
                                    <img 
                                      src={artist.profile_image_url} 
                                      alt={artist.name}
                                      className="h-5 w-5 md:h-6 md:w-6 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-5 w-5 md:h-6 md:w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                      <User className="h-2.5 w-2.5 md:h-3 md:w-3 text-primary" />
                                    </div>
                                  )}
                                  <span className="text-sm">{artist.name}</span>
                                  <span className="text-xs text-muted-foreground hidden sm:inline">({artist.genre})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Selected Artist Preview - Compact on mobile */}
                      {selectedArtist && (
                        <Card className="bg-muted/50">
                          <CardContent className="p-3 md:p-4">
                            <div className="flex items-start gap-2 md:gap-3">
                              {selectedArtist.profile_image_url ? (
                                <img 
                                  src={selectedArtist.profile_image_url} 
                                  alt={selectedArtist.name}
                                  className="h-12 w-12 md:h-16 md:w-16 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="h-12 w-12 md:h-16 md:w-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm md:text-base truncate">{selectedArtist.name}</h3>
                                <p className="text-[10px] md:text-xs text-muted-foreground truncate">{selectedArtist.genre} • {selectedArtist.style}</p>
                                <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-2 hidden sm:block">
                                  {selectedArtist.personality}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Platform Selection */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-medium">Plattform</label>
                        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                          {PLATFORMS.map(platform => {
                            const Icon = platform.icon;
                            const isConnected = platformConnections.some(c => c.platform === platform.id);
                            return (
                              <Button
                                key={platform.id}
                                variant={selectedPlatform === platform.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedPlatform(platform.id)}
                                className="gap-1 md:gap-1.5 relative h-8 md:h-9 px-2 md:px-3"
                              >
                                <Icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4 shrink-0", selectedPlatform !== platform.id && platform.color)} />
                                <span className="text-[10px] md:text-xs truncate">{platform.name}</span>
                                {isConnected && (
                                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Content Type Selection */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-medium">Content-Typ</label>
                        <div className="grid grid-cols-4 md:grid-cols-2 gap-1.5 md:gap-2">
                          {CONTENT_TYPES.map(type => {
                            const Icon = type.icon;
                            return (
                              <Button
                                key={type.id}
                                variant={selectedContentType === type.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedContentType(type.id)}
                                className="gap-1 md:gap-1.5 h-8 md:h-9 px-2 md:px-3"
                              >
                                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                                <span className="text-[10px] md:text-xs hidden xs:inline">{type.name}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Prompt */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-medium">Prompt (optional)</label>
                        <Textarea
                          placeholder="z.B. 'Neues Album', 'Behind the Scenes'..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>

                      {/* Scheduling */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          Planen (optional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={format(new Date(), "yyyy-MM-dd")}
                            className="h-9 text-sm"
                          />
                          <Input
                            type="time"
                            value={scheduledTime}
                            className="h-9 text-sm"
                            onChange={(e) => setScheduledTime(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Generate Button & Status */}
                      <div className="space-y-2 md:space-y-3">
                        <Button
                          variant="gold"
                          size="lg"
                          className="w-full h-10 md:h-11 text-sm md:text-base"
                          onClick={generateContent}
                          disabled={!selectedArtist || isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="truncate">Generiere...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {scheduledDate ? "Generieren & Planen" : "Content generieren"}
                              </span>
                            </>
                          )}
                        </Button>
                        
                        {/* Generation Status with Progress Bar */}
                        {isGenerating && (
                          <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="p-3 md:p-4">
                              <div className="space-y-3 md:space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin text-primary shrink-0" />
                                    <span className="text-xs md:text-sm font-medium text-primary truncate">
                                      {PHASE_LABELS[generationPhase]}
                                    </span>
                                  </div>
                                  {estimatedRemaining !== null && estimatedRemaining > 0 && (
                                    <span className="text-[10px] md:text-xs text-muted-foreground shrink-0">
                                      ~{formatTime(estimatedRemaining)}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="space-y-1.5">
                                  <Progress value={generationProgress} className="h-1.5 md:h-2" />
                                  <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground">
                                    <span>{Math.round(generationProgress)}%</span>
                                    {generationStartTime && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                        {formatTime((Date.now() - generationStartTime) / 1000)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Phase Progress Indicators - hidden on mobile */}
                                <div className="hidden sm:flex items-center gap-2">
                                  {(["text", "image", "video", "saving", "complete"] as GenerationPhase[]).map((phase, i) => {
                                    const phases: GenerationPhase[] = ["text", "image", "video", "saving", "complete"];
                                    const currentIndex = phases.indexOf(generationPhase);
                                    const phaseIndex = phases.indexOf(phase);
                                    const isCompleted = phaseIndex < currentIndex;
                                    const isCurrent = phase === generationPhase;
                                    
                                    // Skip irrelevant phases
                                    if (phase === "image" && selectedContentType === "reel") return null;
                                    if (phase === "video" && selectedContentType !== "reel") return null;
                                    if (phase === "image" && selectedContentType === "text") return null;
                                    if (phase === "video" && selectedContentType === "text") return null;
                                    
                                    return (
                                      <div key={phase} className="flex items-center gap-1">
                                        <div className={cn(
                                          "h-2 w-2 md:h-2.5 md:w-2.5 rounded-full transition-colors",
                                          isCompleted ? "bg-green-500" : 
                                          isCurrent ? "bg-primary animate-pulse" : 
                                          "bg-muted-foreground/30"
                                        )} />
                                        {i < phases.length - 1 && phase !== "complete" && (
                                          <div className={cn(
                                            "h-0.5 w-4 md:w-6 transition-colors",
                                            isCompleted ? "bg-green-500" : "bg-muted-foreground/30"
                                          )} />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                <p className="text-[10px] md:text-xs text-muted-foreground">
                                  {generationPhase === "text" && "KI erstellt Caption..."}
                                  {generationPhase === "image" && "KI generiert Bild..."}
                                  {generationPhase === "video" && "Video wird generiert..."}
                                  {generationPhase === "saving" && "Speichere..."}
                                  {generationPhase === "complete" && "Fertig!"}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </div>

                {/* Content Library */}
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-3 md:mb-4 shrink-0">
                    <h2 className="text-sm md:text-lg font-semibold flex items-center gap-2">
                      <Share2 className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                      <span className="truncate">Bibliothek ({generatedContent.length})</span>
                    </h2>
                    <Button variant="outline" size="sm" onClick={loadGeneratedContent} className="h-8 md:h-9 px-2 md:px-3">
                      <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden sm:inline ml-1.5">Aktualisieren</span>
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    {generatedContent.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                        <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl bg-secondary/50 flex items-center justify-center mb-3 md:mb-4">
                          <Share2 className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-base md:text-lg font-semibold mb-1">Noch kein Content</h3>
                        <p className="text-xs md:text-sm text-muted-foreground px-4">
                          Wähle einen Künstler und generiere Content.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:gap-4 pr-2 md:pr-4 pb-20 md:pb-4">
                        {generatedContent.map(content => {
                          const artist = getArtistForContent(content.artist_id);
                          const platform = getPlatformInfo(content.platform);
                          const PlatformIcon = platform?.icon || Share2;
                          const isConnected = platformConnections.some(c => c.platform === content.platform);
                          
                          return (
                            <Card key={content.id} className="overflow-hidden">
                              <CardHeader className="p-4 pb-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <PlatformIcon className={cn("h-4 w-4", platform?.color)} />
                                    <span className="text-sm font-medium">{platform?.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {content.content_type === "reel" ? "Video" : content.content_type}
                                    </Badge>
                                    {getStatusBadge(content)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {/* Share Button */}
                                    {content.status === "generated" && isConnected && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-primary"
                                        onClick={() => publishContent(content.id, content.platform)}
                                        disabled={isPublishing === content.id}
                                        title="Teilen"
                                      >
                                        {isPublishing === content.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Send className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    {content.status === "generated" && !isConnected && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground"
                                        onClick={() => setActiveTab("connections")}
                                        title="Verbindung erforderlich"
                                      >
                                        <Share2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {(content.image_url || content.video_url) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => downloadMedia(
                                          content.video_url || content.image_url!,
                                          `${artist?.name || 'content'}-${content.content_type}.${content.video_url ? 'mp4' : 'png'}`
                                        )}
                                        title="Download"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {/* Regenerate Video Button - for reels without video */}
                                    {content.content_type === "reel" && !content.video_url && content.image_url && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-primary"
                                        onClick={() => regenerateVideo(content)}
                                        disabled={isRegeneratingVideo === content.id}
                                        title="Video neu generieren"
                                      >
                                        {isRegeneratingVideo === content.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    {content.published_url && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => window.open(content.published_url, "_blank")}
                                        title="Öffnen"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => deleteContent(content.id)}
                                      title="Löschen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="p-4 pt-2">
                                <div className="flex gap-2 md:gap-4">
                                  {(content.image_url || content.video_url) && (
                                    <div className="relative w-20 h-20 md:w-32 md:h-32 shrink-0">
                                      {content.video_url ? (
                                        <video
                                          src={content.video_url}
                                          className="w-full h-full rounded-lg object-cover"
                                          controls
                                          muted
                                        />
                                      ) : (
                                        <img
                                          src={content.image_url}
                                          alt={content.title || "Generated content"}
                                          className="w-full h-full rounded-lg object-cover"
                                        />
                                      )}
                                      {content.content_type === "reel" && !content.video_url && (
                                        <div className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-0.5 md:gap-1 bg-background/70 backdrop-blur-sm">
                                          <ImageIcon className="h-5 w-5 md:h-7 md:w-7 text-foreground" />
                                          <span className="text-[9px] md:text-[11px] font-medium text-foreground">
                                            Cover
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    {content.title && (
                                      <h4 className="font-medium text-sm mb-1">{content.title}</h4>
                                    )}
                                    {content.caption && (
                                      <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                                        {content.caption}
                                      </p>
                                    )}
                                    {content.hashtags && content.hashtags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {content.hashtags.slice(0, 5).map((tag, i) => (
                                          <Badge key={i} variant="secondary" className="text-xs">
                                            #{tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                      {artist && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {artist.name}
                                        </span>
                                      )}
                                      <span>
                                        {format(new Date(content.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                      </span>
                                      {content.scheduled_at && (
                                        <span className="flex items-center gap-1 text-yellow-600">
                                          <Clock className="h-3 w-3" />
                                          {format(parseISO(content.scheduled_at), "dd.MM. HH:mm", { locale: de })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Calendar Tab */}
            <TabsContent value="calendar" className="flex-1 min-h-0 mt-3 md:mt-6 overflow-hidden">
              <div className="h-full flex flex-col min-h-0 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 md:mb-4 shrink-0">
                  <h2 className="text-sm md:text-lg font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                    Content Kalender
                  </h2>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, -7))}
                      className="h-7 md:h-9 px-2 md:px-3 text-xs md:text-sm"
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCalendarWeekStart(startOfWeek(new Date(), { locale: de }))}
                      className="h-7 md:h-9 px-2 md:px-3 text-xs md:text-sm"
                    >
                      Heute
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, 7))}
                      className="h-7 md:h-9 px-2 md:px-3 text-xs md:text-sm"
                    >
                      →
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-4 shrink-0">
                  <Card>
                    <CardContent className="p-2 md:p-4 flex items-center gap-2 md:gap-3">
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg md:text-2xl font-bold">{scheduledContent.length}</p>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">Geplant</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-2 md:p-4 flex items-center gap-2 md:gap-3">
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg md:text-2xl font-bold">{publishedContent.length}</p>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">Veröffentlicht</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-2 md:p-4 flex items-center gap-2 md:gap-3">
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Share2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg md:text-2xl font-bold">{generatedContent.length}</p>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">Gesamt</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Calendar Grid - Horizontal scroll on mobile */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="grid grid-cols-7 gap-1 md:gap-2 pr-2 md:pr-4 pb-20 md:pb-4 min-w-[500px] md:min-w-0">
                    {calendarDays.map((day, i) => {
                      const dayContent = getContentForDay(day);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <div
                          key={i}
                          className={cn(
                            "min-h-[120px] md:min-h-[200px] p-1.5 md:p-2 rounded-lg border",
                            isToday ? "border-primary bg-primary/5" : "border-border"
                          )}
                        >
                          <div className="text-center mb-1.5 md:mb-2">
                            <p className="text-[10px] md:text-xs text-muted-foreground">
                              {format(day, "EEE", { locale: de })}
                            </p>
                            <p className={cn(
                              "text-sm md:text-lg font-semibold",
                              isToday && "text-primary"
                            )}>
                              {format(day, "d")}
                            </p>
                          </div>
                          <div className="space-y-1">
                            {dayContent.slice(0, 3).map(content => {
                              const platform = getPlatformInfo(content.platform);
                              const PlatformIcon = platform?.icon || Share2;
                              
                              return (
                                <div
                                  key={content.id}
                                  className={cn(
                                    "p-1 md:p-2 rounded text-[10px] md:text-xs cursor-pointer hover:opacity-80 transition-opacity",
                                    platform?.bgColor
                                  )}
                                  title={content.title || content.caption}
                                >
                                  <div className="flex items-center gap-0.5 md:gap-1">
                                    <PlatformIcon className={cn("h-2.5 w-2.5 md:h-3 md:w-3 shrink-0", platform?.color)} />
                                    <span className="truncate flex-1">{content.title || "Content"}</span>
                                  </div>
                                  {content.scheduled_at && (
                                    <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5">
                                      {format(parseISO(content.scheduled_at), "HH:mm")}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                            {dayContent.length > 3 && (
                              <p className="text-[9px] md:text-[10px] text-muted-foreground text-center">
                                +{dayContent.length - 3}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="connections" className="flex-1 min-h-0 mt-6 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="max-w-2xl pr-4 pb-4">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    Plattform-Verbindungen
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Verbinde deine Social Media Konten, um Content direkt zu veröffentlichen.
                  </p>
                </div>

                <div className="grid gap-4">
                  {PLATFORMS.map(platform => {
                    const Icon = platform.icon;
                    const connection = platformConnections.find(c => c.platform === platform.id);
                    
                    return (
                      <Card key={platform.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", platform.bgColor)}>
                                <Icon className={cn("h-5 w-5", platform.color)} />
                              </div>
                              <div>
                                <h3 className="font-medium">{platform.name}</h3>
                                {connection ? (
                                  <p className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Verbunden{connection.platform_username ? ` als @${connection.platform_username}` : ""}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Nicht verbunden</p>
                                )}
                              </div>
                            </div>
                            <div>
                              {connection ? (
                                <Button variant="outline" size="sm" className="text-destructive">
                                  Trennen
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm">
                                  Verbinden
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {!connection && (
                            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                              {platform.id === "instagram" && "Benötigt einen Instagram Business Account und Facebook-Seite."}
                              {platform.id === "twitter" && "Benötigt Twitter/X API Zugang (Developer Account)."}
                              {platform.id === "facebook" && "Benötigt eine Facebook-Seite mit Admin-Rechten."}
                              {platform.id === "linkedin" && "Benötigt LinkedIn API Zugang."}
                              {platform.id === "youtube" && "Benötigt YouTube API Zugang und Channel."}
                              {platform.id === "tiktok" && "Benötigt TikTok Developer Account."}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    API-Zugangsdaten erforderlich
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Für die direkte Veröffentlichung auf Social Media Plattformen werden API-Zugangsdaten benötigt. 
                    Diese erhältst du über die jeweiligen Developer-Portale der Plattformen.
                  </p>
                </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SocialTools;
