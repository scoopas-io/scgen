import { Info, Music, FileText, Hash, Clock, Gauge, Key, Building2, User, DollarSign, Calendar, Shield, FileCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Song {
  id: string;
  name: string;
  track_number?: number;
  song_id?: string | null;
  komponist?: string | null;
  textdichter?: string | null;
  isrc?: string | null;
  iswc?: string | null;
  gema_werknummer?: string | null;
  gema_status?: string | null;
  bpm?: number | null;
  tonart?: string | null;
  laenge?: string | null;
  version?: string | null;
  ki_generiert?: string | null;
  verwertungsstatus?: string | null;
  einnahmequelle?: string | null;
  vertragsart?: string | null;
  exklusivitaet?: string | null;
  vertragsbeginn?: string | null;
  vertragsende?: string | null;
  anteil_komponist?: number | null;
  anteil_text?: number | null;
  anteil_verlag?: number | null;
  jahresumsatz?: number | null;
  katalogwert?: number | null;
  bemerkungen?: string | null;
}

interface SongInfoDialogProps {
  song: Song | null;
  albumName: string;
  artistName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function SongInfoDialog({ song, albumName, artistName, open, onOpenChange }: SongInfoDialogProps) {
  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Song-Informationen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold text-lg">{song.name}</h3>
            <p className="text-sm text-muted-foreground">{artistName} • {albumName}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {song.version && song.version !== "Original" && (
                <Badge variant="secondary">{song.version}</Badge>
              )}
              {song.ki_generiert === "Ja" && (
                <Badge variant="outline" className="bg-primary/10 text-primary">KI-generiert</Badge>
              )}
              {song.verwertungsstatus && (
                <Badge variant={song.verwertungsstatus === "Aktiv" ? "default" : "secondary"}>
                  {song.verwertungsstatus}
                </Badge>
              )}
            </div>
          </div>

          {/* Technical Details */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Technische Daten</h4>
            <div className="grid grid-cols-2 gap-x-4 bg-card rounded-lg border border-border p-3">
              <InfoRow icon={Hash} label="Track-Nr." value={song.track_number} />
              <InfoRow icon={Hash} label="Song-ID" value={song.song_id} />
              <InfoRow icon={Gauge} label="BPM" value={song.bpm} />
              <InfoRow icon={Key} label="Tonart" value={song.tonart} />
              <InfoRow icon={Clock} label="Länge" value={song.laenge} />
              <InfoRow icon={FileText} label="Version" value={song.version} />
            </div>
          </div>

          <Separator />

          {/* Rights & Identifiers */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Rechte & Identifikation</h4>
            <div className="grid grid-cols-1 gap-x-4 bg-card rounded-lg border border-border p-3">
              <InfoRow icon={User} label="Komponist" value={song.komponist} />
              <InfoRow icon={User} label="Textdichter" value={song.textdichter} />
              <InfoRow icon={FileCheck} label="ISRC" value="auf Anfrage" />
              <InfoRow icon={FileCheck} label="ISWC" value="auf Anfrage" />
              <InfoRow icon={Building2} label="GEMA-Werknummer" value="auf Anfrage" />
              <InfoRow icon={Shield} label="GEMA-Status" value={song.gema_status} />
            </div>
          </div>

          <Separator />

          {/* Contract & Revenue */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Vertrag & Umsatz</h4>
            <div className="grid grid-cols-2 gap-x-4 bg-card rounded-lg border border-border p-3">
              <InfoRow icon={FileText} label="Vertragsart" value={song.vertragsart} />
              <InfoRow icon={Shield} label="Exklusivität" value={song.exklusivitaet} />
              <InfoRow icon={Calendar} label="Vertragsbeginn" value={song.vertragsbeginn} />
              <InfoRow icon={Calendar} label="Vertragsende" value={song.vertragsende} />
              <InfoRow icon={DollarSign} label="Einnahmequelle" value={song.einnahmequelle} />
              <InfoRow icon={DollarSign} label="Jahresumsatz" value={song.jahresumsatz ? `${song.jahresumsatz} €` : null} />
              <InfoRow icon={DollarSign} label="Katalogwert" value={song.katalogwert ? `${song.katalogwert} €` : null} />
            </div>
          </div>

          {/* Shares */}
          {(song.anteil_komponist || song.anteil_text || song.anteil_verlag) && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Anteile</h4>
                <div className="grid grid-cols-3 gap-2">
                  {song.anteil_komponist !== null && song.anteil_komponist !== undefined && (
                    <div className="bg-card rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-bold text-primary">{song.anteil_komponist}%</p>
                      <p className="text-xs text-muted-foreground">Komponist</p>
                    </div>
                  )}
                  {song.anteil_text !== null && song.anteil_text !== undefined && (
                    <div className="bg-card rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-bold text-primary">{song.anteil_text}%</p>
                      <p className="text-xs text-muted-foreground">Text</p>
                    </div>
                  )}
                  {song.anteil_verlag !== null && song.anteil_verlag !== undefined && (
                    <div className="bg-card rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-bold text-primary">{song.anteil_verlag}%</p>
                      <p className="text-xs text-muted-foreground">Verlag</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {song.bemerkungen && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bemerkungen</h4>
                <div className="bg-card rounded-lg border border-border p-3">
                  <p className="text-sm text-muted-foreground">{song.bemerkungen}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
