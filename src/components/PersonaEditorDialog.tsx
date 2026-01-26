import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, X, Mic, Music, Sliders, Sparkles, Plus, User } from "lucide-react";

interface Artist {
  id: string;
  name: string;
  genre: string;
  style: string;
  voice_prompt: string;
  personality: string;
  language?: string;
  profile_image_url?: string;
  // Persona fields
  vocal_gender?: string | null;
  vocal_texture?: string | null;
  vocal_range?: string | null;
  style_tags?: string[];
  mood_tags?: string[];
  negative_tags?: string[];
  default_bpm_min?: number | null;
  default_bpm_max?: number | null;
  preferred_keys?: string[];
  instrumental_only?: boolean;
  persona_name?: string | null;
  persona_description?: string | null;
  persona_active?: boolean;
}

interface PersonaEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: Artist | null;
  onSave?: () => void;
}

const VOCAL_TEXTURES = ["raspy", "smooth", "powerful", "breathy", "soulful", "gritty", "velvet", "nasal", "operatic"];
const VOCAL_RANGES = ["soprano", "alto", "mezzo-soprano", "tenor", "baritone", "bass"];
const MOOD_OPTIONS = ["melancholic", "energetic", "romantic", "aggressive", "dreamy", "dark", "uplifting", "rebellious", "introspective", "party", "chill", "epic", "intimate"];
const MUSICAL_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"];

