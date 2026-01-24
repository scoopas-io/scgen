import { memo, useCallback } from "react";
import { ChevronDown, ChevronRight, User, Disc, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Song {
  id: string;
  name: string;
  track_number: number;
  bpm?: number;
  tonart?: string;
  audio_url?: string;
}

interface Album {
  id: string;
  name: string;
  release_date?: string;
  songs: Song[];
}

interface ArtistWithAlbums {
  id: string;
  name: string;
  genre: string;
  style: string;
  language?: string;
  profile_image_url?: string;
  albums: Album[];
}

const LANGUAGE_FLAGS: Record<string, { flag: string; name: string }> = {
  de: { flag: "🇩🇪", name: "Deutsch" },
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Español" },
  fr: { flag: "🇫🇷", name: "Français" },
  it: { flag: "🇮🇹", name: "Italiano" },
  pt: { flag: "🇵🇹", name: "Português" },
  ja: { flag: "🇯🇵", name: "日本語" },
  ko: { flag: "🇰🇷", name: "한국어" },
  zh: { flag: "🇨🇳", name: "中文" },
  nl: { flag: "🇳🇱", name: "Nederlands" },
  pl: { flag: "🇵🇱", name: "Polski" },
  ru: { flag: "🇷🇺", name: "Русский" },
};

interface SongRowProps {
  song: Song;
  artistName: string;
  albumName: string;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSelect: () => void;
}

const SongRow = memo(({ song, artistName, albumName, isCurrentTrack, isPlaying, onPlay, onSelect }: SongRowProps) => (
  <div className={cn(
    "flex items-center gap-3 p-2 pl-20 hover:bg-muted/50 transition-colors group",
    isCurrentTrack && "bg-primary/10"
  )}>
    <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">
      {song.track_number}
    </span>
    {song.audio_url ? (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 shrink-0",
          isCurrentTrack && "text-primary"
        )}
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
      >
        {isCurrentTrack && isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    ) : (
      <div className="w-7" />
    )}
    <button
      onClick={onSelect}
      className={cn(
        "flex-1 text-left text-sm hover:text-primary transition-colors truncate",
        isCurrentTrack && "text-primary font-medium"
      )}
    >
      {song.name}
    </button>
    <div className="flex items-center gap-3 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
      {song.bpm && <span className="tabular-nums">{song.bpm} BPM</span>}
      {song.tonart && <span>{song.tonart}</span>}
    </div>
  </div>
));

SongRow.displayName = "SongRow";

interface AlbumRowProps {
  album: Album;
  artistName: string;
  isExpanded: boolean;
  onToggle: () => void;
  currentTrackUrl: string | null;
  isPlaying: boolean;
  onPlayAudio: (url: string, songName: string, artistName: string, albumName?: string) => void;
  onSelectSong: (song: Song, albumName: string) => void;
}

const AlbumRow = memo(({ 
  album, 
  artistName,
  isExpanded, 
  onToggle, 
  currentTrackUrl, 
  isPlaying,
  onPlayAudio, 
  onSelectSong 
}: AlbumRowProps) => {
  const songCount = album.songs.length;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 pl-10 hover:bg-muted/50 transition-colors"
      >
        <div className={cn(
          "transition-transform duration-200",
          isExpanded && "rotate-90"
        )}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
          <Disc className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-sm truncate">{album.name}</div>
          <div className="text-xs text-muted-foreground">
            {songCount} {songCount === 1 ? "Song" : "Songs"} • {album.release_date}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border/50 bg-muted/30 animate-in slide-in-from-top-2 duration-200">
          {album.songs.map(song => (
            <SongRow
              key={song.id}
              song={song}
              artistName={artistName}
              albumName={album.name}
              isCurrentTrack={currentTrackUrl === song.audio_url}
              isPlaying={isPlaying}
              onPlay={() => song.audio_url && onPlayAudio(song.audio_url, song.name, artistName, album.name)}
              onSelect={() => onSelectSong(song, album.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

AlbumRow.displayName = "AlbumRow";

interface ArtistTreeRowProps {
  artist: ArtistWithAlbums;
  isExpanded: boolean;
  expandedAlbums: Set<string>;
  onToggleArtist: () => void;
  onToggleAlbum: (albumId: string) => void;
  currentTrackUrl: string | null;
  isPlaying: boolean;
  onPlayAudio: (url: string, songName: string, artistName: string, albumName?: string) => void;
  onSelectSong: (song: Song, artistName: string, albumName: string) => void;
}

export const ArtistTreeRow = memo(({ 
  artist, 
  isExpanded, 
  expandedAlbums,
  onToggleArtist,
  onToggleAlbum,
  currentTrackUrl,
  isPlaying,
  onPlayAudio,
  onSelectSong
}: ArtistTreeRowProps) => {
  const albumCount = artist.albums.length;
  const songCount = artist.albums.reduce((acc, album) => acc + album.songs.length, 0);
  const langInfo = artist.language ? LANGUAGE_FLAGS[artist.language] : null;

  const handleSelectSong = useCallback((song: Song, albumName: string) => {
    onSelectSong(song, artist.name, albumName);
  }, [artist.name, onSelectSong]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50 hover:bg-card/80 transition-colors">
      <button
        onClick={onToggleArtist}
        className="w-full flex items-center gap-3 p-3 transition-colors"
      >
        <div className={cn(
          "transition-transform duration-200",
          isExpanded && "rotate-90"
        )}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {artist.profile_image_url ? (
          <img 
            src={artist.profile_image_url} 
            alt={artist.name}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
            loading="lazy"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-border">
            <User className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium flex items-center gap-2">
            <span className="truncate">{artist.name}</span>
            {langInfo && (
              <span title={langInfo.name} className="shrink-0">
                {langInfo.flag}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {artist.genre} • {artist.style} • {albumCount} {albumCount === 1 ? "Album" : "Alben"} • {songCount} Songs
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/20 animate-in slide-in-from-top-2 duration-200">
          {artist.albums.map(album => (
            <AlbumRow
              key={album.id}
              album={album}
              artistName={artist.name}
              isExpanded={expandedAlbums.has(album.id)}
              onToggle={() => onToggleAlbum(album.id)}
              currentTrackUrl={currentTrackUrl}
              isPlaying={isPlaying}
              onPlayAudio={onPlayAudio}
              onSelectSong={(song, albumName) => handleSelectSong(song, albumName)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ArtistTreeRow.displayName = "ArtistTreeRow";
