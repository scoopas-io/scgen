
# Plan: Alternative Song-Versionen (Version 2) nachladen

## Analyse der aktuellen Situation

Die Suno API generiert bei jedem Aufruf **2 verschiedene Versionen** eines Songs:
- `songsArray[0]` → Version 1 (aktuell verwendet)
- `songsArray[1]` → Version 2 (wird verworfen)

Aktuell wird nur die erste Version gespeichert und die zweite geht verloren.

## Lösungskonzept

Eine neue Funktion ermöglicht es, die **zweite Version nachträglich für einzelne Alben** abzurufen und als alternative Version zu speichern.

```text
┌─────────────────────────────────────────────────────────────┐
│  Album: "Salzwasser im Blut"                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Hafenlichter        ▶️  [V2 laden]                   ││
│  │ 2. Nebelbank           ▶️  [V2 laden]                   ││
│  │ 2. Nebelbank (Ver. 2)  ▶️  ✓ Alternative                ││
│  │ 3. Seemannsblut        ▶️  [V2 laden]                   ││
│  └─────────────────────────────────────────────────────────┘│
│  [Album V2 laden] - Alle alternativen Versionen abrufen     │
└─────────────────────────────────────────────────────────────┘
```

## Implementierungs-Schritte

### 1. Datenbank-Erweiterung
Neue Spalte `alternative_audio_url` zur `songs`-Tabelle hinzufügen:

```sql
ALTER TABLE songs ADD COLUMN alternative_audio_url TEXT;
ALTER TABLE songs ADD COLUMN alternative_suno_audio_id TEXT;
```

### 2. Neue Edge Function: `fetch-alternative-version`
Eine neue Backend-Funktion, die gezielt die zweite Version eines bereits generierten Songs abruft:

- **Input**: `taskId` (vom ursprünglichen Generierungsaufruf)
- **Aktion**: Suno API Status abfragen → `songsArray[1]` extrahieren
- **Output**: Audio herunterladen, als `songname_ver_2.mp3` speichern

```typescript
// Pseudocode
const statusData = await fetch(`https://api.sunoapi.org/api/v1/task/${taskId}`);
const songsArray = statusData.data?.data || [];
const secondVersion = songsArray[1]; // Version 2
if (secondVersion?.audio_url) {
  // Download und speichern als alternative Version
}
```

### 3. UI-Erweiterung in ArtistAlbumsSection
Neue Buttons für Songs und Alben:

**Pro Song:**
- Button "V2" neben Songs, die bereits eine `audio_url` haben aber keine `alternative_audio_url`
- Zeigt "✓ V2" wenn alternative Version existiert

**Pro Album:**
- Button "Album V2 laden" zum Batch-Abruf aller zweiten Versionen

### 4. Callback-Erweiterung
`suno-callback` anpassen, um bei neuen Generierungen **optional beide Versionen** zu speichern:
- Primäre Version → `audio_url`
- Alternative Version → `alternative_audio_url`

### 5. Player-Integration
Im Audio-Player eine Umschaltmöglichkeit zwischen Version 1 und Version 2 anzeigen, wenn beide vorhanden sind.

## Technische Details

### Dateinamenskonvention
```
Künstler_Songtitel_1234567890.mp3      → Version 1
Künstler_Songtitel_ver2_1234567890.mp3 → Version 2
```

### Einschränkung
Die zweite Version kann nur abgerufen werden, solange die Suno API Task-Daten noch verfügbar sind (typischerweise 24-48 Stunden nach Generierung). Für ältere Songs ohne gespeicherte `suno_task_id` ist ein Nachladen nicht möglich.

## Zusammenfassung der Änderungen

| Komponente | Änderung |
|------------|----------|
| **Datenbank** | +2 Spalten: `alternative_audio_url`, `alternative_suno_audio_id` |
| **Edge Functions** | Neue Funktion `fetch-alternative-version` |
| **suno-callback** | Erweitern für optionale Dual-Speicherung |
| **ArtistAlbumsSection** | Buttons für V2-Abruf (Song + Album) |
| **GlobalAudioPlayer** | Umschalter zwischen Versionen |
| **Katalog-Anzeige** | Alternative Versionen als separate Einträge oder Toggle |
