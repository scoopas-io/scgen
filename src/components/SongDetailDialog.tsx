import { useState, useEffect } from "react";
import { X, Save, Music, FileText, Hash, Clock, Gauge, Key, Building2, User, DollarSign, Calendar, Shield, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Song {
  id: string;
  name: string;
  album_id: string;
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

interface SongDetailDialogProps {
  song: Song | null;
  albumName: string;
  artistName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const TONARTEN = ["C-Dur", "D-Dur", "E-Dur", "F-Dur", "G-Dur", "A-Dur", "H-Dur", "a-Moll", "d-Moll", "e-Moll", "g-Moll", "c-Moll", "f-Moll"];
const GEMA_STATUS = ["Nicht angemeldet", "In Bearbeitung", "Angemeldet", "Bestätigt"];
const VERWERTUNGSSTATUS = ["Aktiv", "Inaktiv", "Gesperrt", "Archiviert"];
const EINNAHMEQUELLEN = ["Streaming", "Download", "Sync", "Live", "Radio", "TV", "Film", "Werbung"];
const VERTRAGSARTEN = ["Eigenproduktion", "Labelvertrag", "Lizenzvertrag", "Work-for-Hire", "Kooperation"];
const EXKLUSIVITAET = ["Exklusiv", "Nicht-Exklusiv", "Co-Exklusiv"];
const KI_GENERIERT = ["Ja", "Nein", "Teilweise"];
const VERSIONEN = ["Original", "Remix", "Radio Edit", "Extended", "Instrumental", "Acoustic", "Live"];

export function SongDetailDialog({ song, albumName, artistName, open, onOpenChange, onSaved }: SongDetailDialogProps) {
  const [formData, setFormData] = useState<Partial<Song>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (song) {
      setFormData({ ...song });
    }
  }, [song]);

  const handleChange = (field: keyof Song, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!song?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("songs")
        .update({
          name: formData.name,
          komponist: formData.komponist,
          textdichter: formData.textdichter,
          isrc: formData.isrc,
          iswc: formData.iswc,
          gema_werknummer: formData.gema_werknummer,
          gema_status: formData.gema_status,
          bpm: formData.bpm,
          tonart: formData.tonart,
          laenge: formData.laenge,
          version: formData.version,
          ki_generiert: formData.ki_generiert,
          verwertungsstatus: formData.verwertungsstatus,
          einnahmequelle: formData.einnahmequelle,
          vertragsart: formData.vertragsart,
          exklusivitaet: formData.exklusivitaet,
          vertragsbeginn: formData.vertragsbeginn,
          vertragsende: formData.vertragsende,
          anteil_komponist: formData.anteil_komponist,
          anteil_text: formData.anteil_text,
          anteil_verlag: formData.anteil_verlag,
          jahresumsatz: formData.jahresumsatz,
          katalogwert: formData.katalogwert,
          bemerkungen: formData.bemerkungen,
        })
        .eq("id", song.id);

      if (error) throw error;

      toast.success("Song gespeichert!");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving song:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Music className="h-5 w-5 text-primary" />
            Song-Details bearbeiten
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {artistName} • {albumName}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Grunddaten
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor="name">Titel</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="song_id">Song-ID</Label>
                <Input
                  id="song_id"
                  value={formData.song_id || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Select
                  value={formData.version || "Original"}
                  onValueChange={(v) => handleChange("version", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERSIONEN.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Technical Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Technische Daten
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="bpm">BPM</Label>
                <Input
                  id="bpm"
                  type="number"
                  value={formData.bpm || ""}
                  onChange={(e) => handleChange("bpm", parseInt(e.target.value) || null)}
                />
              </div>
              <div>
                <Label htmlFor="tonart">Tonart</Label>
                <Select
                  value={formData.tonart || ""}
                  onValueChange={(v) => handleChange("tonart", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TONARTEN.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="laenge">Länge</Label>
                <Input
                  id="laenge"
                  value={formData.laenge || ""}
                  onChange={(e) => handleChange("laenge", e.target.value)}
                  placeholder="03:30"
                />
              </div>
              <div>
                <Label htmlFor="ki_generiert">KI-generiert</Label>
                <Select
                  value={formData.ki_generiert || "Ja"}
                  onValueChange={(v) => handleChange("ki_generiert", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KI_GENERIERT.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* IDs & Registration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Hash className="h-4 w-4" />
              IDs & Registrierung
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="isrc">ISRC</Label>
                <Input
                  id="isrc"
                  value={formData.isrc || ""}
                  onChange={(e) => handleChange("isrc", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="iswc">ISWC</Label>
                <Input
                  id="iswc"
                  value={formData.iswc || ""}
                  onChange={(e) => handleChange("iswc", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gema_werknummer">GEMA-Nr.</Label>
                <Input
                  id="gema_werknummer"
                  value={formData.gema_werknummer || ""}
                  onChange={(e) => handleChange("gema_werknummer", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gema_status">GEMA-Status</Label>
                <Select
                  value={formData.gema_status || "Nicht angemeldet"}
                  onValueChange={(v) => handleChange("gema_status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMA_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Rights & Authors */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Urheber & Anteile
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="komponist">Komponist</Label>
                <Input
                  id="komponist"
                  value={formData.komponist || ""}
                  onChange={(e) => handleChange("komponist", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="textdichter">Textdichter</Label>
                <Input
                  id="textdichter"
                  value={formData.textdichter || ""}
                  onChange={(e) => handleChange("textdichter", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="anteil_komponist">Anteil Komponist (%)</Label>
                <Input
                  id="anteil_komponist"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.anteil_komponist || ""}
                  onChange={(e) => handleChange("anteil_komponist", parseInt(e.target.value) || null)}
                />
              </div>
              <div>
                <Label htmlFor="anteil_text">Anteil Text (%)</Label>
                <Input
                  id="anteil_text"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.anteil_text || ""}
                  onChange={(e) => handleChange("anteil_text", parseInt(e.target.value) || null)}
                />
              </div>
              <div>
                <Label htmlFor="anteil_verlag">Anteil Verlag (%)</Label>
                <Input
                  id="anteil_verlag"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.anteil_verlag || ""}
                  onChange={(e) => handleChange("anteil_verlag", parseInt(e.target.value) || null)}
                />
              </div>
            </div>
          </div>

          {/* Contract & Status */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Vertrag & Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="vertragsart">Vertragsart</Label>
                <Select
                  value={formData.vertragsart || "Eigenproduktion"}
                  onValueChange={(v) => handleChange("vertragsart", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTRAGSARTEN.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="exklusivitaet">Exklusivität</Label>
                <Select
                  value={formData.exklusivitaet || "Exklusiv"}
                  onValueChange={(v) => handleChange("exklusivitaet", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXKLUSIVITAET.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vertragsbeginn">Vertragsbeginn</Label>
                <Input
                  id="vertragsbeginn"
                  type="date"
                  value={formData.vertragsbeginn || ""}
                  onChange={(e) => handleChange("vertragsbeginn", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vertragsende">Vertragsende</Label>
                <Input
                  id="vertragsende"
                  type="date"
                  value={formData.vertragsende || ""}
                  onChange={(e) => handleChange("vertragsende", e.target.value || null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="verwertungsstatus">Verwertungsstatus</Label>
                <Select
                  value={formData.verwertungsstatus || "Aktiv"}
                  onValueChange={(v) => handleChange("verwertungsstatus", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERWERTUNGSSTATUS.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="einnahmequelle">Einnahmequelle</Label>
                <Select
                  value={formData.einnahmequelle || "Streaming"}
                  onValueChange={(v) => handleChange("einnahmequelle", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EINNAHMEQUELLEN.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Finanzdaten
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="jahresumsatz">Jahresumsatz (€)</Label>
                <Input
                  id="jahresumsatz"
                  type="number"
                  step="0.01"
                  value={formData.jahresumsatz || ""}
                  onChange={(e) => handleChange("jahresumsatz", parseFloat(e.target.value) || null)}
                />
              </div>
              <div>
                <Label htmlFor="katalogwert">Katalogwert (€)</Label>
                <Input
                  id="katalogwert"
                  type="number"
                  step="0.01"
                  value={formData.katalogwert || ""}
                  onChange={(e) => handleChange("katalogwert", parseFloat(e.target.value) || null)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bemerkungen
            </h3>
            <Textarea
              value={formData.bemerkungen || ""}
              onChange={(e) => handleChange("bemerkungen", e.target.value)}
              placeholder="Zusätzliche Informationen..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
