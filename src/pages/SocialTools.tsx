import { useState, useEffect } from "react";
import { 
  Share2, User, Sparkles, Instagram, Twitter, Facebook, Linkedin, 
  Youtube, Music2, Download, Trash2, RefreshCw, Image as ImageIcon,
  FileText, Video, MessageSquare, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  created_at: string;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-500" },
  { id: "tiktok", name: "TikTok", icon: Music2, color: "text-black dark:text-white" },
  { id: "youtube", name: "YouTube", icon: Youtube, color: "text-red-500" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "text-blue-600" },
  { id: "twitter", name: "Twitter/X", icon: Twitter, color: "text-sky-500" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
];

const CONTENT_TYPES = [
  { id: "post", name: "Post", icon: ImageIcon },
  { id: "story", name: "Story", icon: MessageSquare },
  { id: "reel", name: "Reel/Video", icon: Video },
  { id: "text", name: "Text/Caption", icon: FileText },
];

type GenerationPhase = "idle" | "text" | "image" | "saving" | "complete";

const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: "",
  text: "Erstelle Caption & Hashtags...",
  image: "Generiere Bild...",
  saving: "Speichere Content...",
  complete: "Fertig!",
};

const SocialTools = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [selectedContentType, setSelectedContentType] = useState<string>("post");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const [generatedContent, setGeneratedContent] = useState<SocialContent[]>([]);
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0 });

  useEffect(() => {
    loadArtists();
    loadStats();
    loadGeneratedContent();
  }, []);

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

  const selectedArtist = artists.find(a => a.id === selectedArtistId);

  const generateContent = async () => {
    if (!selectedArtist) {
      toast.error("Bitte wähle einen Künstler aus");
      return;
    }

    setIsGenerating(true);
    setGenerationPhase("text");
    
    try {
      // Simulate phase progression for better UX
      const phaseTimeout = setTimeout(() => {
        if (selectedContentType === "post" || selectedContentType === "story") {
          setGenerationPhase("image");
        }
      }, 3000);

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
          }),
        }
      );

      clearTimeout(phaseTimeout);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler bei der Generierung");
      }

      setGenerationPhase("saving");
      const data = await response.json();
      setGenerationPhase("complete");
      
      toast.success("Content erfolgreich generiert!");
      await loadGeneratedContent();
      
      // Reset phase after short delay
      setTimeout(() => setGenerationPhase("idle"), 1500);
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error(error instanceof Error ? error.message : "Fehler bei der Generierung");
      setGenerationPhase("idle");
    } finally {
      setIsGenerating(false);
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

  const downloadImage = async (url: string, filename: string) => {
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

  const getArtistForContent = (artistId: string) => {
    return artists.find(a => a.id === artistId);
  };

  const getPlatformIcon = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    return platform ? platform.icon : Share2;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader stats={stats} />

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container h-full py-6">
          <div className="grid lg:grid-cols-[400px_1fr] gap-6 h-full">
            {/* Generator Panel */}
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6 pb-4">
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Social Content Generator
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Generiere Social Media Content basierend auf deinen Künstlerprofilen.
                  </p>
                </div>

                {/* Artist Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Künstler auswählen</label>
                  <Select value={selectedArtistId} onValueChange={setSelectedArtistId}>
                    <SelectTrigger>
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
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-3 w-3 text-primary" />
                              </div>
                            )}
                            <span>{artist.name}</span>
                            <span className="text-xs text-muted-foreground">({artist.genre})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Artist Preview */}
                {selectedArtist && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {selectedArtist.profile_image_url ? (
                          <img 
                            src={selectedArtist.profile_image_url} 
                            alt={selectedArtist.name}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium">{selectedArtist.name}</h3>
                          <p className="text-xs text-muted-foreground">{selectedArtist.genre} • {selectedArtist.style}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {selectedArtist.personality}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Platform Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plattform</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PLATFORMS.map(platform => {
                      const Icon = platform.icon;
                      return (
                        <Button
                          key={platform.id}
                          variant={selectedPlatform === platform.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedPlatform(platform.id)}
                          className="gap-1.5"
                        >
                          <Icon className={cn("h-4 w-4", selectedPlatform !== platform.id && platform.color)} />
                          <span className="text-xs">{platform.name}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Content Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content-Typ</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONTENT_TYPES.map(type => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.id}
                          variant={selectedContentType === type.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedContentType(type.id)}
                          className="gap-1.5"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-xs">{type.name}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Prompt */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zusätzlicher Prompt (optional)</label>
                  <Textarea
                    placeholder="z.B. 'Neues Album Ankündigung', 'Behind the Scenes', 'Tour Dates'..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Generate Button & Status */}
                <div className="space-y-3">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full"
                    onClick={generateContent}
                    disabled={!selectedArtist || isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generiere...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Content generieren
                      </>
                    )}
                  </Button>
                  
                  {/* Generation Status */}
                  {isGenerating && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm font-medium text-primary">
                              {PHASE_LABELS[generationPhase]}
                            </span>
                          </div>
                          
                          {/* Phase Progress */}
                          <div className="flex items-center gap-2">
                            {(["text", "image", "saving", "complete"] as GenerationPhase[]).map((phase, i) => {
                              const phases: GenerationPhase[] = ["text", "image", "saving", "complete"];
                              const currentIndex = phases.indexOf(generationPhase);
                              const phaseIndex = phases.indexOf(phase);
                              const isCompleted = phaseIndex < currentIndex;
                              const isCurrent = phase === generationPhase;
                              
                              // Skip image phase for text-only content
                              if (phase === "image" && (selectedContentType === "text" || selectedContentType === "reel")) {
                                return null;
                              }
                              
                              return (
                                <div key={phase} className="flex items-center gap-1">
                                  <div className={cn(
                                    "h-2 w-2 rounded-full transition-colors",
                                    isCompleted ? "bg-green-500" : 
                                    isCurrent ? "bg-primary animate-pulse" : 
                                    "bg-muted-foreground/30"
                                  )} />
                                  {i < phases.length - 1 && phase !== "image" && (
                                    <div className={cn(
                                      "h-0.5 w-6 transition-colors",
                                      isCompleted ? "bg-green-500" : "bg-muted-foreground/30"
                                    )} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            {generationPhase === "text" && "KI erstellt Caption und Hashtags basierend auf dem Künstlerprofil..."}
                            {generationPhase === "image" && "KI generiert ein passendes Bild für deinen Content..."}
                            {generationPhase === "saving" && "Speichere Content in der Bibliothek..."}
                            {generationPhase === "complete" && "Content wurde erfolgreich erstellt!"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Content Library */}
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  Content Bibliothek ({generatedContent.length})
                </h2>
                <Button variant="outline" size="sm" onClick={loadGeneratedContent}>
                  <RefreshCw className="h-4 w-4" />
                  Aktualisieren
                </Button>
              </div>

              <ScrollArea className="flex-1">
                {generatedContent.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 rounded-xl bg-secondary/50 flex items-center justify-center mb-4">
                      <Share2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Noch kein Content</h3>
                    <p className="text-sm text-muted-foreground">
                      Wähle einen Künstler und generiere deinen ersten Social Media Content.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 pr-4 pb-4">
                    {generatedContent.map(content => {
                      const artist = getArtistForContent(content.artist_id);
                      const PlatformIcon = getPlatformIcon(content.platform);
                      const platform = PLATFORMS.find(p => p.id === content.platform);
                      
                      return (
                        <Card key={content.id} className="overflow-hidden">
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <PlatformIcon className={cn("h-4 w-4", platform?.color)} />
                                <span className="text-sm font-medium">{platform?.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {content.content_type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                {content.image_url && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => downloadImage(content.image_url!, `${artist?.name || 'content'}-${content.content_type}.png`)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => deleteContent(content.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-2">
                            <div className="flex gap-4">
                              {content.image_url && (
                                <img
                                  src={content.image_url}
                                  alt={content.title || "Generated content"}
                                  className="w-32 h-32 rounded-lg object-cover shrink-0"
                                />
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
                                    {new Date(content.created_at).toLocaleDateString("de-DE")}
                                  </span>
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
        </div>
      </main>
    </div>
  );
};

export default SocialTools;
