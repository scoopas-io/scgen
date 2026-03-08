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
    <div className="relative rounded-2xl overflow-hidden min-h-[240px] md:min-h-[320px] flex items-end mb-8">
      <div className="absolute inset-0">
        {artist.profile_image_url ? (
          <img src={artist.profile_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      </div>
      <div className="absolute top-4 left-4">
        <Badge className="gap-1.5 bg-primary/90 text-primary-foreground border-0 text-xs">
          <Sparkles className="h-3 w-3" />
          KI-Künstler des Tages
        </Badge>
      </div>
      <div className="relative p-5 md:p-8 w-full">
        <p className="text-white/70 text-xs uppercase tracking-widest mb-1">{artist.genre}</p>
        <h2 className="text-white text-3xl md:text-5xl font-display font-bold mb-1 leading-tight">{artist.name}</h2>
        <p className="text-white/60 text-sm mb-4 line-clamp-1">{artist.style}</p>
        <div className="flex items-center gap-3">
          <Button size="lg" className="rounded-full gap-2 font-semibold h-12 px-6" onClick={() => onPlay(songs)}>
            {isPlayingArtist
              ? <><Pause className="h-5 w-5" fill="currentColor" /> Pause</>
              : <><Play className="h-5 w-5" fill="currentColor" /> Abspielen</>}
          </Button>
          <span className="text-white/50 text-sm">{songs.length} Titel</span>
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
      className="group flex-shrink-0 w-40 md:w-48 text-left focus:outline-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative rounded-xl overflow-hidden aspect-square bg-muted/40 mb-2.5">
        {artist.profile_image_url ? (
          <img
            src={artist.profile_image_url}
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Music className="h-10 w-10 text-primary/40" />
          </div>
        )}
        <div className={cn(
          "absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity duration-200",
          hovered ? "opacity-100" : "opacity-0"
        )}>
          <button
            onClick={onPlay}
            className="bg-primary rounded-full p-3 shadow-lg shadow-primary/40 hover:scale-105 transition-transform"
          >
            <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToQueue(); }}
            className="bg-white/20 hover:bg-white/30 rounded-full p-2.5 shadow transition-all"
            title="Zur Warteschlange hinzufügen"
          >
            <ListPlus className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
      <p className="text-sm font-semibold truncate">{artist.name}</p>
      <p className="text-xs text-muted-foreground truncate">{artist.genre} · {songCount} Titel</p>
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
      "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
      "hover:bg-muted/60",
      isPlaying && "bg-primary/8"
    )}>
      {/* Index / Play indicator */}
      <button onClick={onPlay} className="w-6 flex-shrink-0 flex items-center justify-center">
        <span className={cn("text-sm tabular-nums text-muted-foreground group-hover:hidden", isPlaying && "hidden")}>
          {index + 1}
        </span>
        <Play className={cn("h-3.5 w-3.5 text-primary hidden group-hover:block", isPlaying && "!block")} fill="currentColor" />
      </button>
      {/* Cover */}
      <button onClick={onPlay} className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-muted/50">
        {item.artist.profile_image_url ? (
          <img src={item.artist.profile_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </button>
      {/* Info */}
      <button onClick={onPlay} className="flex-1 min-w-0 text-left">
        <p className={cn("text-sm font-medium truncate", isPlaying && "text-primary")}>{item.song.name}</p>
        <p className="text-xs text-muted-foreground truncate">{item.artist.name}</p>
      </button>
      <Badge variant="outline" className="text-xs hidden sm:inline-flex shrink-0">{item.artist.genre}</Badge>
      {/* Add to queue */}
      <button
        onClick={onAddToQueue}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
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
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold">{title}</h2>
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
    setDiscoverSongs(shuffle(allSongsWithAudio).slice(0, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSongsWithAudio.length]);

  const reshuffleDiscover = () => setDiscoverSongs(shuffle(allSongsWithAudio).slice(0, 10));

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
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background">
            <div
              className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
              style={{ background: "radial-gradient(circle, hsl(320 90% 55%), transparent 70%)", animation: "pulse 4s ease-in-out infinite" }}
            />
            <div
              className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-15 blur-3xl"
              style={{ background: "radial-gradient(circle, hsl(260 80% 60%), transparent 70%)", animation: "pulse 5s ease-in-out infinite 1s" }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-40 opacity-10 blur-3xl"
              style={{ background: "radial-gradient(ellipse, hsl(320 90% 55%), transparent 70%)", animation: "pulse 6s ease-in-out infinite 2s" }}
            />
          </div>

          {/* Grid texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          />

          <div className="relative container pt-10 pb-12">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest">
                <Sparkles className="h-3 w-3" />
                Die erste reine KI-Streamingplattform
              </div>
            </div>

            {/* Main headline */}
            <h1 className="font-display font-bold leading-[1.05] mb-4" style={{ fontSize: "clamp(2.2rem, 6vw, 4.5rem)" }}>
              <span className="text-foreground">Musik, komplett</span>
              <br />
              <span style={{ background: "linear-gradient(135deg, hsl(320 90% 65%), hsl(340 85% 55%), hsl(280 80% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                von KI erschaffen.
              </span>
            </h1>

            {/* Sub-copy */}
            <p className="text-muted-foreground text-base md:text-lg max-w-xl mb-8 leading-relaxed">
              Kein Mensch. Kein Studio. Jede Note, jeder Beat, jeder Künstler – 
              <span className="text-foreground font-medium"> vollständig generiert</span> von künstlicher Intelligenz.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 md:gap-10">
              {[
                { value: stats.artists, label: "KI-Künstler", suffix: "" },
                { value: allSongsWithAudio.length, label: "Streamable Titel", suffix: "" },
                { value: stats.albums ?? 0, label: "Alben", suffix: "" },
                { value: "100", label: "% KI-generiert", suffix: "%" },
              ].map(({ value, label, suffix }) => (
                <div key={label} className="flex flex-col">
                  <span
                    className="font-display font-bold text-2xl md:text-3xl leading-none"
                    style={{ background: "linear-gradient(135deg, hsl(var(--foreground)), hsl(var(--primary)))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
                  >
                    {value}{suffix}
                  </span>
                  <span className="text-muted-foreground text-xs mt-0.5 uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="container px-3 md:px-6 pt-6"
          style={{ paddingBottom: Math.max(playerHeight + 24, 32) }}
        >

          {featuredArtist && (
            <FeaturedHero
              artist={featuredArtist}
              songs={featuredSongs}
              onPlay={handlePlayFeatured}
              isPlayingArtist={isPlayingFeatured}
            />
          )}

          <div className="mb-8">
            <SectionHeader title="Künstler entdecken" />
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
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

          <div>
            <SectionHeader title="Jetzt entdecken" onShuffle={reshuffleDiscover} />
            <div className="space-y-1">
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
