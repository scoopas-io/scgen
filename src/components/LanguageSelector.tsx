import { useState } from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "he", name: "עברית", flag: "🇮🇱" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms", name: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "tl", name: "Filipino", flag: "🇵🇭" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
  { code: "da", name: "Dansk", flag: "🇩🇰" },
  { code: "fi", name: "Suomi", flag: "🇫🇮" },
  // 10 additional languages
  { code: "no", name: "Norsk", flag: "🇳🇴" },
  { code: "el", name: "Ελληνικά", flag: "🇬🇷" },
  { code: "cs", name: "Čeština", flag: "🇨🇿" },
  { code: "hu", name: "Magyar", flag: "🇭🇺" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
  { code: "bg", name: "Български", flag: "🇧🇬" },
  { code: "hr", name: "Hrvatski", flag: "🇭🇷" },
  { code: "sk", name: "Slovenčina", flag: "🇸🇰" },
  { code: "sr", name: "Српски", flag: "🇷🇸" },
  { code: "sw", name: "Kiswahili", flag: "🇰🇪" },
];

interface LanguageSelectorProps {
  selectedLanguages: string[];
  onLanguagesChange: (languages: string[]) => void;
}

export function LanguageSelector({ selectedLanguages, onLanguagesChange }: LanguageSelectorProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleLanguage = (code: string) => {
    if (selectedLanguages.includes(code)) {
      onLanguagesChange(selectedLanguages.filter((l) => l !== code));
    } else {
      onLanguagesChange([...selectedLanguages, code]);
    }
  };

  const clearAll = () => onLanguagesChange([]);
  const selectAll = () => onLanguagesChange(LANGUAGES.map((l) => l.code));

  const displayedLanguages = expanded ? LANGUAGES : LANGUAGES.slice(0, 10);

  const getSelectedNames = () => {
    return selectedLanguages
      .map((code) => LANGUAGES.find((l) => l.code === code))
      .filter(Boolean)
      .map((l) => l!.name)
      .join(", ");
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Sprachen</h3>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 px-2">
            Keine
          </Button>
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7 px-2">
            Alle
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {displayedLanguages.map((lang) => {
          const isSelected = selectedLanguages.includes(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => toggleLanguage(lang.code)}
              className={cn(
                "px-2 py-1 rounded-full text-xs font-medium transition-all",
                "border flex items-center gap-1",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-secondary-foreground border-border hover:border-primary/50"
              )}
            >
              {isSelected && <Check className="h-2.5 w-2.5" />}
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          );
        })}
      </div>

      {LANGUAGES.length > 10 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-muted-foreground h-7"
        >
          {expanded ? "Weniger" : `+${LANGUAGES.length - 10} mehr`}
        </Button>
      )}

      {selectedLanguages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedLanguages.length} Sprache{selectedLanguages.length > 1 ? "n" : ""} ausgewählt
        </p>
      )}
      {selectedLanguages.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Keine Auswahl = Deutsch als Standard
        </p>
      )}
    </div>
  );
}

export { LANGUAGES };
