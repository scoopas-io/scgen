import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, User, Disc, Music, Building, Loader2, Trash2, Plus } from "lucide-react";

interface ArtistData {
  id: string;
  name: string;
  personality: string;
  voice_prompt: string;
  genre: string;
  style: string;
  profile_image_url: string | null;
  katalognummer: string | null;
  verlag: string | null;
  label: string | null;
  rechteinhaber_master: string | null;
  rechteinhaber_publishing: string | null;
}

interface AlbumData {
  id: string;
  name: string;
  release_date: string | null;
  songs: SongData[];
}

interface SongData {
  id: string;
  name: string;
  track_number: number;
  song_id: string | null;
  komponist: string | null;
  textdichter: string | null;
  isrc: string | null;
  iswc: string | null;
  gema_werknummer: string | null;
  gema_status: string | null;
  bpm: number | null;
  tonart: string | null;
  laenge: string | null;
  version: string | null;
  ki_generiert: string | null;
  verwertungsstatus: string | null;
  einnahmequelle: string | null;
  vertragsart: string | null;
  exklusivitaet: string | null;
  vertragsbeginn: string | null;
  vertragsende: string | null;
  anteil_komponist: number | null;
  anteil_text: number | null;
  anteil_verlag: number | null;
  jahresumsatz: number | null;
  katalogwert: number | null;
  bemerkungen: string | null;
}

