import { useMemo, useState, useCallback } from "react";
import {
  Search, Play, Pause, Shuffle, Music, User, ChevronDown, ChevronRight, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
type SongItem = { song: Song; artist: ArtistWithAlbums; albumName: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toTrack(item: SongItem) {
  return {
    id: item.song.id,
    title: item.song.name,
    artist: item.artist.name,
    album: item.albumName,
    audioUrl: item.song.audio_url!,
    coverUrl: item.artist.profile_image_url,
    artistImageUrl: item.artist.profile_image_url,
    songId: item.song.id,
    artistId: item.artist.id,
  };
}

// ─── Genre pill ──────────────────────────────────────────────────────────────
const GENRE_COLORS: Record<string, string> = {
  "Pop": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "Rock": "bg-red-500/20 text-red-400 border-red-500/30",
  "Hip-Hop": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Jazz": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Classical": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Electronica": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Techno": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Soul": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "R&B": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "Reggae": "bg-green-500/20 text-green-400 border-green-500/30",
  "Americana": "bg-stone-500/20 text-stone-400 border-stone-500/30",
  "Chamber Folk": "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

function genreColor(genre: string) {
  return GENRE_COLORS[genre] ?? "bg-primary/10 text-primary border-primary/20";
}

// ─── Song Row ─────────────────────────────────────────────────────────────────
function SongRow({
  item,
  index,
  onPlay,
  isCurrentlyPlaying,
}: {
  item: SongItem;
  index: number;
  onPlay: () => void;
  isCurrentlyPlaying: boolean;
}) {
  return (
    <button
      onClick={onPlay}
      className={cn(
        "group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
        "hover:bg-muted/60",
        isCurrentlyPlaying && "bg-primary/8"
      )}
    >
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        <span className={cn("text-xs tabular-nums text-muted-foreground group-hover:hidden", isCurrentlyPlaying && "hidden")}>
          {index + 1}
        </span>
        <Play className={cn("h-3 w-3 text-primary hidden group-hover:block", isCurrentlyPlaying && "!block")} fill="currentColor" />
      </div>
      <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden bg-muted/50">
        {item.artist.profile_image_url ? (
          <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", isCurrentlyPlaying && "text-primary")}>{item.song.name}</p>
        <p className="text-xs text-muted-foreground truncate">{item.albumName}</p>
      </div>
    </button>
  );
}

// ─── Artist Panel ─────────────────────────────────────────────────────────────
function ArtistPanel({
  artist,
  songs,
  isExpanded,
  onToggle,
  onPlayArtist,
  onPlaySong,
  currentTrackId,
  isPlaying,
}: {
  artist: ArtistWithAlbums;
  songs: SongItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onPlayArtist: () => void;
  onPlaySong: (item: SongItem) => void;
  currentTrackId: string | null;
  isPlaying: boolean;
}) {
  const isArtistPlaying = isPlaying && songs.some(s => s.song.id === currentTrackId);

  return (
    <div className={cn(
      "rounded-2xl border border-border/60 overflow-hidden transition-all duration-300",
      "bg-card/40 hover:bg-card/60",
      isExpanded && "border-border bg-card/60"
    )}>
      {/* Artist Header */}
      <div className="flex items-center gap-4 p-4">
        {/* Image */}
        <button onClick={onToggle} className="flex-shrink-0 relative group">
          <div className="w-16 h-16 rounded-xl overflow-hidden ring-2 ring-border">
            {artist.profile_image_url ? (
              <img
                src={artist.profile_image_url}
                alt={artist.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <User className="h-6 w-6 text-primary/50" />
              </div>
            )}
          </div>
        </button>

        {/* Info */}
        <button onClick={onToggle} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base truncate">{artist.name}</span>
            {artist.language && (
              <span className="text-sm shrink-0">
                {{ de: "🇩🇪", en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", it: "🇮🇹", pt: "🇵🇹", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳" }[artist.language] ?? ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", genreColor(artist.genre))}>
              {artist.genre}
            </span>
            <span className="text-xs text-muted-foreground">{songs.length} Titel</span>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {songs.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full transition-all",
                isArtistPlaying
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-primary/10 hover:text-primary"
              )}
              onClick={(e) => { e.stopPropagation(); onPlayArtist(); }}
            >
              {isArtistPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4" fill="currentColor" />
              )}
            </Button>
          )}
          <button
            onClick={onToggle}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Songs List */}
      {isExpanded && songs.length > 0 && (
        <div className="border-t border-border/40 px-2 pb-3 pt-2 bg-muted/20 animate-in slide-in-from-top-2 duration-200">
          {songs.map((item, i) => (
            <SongRow
              key={item.song.id}
              item={item}
              index={i}
              onPlay={() => onPlaySong(item)}
              isCurrentlyPlaying={currentTrackId === item.song.id && isPlaying}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KuenstlerSongs() {
  const { artists, stats, isLoading } = useCatalogData();
  const { play, currentTrack, isPlaying, pause, resume, addToQueue, clearQueue } = useAudioPlayer();
  const playerHeight = usePlayerHeight();

  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());

  const allSongsWithAudio = useMemo<SongItem[]>(() => {
    const items: SongItem[] = [];
    artists.forEach(artist =>
      artist.albums.forEach(album =>
        album.songs.forEach(song => {
          if (song.audio_url) items.push({ song, artist, albumName: album.name });
        })
      )
    );
    return items;
  }, [artists]);

  // All genres
  const genres = useMemo(() => {
    const set = new Set<string>();
    artists.forEach(a => set.add(a.genre));
    return Array.from(set).sort();
  }, [artists]);

  // Filtered artists
  const filteredArtists = useMemo(() => {
    return artists.filter(artist => {
      const matchesGenre = !activeGenre || artist.genre === activeGenre;
      const matchesSearch = !search ||
        artist.name.toLowerCase().includes(search.toLowerCase()) ||
        artist.genre.toLowerCase().includes(search.toLowerCase()) ||
        artist.style.toLowerCase().includes(search.toLowerCase());
      return matchesGenre && matchesSearch;
    });
  }, [artists, search, activeGenre]);

  const getSongsForArtist = useCallback((artist: ArtistWithAlbums) =>
    allSongsWithAudio.filter(s => s.artist.id === artist.id),
  [allSongsWithAudio]);

  const playQueue = useCallback((items: SongItem[]) => {
    if (!items.length) return;
    clearQueue();
    play(toTrack(items[0]));
    items.slice(1).forEach(i => addToQueue(toTrack(i)));
  }, [play, clearQueue, addToQueue]);

  const handlePlayArtist = useCallback((artist: ArtistWithAlbums) => {
    const songs = shuffle(getSongsForArtist(artist));
    playQueue(songs);
  }, [getSongsForArtist, playQueue]);

  const handlePlaySong = useCallback((item: SongItem) => {
    if (!item.song.audio_url) return;
    if (currentTrack?.id === item.song.id) {
      isPlaying ? pause() : resume();
    } else {
      play(toTrack(item));
    }
  }, [currentTrack, isPlaying, pause, resume, play]);

  const handleShuffleAll = () => {
    const visible = filteredArtists.flatMap(a => getSongsForArtist(a));
    playQueue(shuffle(visible));
  };

  const toggleArtist = (id: string) => {
    setExpandedArtists(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader stats={stats} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Musik wird geladen...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader stats={stats} />
      <ScrollArea className="flex-1">
        <div
          className="max-w-3xl mx-auto px-4 md:px-6 py-6"
          style={{ paddingBottom: Math.max(playerHeight + 24, 32) }}
        >
          {/* Page Header */}
          <div className="mb-6">
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              KI-Musik Katalog
            </p>
            <h1 className="font-display text-2xl md:text-3xl font-bold mb-1">
              Künstler & Songs
            </h1>
            <p className="text-muted-foreground text-sm">
              {stats.artists} Künstler · {allSongsWithAudio.length} Titel
            </p>
          </div>

          {/* Search + Shuffle */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Künstler, Genre oder Stil suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-muted/30 border-border/60 focus:bg-background"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              onClick={handleShuffleAll}
              title="Alle mischen"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>

          {/* Genre Filter Pills */}
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => setActiveGenre(null)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-all",
                !activeGenre
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 border-border/60 text-muted-foreground hover:border-border"
              )}
            >
              Alle
            </button>
            {genres.map(genre => (
              <button
                key={genre}
                onClick={() => setActiveGenre(prev => prev === genre ? null : genre)}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-full border transition-all",
                  activeGenre === genre
                    ? "bg-primary text-primary-foreground border-primary"
                    : cn("hover:border-border", genreColor(genre))
                )}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Artist List */}
          {filteredArtists.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Music className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Keine Ergebnisse für „{search}"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArtists.map(artist => (
                <ArtistPanel
                  key={artist.id}
                  artist={artist}
                  songs={getSongsForArtist(artist)}
                  isExpanded={expandedArtists.has(artist.id)}
                  onToggle={() => toggleArtist(artist.id)}
                  onPlayArtist={() => handlePlayArtist(artist)}
                  onPlaySong={handlePlaySong}
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
