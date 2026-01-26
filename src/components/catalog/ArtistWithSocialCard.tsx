import { memo, useState, useEffect } from "react";
import { ChevronDown, ChevronRight, User, Image as ImageIcon, Video, Instagram, Twitter, Linkedin, Play, Pause, ExternalLink, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ArtistManagementDialog } from "@/components/ArtistManagementDialog";
import { ArtistAlbumsSection } from "@/components/catalog/ArtistAlbumsSection";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SocialContent {
  id: string;
  title: string | null;
  caption: string | null;
  platform: string;
  content_type: string;
  status: string | null;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
}

interface Song {
  id: string;
  name: string;
  track_number?: number;
  bpm?: number;
  tonart?: string;
  audio_url?: string | null;
  generation_status?: string | null;
}

interface Album {
  id: string;
  name: string;
  release_date?: string;
  songs: Song[];
}

interface ArtistData {
  id: string;
  name: string;
  genre: string;
  style: string;
  language?: string;
  profile_image_url?: string;
  personality?: string;
  voice_prompt?: string;
  katalognummer?: string;
  albums: Album[];
}

const LANGUAGE_FLAGS: Record<string, { flag: string; name: string }> = {
  de: { flag: "🇩🇪", name: "Deutsch" },
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Español" },
  fr: { flag: "🇫🇷", name: "Français" },
  it: { flag: "🇮🇹", name: "Italiano" },
  pt: { flag: "🇧🇷", name: "Português" },
  ja: { flag: "🇯🇵", name: "日本語" },
  ko: { flag: "🇰🇷", name: "한국어" },
  zh: { flag: "🇨🇳", name: "中文" },
};

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  tiktok: Video,
  twitter: Twitter,
  linkedin: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-400",
  tiktok: "bg-cyan-500/20 text-cyan-400",
  twitter: "bg-blue-500/20 text-blue-400",
  linkedin: "bg-blue-600/20 text-blue-300",
};

interface ArtistWithSocialCardProps {
  artist: ArtistData;
  onDelete?: (artistId: string) => void;
  onRefresh?: () => void;
}

export const ArtistWithSocialCard = memo(({ artist, onDelete, onRefresh }: ArtistWithSocialCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [socialContent, setSocialContent] = useState<SocialContent[]>([]);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [managementDialogOpen, setManagementDialogOpen] = useState(false);

  const langInfo = artist.language ? LANGUAGE_FLAGS[artist.language] : null;
  const totalSongs = artist.albums.reduce((acc, album) => acc + album.songs.length, 0);

  useEffect(() => {
    if (isExpanded && socialContent.length === 0) {
      loadSocialContent();
    }
  }, [isExpanded]);

  const loadSocialContent = async () => {
    setIsLoadingSocial(true);
    try {
      const { data, error } = await supabase
        .from("social_content")
        .select("*")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setSocialContent(data);
      }
    } catch (error) {
      console.error("Error loading social content:", error);
    } finally {
      setIsLoadingSocial(false);
    }
  };

  const toggleVideo = (videoUrl: string) => {
    if (playingVideo === videoUrl) {
      setPlayingVideo(null);
    } else {
      setPlayingVideo(videoUrl);
    }
  };

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden bg-card/50 hover:bg-card/80 transition-colors">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4 transition-colors text-left"
        >
          <div className={cn(
            "transition-transform duration-200 shrink-0",
            isExpanded && "rotate-90"
          )}>
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </div>
          
          {/* Profile Image */}
          {artist.profile_image_url ? (
            <img 
              src={artist.profile_image_url} 
              alt={artist.name}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover ring-2 ring-border shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-border shrink-0">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-sm sm:text-base truncate">{artist.name}</span>
              {langInfo && (
                <span title={langInfo.name} className="shrink-0 text-sm">
                  {langInfo.flag}
                </span>
              )}
              {artist.katalognummer && (
                <span className="text-[10px] sm:text-xs text-muted-foreground font-mono shrink-0 hidden sm:inline">
                  {artist.katalognummer}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] sm:text-xs bg-primary/20 text-primary px-1.5 sm:px-2">
                {artist.genre}
              </Badge>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:inline">
                {artist.style}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                • {artist.albums.length} Alben • {totalSongs} Songs
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setManagementDialogOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Verwalten</TooltipContent>
            </Tooltip>
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hidden sm:flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(artist.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Löschen</TooltipContent>
              </Tooltip>
            )}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-border bg-muted/20 p-3 sm:p-4 space-y-4 sm:space-y-6 animate-in slide-in-from-top-2 duration-200">
            {/* Social Content Section */}
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
                <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Social Media Inhalte
                {socialContent.length > 0 && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                    {socialContent.length}
                  </Badge>
                )}
              </h4>

              {isLoadingSocial ? (
                <div className="text-xs sm:text-sm text-muted-foreground py-4 text-center">
                  Lade Inhalte...
                </div>
              ) : socialContent.length === 0 ? (
                <div className="text-xs sm:text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                  Keine Social Media Inhalte vorhanden
                </div>
              ) : (
                <div className="grid gap-2 sm:gap-3 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3">
                  {socialContent.map((content) => {
                    const PlatformIcon = PLATFORM_ICONS[content.platform] || Video;
                    const platformColor = PLATFORM_COLORS[content.platform] || "bg-muted text-muted-foreground";
                    
                    return (
                      <div 
                        key={content.id}
                        className="border border-border rounded-lg overflow-hidden bg-card/50"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video bg-muted relative">
                          {content.image_url ? (
                            <img 
                              src={content.image_url} 
                              alt={content.title || "Content"} 
                              className="w-full h-full object-cover"
                            />
                          ) : content.video_url ? (
                            playingVideo === content.video_url ? (
                              <video 
                                src={content.video_url} 
                                className="w-full h-full object-cover"
                                autoPlay
                                controls
                                onEnded={() => setPlayingVideo(null)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                <Video className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          
                          {/* Play Button Overlay */}
                          {content.video_url && playingVideo !== content.video_url && (
                            <button
                              onClick={() => toggleVideo(content.video_url!)}
                              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                            >
                              <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center">
                                <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                              </div>
                            </button>
                          )}

                          {/* Platform Badge */}
                          <div className={cn(
                            "absolute top-2 right-2 px-2 py-1 rounded-full text-xs flex items-center gap-1",
                            platformColor
                          )}>
                            <PlatformIcon className="h-3 w-3" />
                            <span className="capitalize">{content.platform}</span>
                          </div>
                        </div>

                        {/* Content Info */}
                        <div className="p-2.5 sm:p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium truncate">
                                {content.title || "Ohne Titel"}
                              </p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                                {content.content_type} • {content.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Albums & Songs Section */}
            <ArtistAlbumsSection
              artistId={artist.id}
              artistName={artist.name}
              artistImageUrl={artist.profile_image_url}
              genre={artist.genre}
              style={artist.style}
              voicePrompt={artist.voice_prompt || ""}
              personality={artist.personality || ""}
              albums={artist.albums}
              onRefresh={onRefresh}
            />
          </div>
        )}
      </div>

      {/* Management Dialog */}
      <ArtistManagementDialog
        open={managementDialogOpen}
        onOpenChange={setManagementDialogOpen}
        artistId={artist.id}
        onSaved={() => {
          onRefresh?.();
          loadSocialContent();
        }}
      />
    </>
  );
});

ArtistWithSocialCard.displayName = "ArtistWithSocialCard";
