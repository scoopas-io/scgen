import { useMemo, useState } from "react";
import { 
  Play, Pause, Music, Shuffle, Sparkles, ListPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCatalogData, type ArtistWithAlbums, type Song } from "@/hooks/useCatalogData";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/AppHeader";

// ─── Helpers ───────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type SongItem = { song: Song; artist: ArtistWithAlbums; albumName: string };

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

// ─── Featured Hero ──────────────────────────────────────────────────────────
function FeaturedHero({
  artist,
  songs,
  onPlay,
  isPlayingArtist,
}: {
  artist: ArtistWithAlbums;
  songs: SongItem[];
  onPlay: (items: SongItem[]) => void;
  isPlayingArtist: boolean;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[200px] sm:min-h-[260px] md:min-h-[320px] flex items-end h-full">
      <div className="absolute inset-0">
        {artist.profile_image_url ? (
          <img src={artist.profile_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      </div>
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
        <Badge className="gap-1 sm:gap-1.5 bg-primary/90 text-primary-foreground border-0 text-[10px] sm:text-xs px-2 sm:px-2.5">
          <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          KI-Künstler des Tages
        </Badge>
      </div>
      <div className="relative p-4 sm:p-5 md:p-8 w-full">
        <p className="text-white/70 text-[10px] sm:text-xs uppercase tracking-widest mb-1">{artist.genre}</p>
        <h2 className="text-white text-xl sm:text-3xl md:text-5xl font-display font-bold mb-1 leading-tight">{artist.name}</h2>
        <p className="text-white/60 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-1">{artist.style}</p>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            className="rounded-full gap-1.5 sm:gap-2 font-semibold h-9 sm:h-12 px-4 sm:px-6 text-sm"
            onClick={() => onPlay(songs)}
          >
            {isPlayingArtist
              ? <><Pause className="h-4 w-4" fill="currentColor" /> Pause</>
              : <><Play className="h-4 w-4" fill="currentColor" /> Abspielen</>}
          </Button>
          <span className="text-white/50 text-xs sm:text-sm">{songs.length} Titel</span>
        </div>
      </div>
    </div>
  );
}

// ─── Artist Card (horizontal scroll) ────────────────────────────────────────
function ArtistCard({
  artist,
  songCount,
  onPlay,
  onAddToQueue,
}: {
  artist: ArtistWithAlbums;
  songCount: number;
  onPlay: () => void;
  onAddToQueue: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="group flex-shrink-0 w-32 sm:w-40 md:w-48 text-left focus:outline-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative rounded-xl overflow-hidden aspect-square bg-muted/40 mb-2">
        {artist.profile_image_url ? (
          <img
            src={artist.profile_image_url}
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Music className="h-8 w-8 sm:h-10 sm:w-10 text-primary/40" />
          </div>
        )}
        {/* Hover overlay on desktop; always-visible controls on mobile */}
        <div className={cn(
          "absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity duration-200",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        )}>
          <button
            onClick={onPlay}
            className="bg-primary rounded-full p-2.5 sm:p-3 shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform"
          >
            <Play className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" fill="currentColor" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToQueue(); }}
            className="bg-white/20 hover:bg-white/30 rounded-full p-2 sm:p-2.5 shadow transition-all active:scale-95"
            title="Zur Warteschlange hinzufügen"
          >
            <ListPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
          </button>
        </div>
      </div>
      <p className="text-xs sm:text-sm font-semibold truncate">{artist.name}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{artist.genre} · {songCount} Titel</p>
    </div>
  );
}

// ─── Song Row ────────────────────────────────────────────────────────────────
function SongRow({
  item,
  index,
  onPlay,
  isPlaying,
  onAddToQueue,
}: {
  item: SongItem;
  index: number;
  onPlay: () => void;
  isPlaying: boolean;
  onAddToQueue: () => void;
}) {
  return (
    <div className={cn(
      "group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 rounded-lg transition-colors",
      "hover:bg-muted/60 active:bg-muted/80",
      isPlaying && "bg-primary/10"
    )}>
      {/* Index / Play indicator */}
      <button onClick={onPlay} className="w-5 sm:w-6 flex-shrink-0 flex items-center justify-center">
        <span className={cn("text-xs sm:text-sm tabular-nums text-muted-foreground group-hover:hidden", isPlaying && "hidden")}>
          {index + 1}
        </span>
        <Play className={cn("h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary hidden group-hover:block", isPlaying && "!block")} fill="currentColor" />
      </button>
      {/* Cover */}
      <button onClick={onPlay} className="w-8 h-8 sm:w-9 sm:h-9 rounded-md overflow-hidden flex-shrink-0 bg-muted/50">
        {item.artist.profile_image_url ? (
          <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="h-3.5 w-4 text-muted-foreground" />
          </div>
        )}
      </button>
      {/* Info */}
      <button onClick={onPlay} className="flex-1 min-w-0 text-left">
        <p className={cn("text-sm font-medium truncate", isPlaying && "text-primary")}>{item.song.name}</p>
        <p className="text-xs text-muted-foreground truncate">{item.artist.name}</p>
      </button>
      <Badge variant="outline" className="text-[10px] hidden sm:inline-flex shrink-0">{item.artist.genre}</Badge>
      {/* Add to queue — always visible on mobile */}
      <button
        onClick={onAddToQueue}
        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 shrink-0"
        title="Zur Warteschlange hinzufügen"
      >
        <ListPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, onShuffle }: { title: string; onShuffle?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <h2 className="text-base sm:text-lg font-bold">{title}</h2>
      {onShuffle && (
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8" onClick={onShuffle}>
          <Shuffle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Mischen</span>
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ScoopifyHome() {
  const { artists, stats, isLoading } = useCatalogData();
  const { play, currentTrack, addToQueue, clearQueue, isPlaying, pause, resume } = useAudioPlayer();
  const playerHeight = usePlayerHeight();

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

  const featuredArtist = useMemo(() => {
    if (!artists.length) return null;
    return [...artists].sort((a, b) => {
      const countA = allSongsWithAudio.filter(s => s.artist.id === a.id).length;
      const countB = allSongsWithAudio.filter(s => s.artist.id === b.id).length;
      return countB - countA;
    })[0];
  }, [artists, allSongsWithAudio]);

  const featuredSongs = useMemo(
    () => allSongsWithAudio.filter(s => s.artist.id === featuredArtist?.id),
    [allSongsWithAudio, featuredArtist]
  );

  const artistsWithAudio = useMemo(() => {
    return [...artists]
      .map(a => ({ artist: a, count: allSongsWithAudio.filter(s => s.artist.id === a.id).length }))
      .filter(a => a.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [artists, allSongsWithAudio]);

  const [discoverSongs, setDiscoverSongs] = useState<SongItem[]>([]);
  useMemo(() => {
    setDiscoverSongs(shuffle(allSongsWithAudio).slice(0, 12));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSongsWithAudio.length]);

  const reshuffleDiscover = () => setDiscoverSongs(shuffle(allSongsWithAudio).slice(0, 12));

  const playQueue = (items: SongItem[]) => {
    if (!items.length) return;
    clearQueue();
    play(toTrack(items[0]));
    items.slice(1).forEach(i => addToQueue(toTrack(i)));
  };

  const handlePlayArtist = (artist: ArtistWithAlbums) => {
    const songs = shuffle(allSongsWithAudio.filter(s => s.artist.id === artist.id));
    playQueue(songs);
  };

  const handleAddArtistToQueue = (artist: ArtistWithAlbums) => {
    const songs = shuffle(allSongsWithAudio.filter(s => s.artist.id === artist.id));
    songs.forEach(s => addToQueue(toTrack(s)));
  };

  const handlePlayFeatured = (items: SongItem[]) => playQueue(shuffle(items));

  const handlePlaySong = (item: SongItem) => {
    if (!item.song.audio_url) return;
    if (currentTrack?.id === item.song.id) {
      isPlaying ? pause() : resume();
    } else {
      play(toTrack(item));
    }
  };

  const handleAddToQueue = (item: SongItem) => {
    if (item.song.audio_url) addToQueue(toTrack(item));
  };

  const isPlayingFeatured = !!(
    featuredArtist && currentTrack &&
    allSongsWithAudio.some(s => s.artist.id === featuredArtist.id && s.song.id === currentTrack.id) &&
    isPlaying
  );

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
        {/* ── Full-Width Hero ─────────────────────────────────────────── */}
        <div className="relative w-full overflow-hidden">
          {/* Animated gradient orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -top-24 -left-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full opacity-20 blur-3xl"
              style={{ background: "radial-gradient(circle, hsl(320 90% 55%), transparent 70%)", animation: "pulse 4s ease-in-out infinite" }}
            />
            <div
              className="absolute top-0 right-1/3 w-64 sm:w-80 h-64 sm:h-80 rounded-full opacity-15 blur-3xl"
              style={{ background: "radial-gradient(circle, hsl(260 80% 60%), transparent 70%)", animation: "pulse 5s ease-in-out infinite 1s" }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 sm:w-72 h-32 sm:h-40 opacity-10 blur-3xl"
              style={{ background: "radial-gradient(ellipse, hsl(320 90% 55%), transparent 70%)", animation: "pulse 6s ease-in-out infinite 2s" }}
            />
          </div>
          {/* Grid texture */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          />

          {/* Two-column layout on lg+, stacked on mobile */}
          <div className="container px-3 md:px-6 relative flex flex-col lg:flex-row items-stretch gap-0 pt-6 sm:pt-10 pb-0 lg:pb-0">

            {/* LEFT: text content */}
            <div className="flex-1 flex flex-col justify-center pb-6 sm:pb-10 lg:pb-12 lg:pr-10">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] sm:text-xs font-semibold uppercase tracking-widest">
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="hidden xs:inline">Die erste reine </span>KI-Streamingplattform
                </div>
              </div>

              <h1 className="font-display font-bold leading-[1.05] mb-3 sm:mb-4" style={{ fontSize: "clamp(1.6rem, 6vw, 4rem)" }}>
                <span className="text-foreground">Musik, komplett</span>
                <br />
                <span style={{ background: "linear-gradient(135deg, hsl(320 90% 65%), hsl(340 85% 55%), hsl(280 80% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  von KI erschaffen.
                </span>
              </h1>

              <p className="text-muted-foreground text-xs sm:text-sm md:text-base max-w-md mb-5 sm:mb-8 leading-relaxed">
                Kein Mensch. Kein Studio. Jede Note, jeder Beat, jeder Künstler –
                <span className="text-foreground font-medium"> vollständig generiert</span> von künstlicher Intelligenz.
              </p>

              <div className="flex flex-wrap gap-4 sm:gap-6 md:gap-8">
                {[
                  { value: stats.artists, label: "KI-Künstler", suffix: "" },
                  { value: allSongsWithAudio.length, label: "Streamable Titel", suffix: "" },
                  { value: stats.albums ?? 0, label: "Alben", suffix: "" },
                  { value: "100", label: "% KI", suffix: "%" },
                ].map(({ value, label, suffix }) => (
                  <div key={label} className="flex flex-col">
                    <span
                      className="font-display font-bold text-xl sm:text-2xl md:text-3xl leading-none"
                      style={{ background: "linear-gradient(135deg, hsl(var(--foreground)), hsl(var(--primary)))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
                    >
                      {value}{suffix}
                    </span>
                    <span className="text-muted-foreground text-[10px] sm:text-xs mt-0.5 uppercase tracking-wide">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Featured Artist */}
            {featuredArtist && (
              <div className="w-full lg:w-[44%] flex-shrink-0 pb-6 sm:pb-10 lg:pb-12">
                <FeaturedHero
                  artist={featuredArtist}
                  songs={featuredSongs}
                  onPlay={handlePlayFeatured}
                  isPlayingArtist={isPlayingFeatured}
                />
              </div>
            )}
          </div>
        </div>

        <div
          className="container px-3 md:px-6 pt-5 sm:pt-6"
          style={{ paddingBottom: Math.max(playerHeight + 24, 32) }}
        >
          {/* Künstler entdecken — horizontal scroll */}
          <div className="mb-6 sm:mb-8">
            <SectionHeader title="Künstler entdecken" />
            {/* negative margin trick to allow scroll to edge on mobile */}
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-3 sm:-mx-1 px-3 sm:px-1">
              {artistsWithAudio.map(({ artist, count }) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  songCount={count}
                  onPlay={() => handlePlayArtist(artist)}
                  onAddToQueue={() => handleAddArtistToQueue(artist)}
                />
              ))}
            </div>
          </div>

          {/* Jetzt entdecken */}
          <div>
            <SectionHeader title="Jetzt entdecken" onShuffle={reshuffleDiscover} />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-0.5">
              {discoverSongs.map((item, i) => (
                <SongRow
                  key={item.song.id}
                  item={item}
                  index={i}
                  onPlay={() => handlePlaySong(item)}
                  isPlaying={currentTrack?.id === item.song.id && isPlaying}
                  onAddToQueue={() => handleAddToQueue(item)}
                />
              ))}
            </div>
            {discoverSongs.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-10">Keine Titel verfügbar</p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