interface Props {
  artistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ArtistManagementDialog({ artistId, open, onOpenChange, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [albums, setAlbums] = useState<AlbumData[]>([]);
  const [activeTab, setActiveTab] = useState("artist");

  useEffect(() => {
    if (open && artistId) {
      loadAllData();
    }
  }, [open, artistId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load artist
      const { data: artistData, error: artistError } = await supabase
        .from("artists")
        .select("*")
        .eq("id", artistId)
        .single();

      if (artistError) throw artistError;
      setArtist(artistData);

      // Load albums with songs
      const { data: albumsData, error: albumsError } = await supabase
        .from("albums")
        .select("*")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: true });

      if (albumsError) throw albumsError;

      const albumsWithSongs: AlbumData[] = [];
      for (const album of albumsData || []) {
        const { data: songsData } = await supabase
          .from("songs")
          .select("*")
          .eq("album_id", album.id)
          .order("track_number", { ascending: true });

        albumsWithSongs.push({
          ...album,
          songs: songsData || [],
        });
      }
      setAlbums(albumsWithSongs);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const saveArtist = async () => {
    if (!artist) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("artists")
        .update({
          name: artist.name,
          personality: artist.personality,
          voice_prompt: artist.voice_prompt,
          genre: artist.genre,
          style: artist.style,
          katalognummer: artist.katalognummer,
          verlag: artist.verlag,
          label: artist.label,
          rechteinhaber_master: artist.rechteinhaber_master,
          rechteinhaber_publishing: artist.rechteinhaber_publishing,
        })
        .eq("id", artistId);

      if (error) throw error;
      toast.success("Künstler gespeichert");
      onSaved?.();
    } catch (error) {
      console.error("Error saving artist:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const saveAlbum = async (album: AlbumData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("albums")
        .update({
          name: album.name,
          release_date: album.release_date,
        })
        .eq("id", album.id);

      if (error) throw error;
      toast.success("Album gespeichert");
    } catch (error) {
      console.error("Error saving album:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const saveSong = async (song: SongData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("songs")
        .update({
          name: song.name,
          track_number: song.track_number,
          song_id: song.song_id,
          komponist: song.komponist,
          textdichter: song.textdichter,
          isrc: song.isrc,
          iswc: song.iswc,
          gema_werknummer: song.gema_werknummer,
          gema_status: song.gema_status,
          bpm: song.bpm,
          tonart: song.tonart,
          laenge: song.laenge,
          version: song.version,
          ki_generiert: song.ki_generiert,
          verwertungsstatus: song.verwertungsstatus,
          einnahmequelle: song.einnahmequelle,
          vertragsart: song.vertragsart,
          exklusivitaet: song.exklusivitaet,
          vertragsbeginn: song.vertragsbeginn,
          vertragsende: song.vertragsende,
          anteil_komponist: song.anteil_komponist,
          anteil_text: song.anteil_text,
          anteil_verlag: song.anteil_verlag,
          jahresumsatz: song.jahresumsatz,
          katalogwert: song.katalogwert,
          bemerkungen: song.bemerkungen,
        })
        .eq("id", song.id);

      if (error) throw error;
      toast.success("Song gespeichert");
    } catch (error) {
      console.error("Error saving song:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!confirm("Album und alle Songs löschen?")) return;
    try {
      const { error } = await supabase.from("albums").delete().eq("id", albumId);
      if (error) throw error;
      setAlbums(albums.filter(a => a.id !== albumId));
      toast.success("Album gelöscht");
      onSaved?.();
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  const deleteSong = async (albumId: string, songId: string) => {
    try {
      const { error } = await supabase.from("songs").delete().eq("id", songId);
      if (error) throw error;
      setAlbums(albums.map(a => 
        a.id === albumId ? { ...a, songs: a.songs.filter(s => s.id !== songId) } : a
      ));
      toast.success("Song gelöscht");
      onSaved?.();
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  const updateArtistField = (field: keyof ArtistData, value: string) => {
    if (!artist) return;
    setArtist({ ...artist, [field]: value });
  };

  const updateAlbumField = (albumId: string, field: keyof AlbumData, value: string) => {
    setAlbums(albums.map(a => 
      a.id === albumId ? { ...a, [field]: value } : a
    ));
  };

  const updateSongField = (albumId: string, songId: string, field: keyof SongData, value: string | number | null) => {
    setAlbums(albums.map(a => 
      a.id === albumId ? {
        ...a,
        songs: a.songs.map(s => s.id === songId ? { ...s, [field]: value } : s)
      } : a
    ));
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!artist) return null;

  const totalSongs = albums.reduce((acc, a) => acc + a.songs.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-xl">{artist.name}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{artist.katalognummer}</Badge>
                <Badge variant="secondary">{albums.length} Alben</Badge>
                <Badge variant="secondary">{totalSongs} Songs</Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="artist" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Künstler
              </TabsTrigger>
              <TabsTrigger value="albums" className="flex items-center gap-2">
                <Disc className="h-4 w-4" /> Alben ({albums.length})
              </TabsTrigger>
              <TabsTrigger value="songs" className="flex items-center gap-2">
                <Music className="h-4 w-4" /> Songs ({totalSongs})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh] px-6 py-4">
            {/* Artist Tab */}
            <TabsContent value="artist" className="mt-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Künstlername</Label>
                  <Input value={artist.name} onChange={e => updateArtistField("name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Katalognummer</Label>
                  <Input value={artist.katalognummer || ""} onChange={e => updateArtistField("katalognummer", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Input value={artist.genre} onChange={e => updateArtistField("genre", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Style</Label>
                  <Input value={artist.style} onChange={e => updateArtistField("style", e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Persönlichkeitsprompt</Label>
                <Textarea 
                  value={artist.personality} 
                  onChange={e => updateArtistField("personality", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>SUNO Voice Prompt</Label>
                <Textarea 
                  value={artist.voice_prompt} 
                  onChange={e => updateArtistField("voice_prompt", e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="h-4 w-4 text-primary" />
                  Rechtliche Informationen
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Verlag</Label>
                    <Input value={artist.verlag || ""} onChange={e => updateArtistField("verlag", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input value={artist.label || ""} onChange={e => updateArtistField("label", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rechteinhaber Master</Label>
                    <Input value={artist.rechteinhaber_master || ""} onChange={e => updateArtistField("rechteinhaber_master", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rechteinhaber Publishing</Label>
                    <Input value={artist.rechteinhaber_publishing || ""} onChange={e => updateArtistField("rechteinhaber_publishing", e.target.value)} />
                  </div>
                </div>
              </div>

              <Button onClick={saveArtist} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Künstler speichern
              </Button>
            </TabsContent>

            {/* Albums Tab */}
            <TabsContent value="albums" className="mt-0 space-y-4">
              <Accordion type="multiple" className="space-y-2">
                {albums.map((album, index) => (
                  <AccordionItem key={album.id} value={album.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Disc className="h-4 w-4 text-primary" />
                        <span className="font-medium">{album.name}</span>
                        <Badge variant="outline">{album.songs.length} Songs</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Albumname</Label>
                          <Input 
                            value={album.name} 
                            onChange={e => updateAlbumField(album.id, "name", e.target.value)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Veröffentlichungsdatum</Label>
                          <Input 
                            type="date"
                            value={album.release_date || ""} 
                            onChange={e => updateAlbumField(album.id, "release_date", e.target.value)} 
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => saveAlbum(album)} disabled={saving} size="sm">
                          <Save className="h-3 w-3 mr-1" /> Speichern
                        </Button>
                        <Button onClick={() => deleteAlbum(album.id)} variant="destructive" size="sm">
                          <Trash2 className="h-3 w-3 mr-1" /> Löschen
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            {/* Songs Tab */}
            <TabsContent value="songs" className="mt-0 space-y-4">
              {albums.map(album => (
                <div key={album.id} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Disc className="h-4 w-4" />
                    {album.name}
                  </div>
                  <Accordion type="multiple" className="space-y-1">
                    {album.songs.map(song => (
                      <AccordionItem key={song.id} value={song.id} className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground font-mono w-6">
                              {String(song.track_number).padStart(2, '0')}
                            </span>
                            <Music className="h-3 w-3 text-primary" />
                            <span>{song.name}</span>
                            {song.isrc && <Badge variant="outline" className="text-[10px]">{song.isrc}</Badge>}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-3 pb-4">
                          {/* Basic Info */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Titel</Label>
                              <Input 
                                value={song.name} 
                                onChange={e => updateSongField(album.id, song.id, "name", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Song-ID</Label>
                              <Input 
                                value={song.song_id || ""} 
                                onChange={e => updateSongField(album.id, song.id, "song_id", e.target.value)}
                                className="h-8 text-sm font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Track #</Label>
                              <Input 
                                type="number"
                                value={song.track_number} 
                                onChange={e => updateSongField(album.id, song.id, "track_number", parseInt(e.target.value))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Credits */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Komponist</Label>
                              <Input 
                                value={song.komponist || ""} 
                                onChange={e => updateSongField(album.id, song.id, "komponist", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Textdichter</Label>
                              <Input 
                                value={song.textdichter || ""} 
                                onChange={e => updateSongField(album.id, song.id, "textdichter", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Technical */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">BPM</Label>
                              <Input 
                                type="number"
                                value={song.bpm || ""} 
                                onChange={e => updateSongField(album.id, song.id, "bpm", e.target.value ? parseInt(e.target.value) : null)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tonart</Label>
                              <Input 
                                value={song.tonart || ""} 
                                onChange={e => updateSongField(album.id, song.id, "tonart", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Länge</Label>
                              <Input 
                                value={song.laenge || ""} 
                                onChange={e => updateSongField(album.id, song.id, "laenge", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Version</Label>
                              <Input 
                                value={song.version || ""} 
                                onChange={e => updateSongField(album.id, song.id, "version", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* IDs */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">ISRC</Label>
                              <Input 
                                value={song.isrc || ""} 
                                onChange={e => updateSongField(album.id, song.id, "isrc", e.target.value)}
                                className="h-8 text-sm font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">ISWC</Label>
                              <Input 
                                value={song.iswc || ""} 
                                onChange={e => updateSongField(album.id, song.id, "iswc", e.target.value)}
                                className="h-8 text-sm font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">GEMA Werknummer</Label>
                              <Input 
                                value={song.gema_werknummer || ""} 
                                onChange={e => updateSongField(album.id, song.id, "gema_werknummer", e.target.value)}
                                className="h-8 text-sm font-mono"
                              />
                            </div>
                          </div>

                          {/* Status & Rights */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">GEMA Status</Label>
                              <Input 
                                value={song.gema_status || ""} 
                                onChange={e => updateSongField(album.id, song.id, "gema_status", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Verwertungsstatus</Label>
                              <Input 
                                value={song.verwertungsstatus || ""} 
                                onChange={e => updateSongField(album.id, song.id, "verwertungsstatus", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Einnahmequelle</Label>
                              <Input 
                                value={song.einnahmequelle || ""} 
                                onChange={e => updateSongField(album.id, song.id, "einnahmequelle", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Contract */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Vertragsart</Label>
                              <Input 
                                value={song.vertragsart || ""} 
                                onChange={e => updateSongField(album.id, song.id, "vertragsart", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Exklusivität</Label>
                              <Input 
                                value={song.exklusivitaet || ""} 
                                onChange={e => updateSongField(album.id, song.id, "exklusivitaet", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">KI Generiert</Label>
                              <Input 
                                value={song.ki_generiert || ""} 
                                onChange={e => updateSongField(album.id, song.id, "ki_generiert", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Shares */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Anteil Komponist %</Label>
                              <Input 
                                type="number"
                                value={song.anteil_komponist ?? ""} 
                                onChange={e => updateSongField(album.id, song.id, "anteil_komponist", e.target.value ? parseInt(e.target.value) : null)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Anteil Text %</Label>
                              <Input 
                                type="number"
                                value={song.anteil_text ?? ""} 
                                onChange={e => updateSongField(album.id, song.id, "anteil_text", e.target.value ? parseInt(e.target.value) : null)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Anteil Verlag %</Label>
                              <Input 
                                type="number"
                                value={song.anteil_verlag ?? ""} 
                                onChange={e => updateSongField(album.id, song.id, "anteil_verlag", e.target.value ? parseInt(e.target.value) : null)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Notes */}
                          <div className="space-y-1">
                            <Label className="text-xs">Bemerkungen</Label>
                            <Textarea 
                              value={song.bemerkungen || ""} 
                              onChange={e => updateSongField(album.id, song.id, "bemerkungen", e.target.value)}
                              className="text-sm"
                              rows={2}
                            />
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button onClick={() => saveSong(song)} disabled={saving} size="sm">
                              <Save className="h-3 w-3 mr-1" /> Song speichern
                            </Button>
                            <Button onClick={() => deleteSong(album.id, song.id)} variant="destructive" size="sm">
                              <Trash2 className="h-3 w-3 mr-1" /> Löschen
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