export function PersonaEditorDialog({ open, onOpenChange, artist, onSave }: PersonaEditorDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    persona_name: "",
    persona_description: "",
    persona_active: true,
    vocal_gender: "" as string,
    vocal_texture: "",
    vocal_range: "",
    style_tags: [] as string[],
    mood_tags: [] as string[],
    negative_tags: [] as string[],
    default_bpm_min: null as number | null,
    default_bpm_max: null as number | null,
    preferred_keys: [] as string[],
    instrumental_only: false,
  });
  const [newStyleTag, setNewStyleTag] = useState("");
  const [newNegativeTag, setNewNegativeTag] = useState("");

  // Extract mood keywords from personality text
  const extractMoodFromPersonality = (personality: string): string[] => {
    const moodKeywords: Record<string, string[]> = {
      melancholic: ["melancholisch", "traurig", "sad", "melancholic", "schwermütig", "nachdenklich"],
      energetic: ["energisch", "dynamisch", "energetic", "kraftvoll", "lebendig", "vital"],
      romantic: ["romantisch", "romantic", "liebevoll", "zärtlich", "verträumt"],
      aggressive: ["aggressiv", "aggressive", "wütend", "rebellisch", "hart"],
      dreamy: ["verträumt", "dreamy", "träumerisch", "ethereal", "schwebend"],
      dark: ["dunkel", "dark", "düster", "finster", "mysteriös"],
      uplifting: ["aufbauend", "uplifting", "positiv", "hoffnungsvoll", "optimistisch"],
      rebellious: ["rebellisch", "rebellious", "aufrührerisch", "unangepasst"],
      introspective: ["introspektiv", "introspective", "nachdenklich", "tiefgründig"],
      party: ["party", "feier", "ausgelassen", "festlich"],
      chill: ["chill", "entspannt", "relaxed", "gelassen", "ruhig"],
      epic: ["episch", "epic", "grandios", "monumental"],
      intimate: ["intim", "intimate", "persönlich", "nah"],
    };
    
    const lowerPersonality = personality.toLowerCase();
    const foundMoods: string[] = [];
    
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(kw => lowerPersonality.includes(kw))) {
        foundMoods.push(mood);
      }
    }
    
    return foundMoods.slice(0, 3); // Max 3 moods
  };

  // Extract vocal characteristics from voice_prompt
  const extractVocalInfo = (voicePrompt: string): { gender: string; texture: string; range: string } => {
    const lower = voicePrompt.toLowerCase();
    
    // Gender detection
    let gender = "";
    if (lower.includes("male") || lower.includes("männlich") || lower.includes("man") || lower.includes("mann")) {
      gender = "m";
    } else if (lower.includes("female") || lower.includes("weiblich") || lower.includes("woman") || lower.includes("frau")) {
      gender = "f";
    }
    
    // Texture detection
    let texture = "";
    const textureMap: Record<string, string[]> = {
      raspy: ["raspy", "rau", "heiser", "kratzig"],
      smooth: ["smooth", "glatt", "weich", "sanft"],
      powerful: ["powerful", "kraftvoll", "stark", "mächtig"],
      breathy: ["breathy", "hauchig", "luftig"],
      soulful: ["soulful", "seelenvoll", "gefühlvoll"],
      gritty: ["gritty", "roh", "kernig"],
      velvet: ["velvet", "samt", "samtig"],
      nasal: ["nasal", "näselnd"],
      operatic: ["operatic", "opernhaft", "klassisch"],
    };
    
    for (const [tex, keywords] of Object.entries(textureMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        texture = tex;
        break;
      }
    }
    
    // Range detection
    let range = "";
    const rangeMap: Record<string, string[]> = {
      soprano: ["soprano", "sopran"],
      alto: ["alto", "alt"],
      "mezzo-soprano": ["mezzo", "mezzosopran"],
      tenor: ["tenor"],
      baritone: ["baritone", "bariton"],
      bass: ["bass", "basso"],
    };
    
    for (const [rng, keywords] of Object.entries(rangeMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        range = rng;
        break;
      }
    }
    
    return { gender, texture, range };
  };

  // Extract style tags from genre, style, and voice_prompt
  const extractStyleTags = (genre: string, style: string, voicePrompt: string): string[] => {
    const tags: string[] = [];
    
    // Add style as tag if not generic
    if (style && style.length > 2) {
      tags.push(style);
    }
    
    // Extract additional style hints from voice_prompt
    const styleHints = voicePrompt.match(/\b(acoustic|electronic|orchestral|minimalist|experimental|vintage|modern|retro|progressive|alternative|indie|mainstream)\b/gi);
    if (styleHints) {
      tags.push(...styleHints.map(s => s.toLowerCase()));
    }
    
    return [...new Set(tags)].slice(0, 5);
  };

  useEffect(() => {
    if (artist) {
      // Check if persona fields are mostly empty (first-time setup)
      const isFirstSetup = !artist.vocal_gender && !artist.vocal_texture && 
        (!artist.style_tags || artist.style_tags.length === 0) &&
        (!artist.mood_tags || artist.mood_tags.length === 0);
      
      if (isFirstSetup) {
        // Auto-derive from existing artist metadata
        const vocalInfo = extractVocalInfo(artist.voice_prompt);
        const derivedMoods = extractMoodFromPersonality(artist.personality);
        const derivedStyles = extractStyleTags(artist.genre, artist.style, artist.voice_prompt);
        
        setFormData({
          persona_name: artist.name,
          persona_description: artist.personality, // Use personality as description
          persona_active: true,
          vocal_gender: vocalInfo.gender,
          vocal_texture: vocalInfo.texture,
          vocal_range: vocalInfo.range,
          style_tags: derivedStyles,
          mood_tags: derivedMoods,
          negative_tags: [],
          default_bpm_min: null,
          default_bpm_max: null,
          preferred_keys: [],
          instrumental_only: artist.instrumental_only || false,
        });
      } else {
        // Use existing persona data
        setFormData({
          persona_name: artist.persona_name || artist.name,
          persona_description: artist.persona_description || artist.personality,
          persona_active: artist.persona_active ?? true,
          vocal_gender: artist.vocal_gender || "",
          vocal_texture: artist.vocal_texture || "",
          vocal_range: artist.vocal_range || "",
          style_tags: artist.style_tags || [],
          mood_tags: artist.mood_tags || [],
          negative_tags: artist.negative_tags || [],
          default_bpm_min: artist.default_bpm_min || null,
          default_bpm_max: artist.default_bpm_max || null,
          preferred_keys: artist.preferred_keys || [],
          instrumental_only: artist.instrumental_only || false,
        });
      }
    }
  }, [artist]);

  const handleSave = async () => {
    if (!artist) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("artists")
        .update({
          persona_name: formData.persona_name || null,
          persona_description: formData.persona_description || null,
          persona_active: formData.persona_active,
          vocal_gender: formData.vocal_gender || null,
          vocal_texture: formData.vocal_texture || null,
          vocal_range: formData.vocal_range || null,
          style_tags: formData.style_tags,
          mood_tags: formData.mood_tags,
          negative_tags: formData.negative_tags,
          default_bpm_min: formData.default_bpm_min,
          default_bpm_max: formData.default_bpm_max,
          preferred_keys: formData.preferred_keys,
          instrumental_only: formData.instrumental_only,
        })
        .eq("id", artist.id);

      if (error) throw error;

      toast.success("Persona gespeichert");
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving persona:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const addStyleTag = () => {
    if (newStyleTag.trim() && !formData.style_tags.includes(newStyleTag.trim())) {
      setFormData(prev => ({
        ...prev,
        style_tags: [...prev.style_tags, newStyleTag.trim()],
      }));
      setNewStyleTag("");
    }
  };

  const removeStyleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      style_tags: prev.style_tags.filter(t => t !== tag),
    }));
  };

  const addNegativeTag = () => {
    if (newNegativeTag.trim() && !formData.negative_tags.includes(newNegativeTag.trim())) {
      setFormData(prev => ({
        ...prev,
        negative_tags: [...prev.negative_tags, newNegativeTag.trim()],
      }));
      setNewNegativeTag("");
    }
  };

  const removeNegativeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      negative_tags: prev.negative_tags.filter(t => t !== tag),
    }));
  };

  const toggleMoodTag = (mood: string) => {
    setFormData(prev => ({
      ...prev,
      mood_tags: prev.mood_tags.includes(mood)
        ? prev.mood_tags.filter(m => m !== mood)
        : [...prev.mood_tags, mood],
    }));
  };

  const toggleKey = (key: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_keys: prev.preferred_keys.includes(key)
        ? prev.preferred_keys.filter(k => k !== key)
        : [...prev.preferred_keys, key],
    }));
  };

  if (!artist) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {artist.profile_image_url ? (
              <img src={artist.profile_image_url} alt={artist.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <span>Suno Persona: {artist.name}</span>
              <p className="text-sm font-normal text-muted-foreground">{artist.genre} • {artist.style}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Konfiguriere die Suno-Persona für konsistente Audio-Generierung
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <Tabs defaultValue="voice" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="voice" className="text-xs">
                <Mic className="h-3 w-3 mr-1" />
                Stimme
              </TabsTrigger>
              <TabsTrigger value="style" className="text-xs">
                <Music className="h-3 w-3 mr-1" />
                Stil
              </TabsTrigger>
              <TabsTrigger value="technical" className="text-xs">
                <Sliders className="h-3 w-3 mr-1" />
                Technik
              </TabsTrigger>
              <TabsTrigger value="meta" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Meta
              </TabsTrigger>
            </TabsList>

            {/* Voice Tab */}
            <TabsContent value="voice" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stimmgeschlecht</Label>
                    <Select 
                      value={formData.vocal_gender} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, vocal_gender: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-Erkennung" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-Erkennung</SelectItem>
                        <SelectItem value="m">Männlich</SelectItem>
                        <SelectItem value="f">Weiblich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Stimmlage</Label>
                    <Select 
                      value={formData.vocal_range} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, vocal_range: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {VOCAL_RANGES.map(range => (
                          <SelectItem key={range} value={range}>{range}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Stimmtextur</Label>
                  <div className="flex flex-wrap gap-2">
                    {VOCAL_TEXTURES.map(texture => (
                      <Badge 
                        key={texture}
                        variant={formData.vocal_texture === texture ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          vocal_texture: prev.vocal_texture === texture ? "" : texture 
                        }))}
                      >
                        {texture}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch 
                      checked={formData.instrumental_only}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, instrumental_only: checked }))}
                    />
                    Nur Instrumental (keine Vocals)
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4">
              <div className="space-y-2">
                <Label>Stil-Tags</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Tag hinzufügen..."
                    value={newStyleTag}
                    onChange={(e) => setNewStyleTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStyleTag())}
                  />
                  <Button size="icon" variant="outline" onClick={addStyleTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.style_tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeStyleTag(tag)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mood / Atmosphäre</Label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map(mood => (
                    <Badge 
                      key={mood}
                      variant={formData.mood_tags.includes(mood) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleMoodTag(mood)}
                    >
                      {mood}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Negative Tags (ausschließen)</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ausschließen..."
                    value={newNegativeTag}
                    onChange={(e) => setNewNegativeTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNegativeTag())}
                  />
                  <Button size="icon" variant="outline" onClick={addNegativeTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.negative_tags.map(tag => (
                    <Badge key={tag} variant="destructive" className="gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeNegativeTag(tag)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min. BPM</Label>
                  <Input 
                    type="number"
                    placeholder="z.B. 90"
                    value={formData.default_bpm_min || ""}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      default_bpm_min: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max. BPM</Label>
                  <Input 
                    type="number"
                    placeholder="z.B. 130"
                    value={formData.default_bpm_max || ""}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      default_bpm_max: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bevorzugte Tonarten</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MUSICAL_KEYS.map(key => (
                    <Badge 
                      key={key}
                      variant={formData.preferred_keys.includes(key) ? "default" : "outline"}
                      className="cursor-pointer text-xs px-2 py-0.5"
                      onClick={() => toggleKey(key)}
                    >
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Meta Tab */}
            <TabsContent value="meta" className="space-y-4">
              <div className="space-y-2">
                <Label>Persona-Name (Alias)</Label>
                <Input 
                  placeholder={artist.name}
                  value={formData.persona_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, persona_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Persona-Beschreibung</Label>
                <Textarea 
                  placeholder="Beschreibe den einzigartigen Stil dieser Persona..."
                  value={formData.persona_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, persona_description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Switch 
                    checked={formData.persona_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, persona_active: checked }))}
                  />
                  Persona aktiv (bei Generierung verwenden)
                </Label>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-gold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
