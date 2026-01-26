import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Music, User, Save, ImageIcon, RefreshCw } from 'lucide-react';
import { Track } from '@/contexts/AudioPlayerContext';

interface TrackEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: Track | null;
  onTrackUpdated: (updatedTrack: Partial<Track>) => void;
}

interface SongData {
  name: string;
  bpm: number | null;
  tonart: string | null;
  komponist: string | null;
  textdichter: string | null;
}

interface ArtistData {
  name: string;
  genre: string;
  style: string;
  profile_image_url: string | null;
}

export const TrackEditDialog: React.FC<TrackEditDialogProps> = ({
  open,
  onOpenChange,
  track,
  onTrackUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  
  const [songData, setSongData] = useState<SongData>({
    name: '',
    bpm: null,
    tonart: null,
    komponist: null,
    textdichter: null,
  });
  
  const [artistData, setArtistData] = useState<ArtistData>({
    name: '',
    genre: '',
    style: '',
    profile_image_url: null,
  });
  
  const [albumName, setAlbumName] = useState('');

  // Load data when dialog opens
  useEffect(() => {
    if (open && track?.songId) {
      loadData();
    }
  }, [open, track?.songId]);

  const loadData = async () => {
    if (!track?.songId) return;
    
    setLoading(true);
    try {
      // Load song data
      const { data: song } = await supabase
        .from('songs')
        .select('name, bpm, tonart, komponist, textdichter, album_id')
        .eq('id', track.songId)
        .single();
      
      if (song) {
        setSongData({
          name: song.name,
          bpm: song.bpm,
          tonart: song.tonart,
          komponist: song.komponist,
          textdichter: song.textdichter,
        });
        
        // Load album data
        if (song.album_id) {
          const { data: album } = await supabase
            .from('albums')
            .select('name, artist_id')
            .eq('id', song.album_id)
            .single();
          
          if (album) {
            setAlbumName(album.name);
            
            // Load artist data
            if (album.artist_id) {
              const { data: artist } = await supabase
                .from('artists')
                .select('name, genre, style, profile_image_url')
                .eq('id', album.artist_id)
                .single();
              
              if (artist) {
                setArtistData({
                  name: artist.name,
                  genre: artist.genre,
                  style: artist.style,
                  profile_image_url: artist.profile_image_url,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading track data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!track?.songId) return;
    
    setSaving(true);
    try {
      // Update song
      const { error: songError } = await supabase
        .from('songs')
        .update({
          name: songData.name,
          bpm: songData.bpm,
          tonart: songData.tonart,
          komponist: songData.komponist,
          textdichter: songData.textdichter,
        })
        .eq('id', track.songId);
      
      if (songError) throw songError;

      // Get album_id to update album and artist
      const { data: song } = await supabase
        .from('songs')
        .select('album_id')
        .eq('id', track.songId)
        .single();
      
      if (song?.album_id) {
        // Update album name
        const { error: albumError } = await supabase
          .from('albums')
          .update({ name: albumName })
          .eq('id', song.album_id);
        
        if (albumError) throw albumError;

        // Get artist_id to update artist
        const { data: album } = await supabase
          .from('albums')
          .select('artist_id')
          .eq('id', song.album_id)
          .single();
        
        if (album?.artist_id) {
          const { error: artistError } = await supabase
            .from('artists')
            .update({
              name: artistData.name,
              genre: artistData.genre,
              style: artistData.style,
            })
            .eq('id', album.artist_id);
          
          if (artistError) throw artistError;
        }
      }

      // Notify parent of changes
      onTrackUpdated({
        title: songData.name,
        artist: artistData.name,
        album: albumName,
        artistImageUrl: artistData.profile_image_url || undefined,
      });
      
      toast.success('Änderungen gespeichert');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!track?.artistId) {
      toast.error('Künstler-ID nicht verfügbar');
      return;
    }
    
    setRegeneratingImage(true);
    try {
      const { error } = await supabase.functions.invoke('regenerate-image', {
        body: { artistId: track.artistId },
      });
      
      if (error) throw error;
      
      toast.success('Neues Bild wird generiert...');
      
      // Reload artist data after a short delay
      setTimeout(async () => {
        const { data: artist } = await supabase
          .from('artists')
          .select('profile_image_url')
          .eq('id', track.artistId!)
          .single();
        
        if (artist?.profile_image_url) {
          setArtistData(prev => ({ ...prev, profile_image_url: artist.profile_image_url }));
          onTrackUpdated({ artistImageUrl: artist.profile_image_url });
        }
        setRegeneratingImage(false);
      }, 5000);
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast.error('Fehler bei der Bildgenerierung');
      setRegeneratingImage(false);
    }
  };

  if (!track) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Metadaten bearbeiten
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="song" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="song" className="gap-2">
                <Music className="h-4 w-4" />
                <span className="hidden sm:inline">Song</span>
              </TabsTrigger>
              <TabsTrigger value="artist" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Künstler</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="song" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="song-name">Songtitel</Label>
                <Input
                  id="song-name"
                  value={songData.name}
                  onChange={(e) => setSongData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Songtitel eingeben"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="album-name">Album</Label>
                <Input
                  id="album-name"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="Albumname eingeben"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bpm">BPM</Label>
                  <Input
                    id="bpm"
                    type="number"
                    value={songData.bpm || ''}
                    onChange={(e) => setSongData(prev => ({ 
                      ...prev, 
                      bpm: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="120"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tonart">Tonart</Label>
                  <Input
                    id="tonart"
                    value={songData.tonart || ''}
                    onChange={(e) => setSongData(prev => ({ ...prev, tonart: e.target.value }))}
                    placeholder="C-Dur"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="komponist">Komponist / Featured</Label>
                <Input
                  id="komponist"
                  value={songData.komponist || ''}
                  onChange={(e) => setSongData(prev => ({ ...prev, komponist: e.target.value }))}
                  placeholder="z.B. feat. Künstler B"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textdichter">Textdichter</Label>
                <Input
                  id="textdichter"
                  value={songData.textdichter || ''}
                  onChange={(e) => setSongData(prev => ({ ...prev, textdichter: e.target.value }))}
                  placeholder="Textdichter"
                />
              </div>
            </TabsContent>

            <TabsContent value="artist" className="space-y-4 mt-4">
              {/* Artist image preview */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted flex-shrink-0 ring-2 ring-border">
                  {artistData.profile_image_url ? (
                    <img 
                      src={artistData.profile_image_url} 
                      alt={artistData.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Bild passt nicht zum Künstler?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateImage}
                    disabled={regeneratingImage || !track.artistId}
                    className="gap-2"
                  >
                    {regeneratingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Neues Bild generieren
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist-name">Künstlername</Label>
                <Input
                  id="artist-name"
                  value={artistData.name}
                  onChange={(e) => setArtistData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Künstlername eingeben"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Input
                  id="genre"
                  value={artistData.genre}
                  onChange={(e) => setArtistData(prev => ({ ...prev, genre: e.target.value }))}
                  placeholder="z.B. Pop, Rock, Hip-Hop"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Stil</Label>
                <Input
                  id="style"
                  value={artistData.style}
                  onChange={(e) => setArtistData(prev => ({ ...prev, style: e.target.value }))}
                  placeholder="z.B. Modern, Retro, Experimental"
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
