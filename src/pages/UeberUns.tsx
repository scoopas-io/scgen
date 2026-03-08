import { Sparkles, Cpu, Zap, Globe, HeartHandshake, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppHeader } from "@/components/AppHeader";
import { useCatalogData } from "@/hooks/useCatalogData";
import { usePlayerHeight } from "@/components/GlobalAudioPlayer";

const PILLARS = [
  {
    icon: Cpu,
    title: "100% KI-generiert",
    description:
      "Jeder Künstler, jede Melodie, jeder Text – vollständig durch künstliche Intelligenz erschaffen. Kein menschlicher Songwriter, kein Studio.",
  },
  {
    icon: Globe,
    title: "Globale Genres",
    description:
      "Von Jazz über Techno bis Chamber Folk: Unsere KI beherrscht dutzende Stile und erschafft Musik über alle kulturellen Grenzen hinweg.",
  },
  {
    icon: Zap,
    title: "Immer aktuell",
    description:
      "Der Katalog wächst kontinuierlich. Neue Künstler und Titel werden automatisch generiert und direkt verfügbar gemacht.",
  },
  {
    icon: HeartHandshake,
    title: "Lizenzfrei & transparent",
    description:
      "Alle Werke sind KI-generiert und vollständig dokumentiert – inklusive GEMA-Status, ISRC und Rechteinhabern.",
  },
];

const TIMELINE = [
  { year: "2024", label: "Gründung", desc: "Idee: Eine Streamingplattform, deren gesamter Katalog von KI erschaffen wird." },
  { year: "2025", label: "Erste Künstler", desc: "Die ersten 50 KI-Künstler werden mit Personas, Alben und Titeln generiert." },
  { year: "2026", label: "Scoopify Launch", desc: "Öffentlicher Start von Scoopify – der ersten reinen KI-Streamingplattform." },
];

export default function UeberUns() {
  const { stats } = useCatalogData();
  const playerHeight = usePlayerHeight();

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader stats={stats} />
      <ScrollArea className="flex-1">
        <div
          className="w-full max-w-[100vw] overflow-x-hidden px-3 md:px-6 pt-6"
          style={{ paddingBottom: Math.max(playerHeight + 24, 48) }}
        >

          {/* ── Hero Card ─────────────────────────────────────────────── */}
          <div
            className="relative rounded-2xl overflow-hidden mb-10"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(260 30% 10%) 100%)",
              boxShadow: "inset 0 0 80px 0 hsl(320 90% 55% / 0.12), inset 0 0 40px 0 hsl(260 80% 60% / 0.08)",
            }}
          >
            {/* Grid texture */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            {/* Glow blobs */}
            <div
              className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, hsl(320 90% 55%), transparent 70%)" }}
            />
            <div
              className="absolute bottom-0 right-0 w-56 h-56 rounded-full opacity-15 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, hsl(260 80% 60%), transparent 70%)" }}
            />

            <div className="relative p-6 sm:p-10 md:p-14 flex flex-col items-center text-center">
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-semibold uppercase mb-5"
                style={{ fontSize: "clamp(0.55rem, 2vw, 0.7rem)", letterSpacing: "0.08em" }}
              >
                <Sparkles className="h-2.5 w-2.5 shrink-0" />
                <span>Wer wir sind</span>
              </div>
              <h1
                className="font-display font-bold leading-tight mb-4"
                style={{ fontSize: "clamp(2rem, 6vw, 4rem)" }}
              >
                <span className="text-foreground">Die Zukunft der</span>
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(320 90% 65%), hsl(340 85% 55%), hsl(280 80% 65%))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Musikproduktion.
                </span>
              </h1>
              <p
                className="text-muted-foreground max-w-xl leading-relaxed"
                style={{ fontSize: "clamp(0.85rem, 1.5vw, 1.05rem)" }}
              >
                Scoopify ist die erste Streaming-Plattform, deren gesamter Katalog vollständig von
                künstlicher Intelligenz erschaffen wurde. Kein Mensch hat eine Note gespielt oder
                einen Text geschrieben – und doch klingt es lebendig.
              </p>
            </div>
          </div>

          {/* ── Pillars ────────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-1.5 mb-6">
              <Radio className="h-4 w-4 text-primary" />
              <h2 className="font-display font-bold text-xl">Unsere Grundsätze</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PILLARS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/60 bg-card/40 p-5 flex gap-4 hover:bg-card/70 transition-colors"
                >
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">{title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Stats Row ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-border/60 bg-card/40 p-6 mb-12 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center"
          >
            {[
              { value: stats.artists, label: "KI-Künstler" },
              { value: stats.albums, label: "Alben" },
              { value: stats.songs, label: "Titel gesamt" },
              { value: "100%", label: "KI-generiert" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center">
                <span
                  className="font-display font-bold leading-none mb-1"
                  style={{
                    fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)",
                    background:
                      "linear-gradient(135deg, hsl(var(--foreground)), hsl(var(--primary)))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {value}
                </span>
                <span
                  className="text-muted-foreground uppercase"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.06em" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Timeline ───────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-1.5 mb-6">
              <Music className="h-4 w-4 text-primary" />
              <h2 className="font-display font-bold text-xl">Unsere Geschichte</h2>
            </div>
            <div className="relative pl-6 border-l-2 border-border/50 space-y-8">
              {TIMELINE.map(({ year, label, desc }) => (
                <div key={year} className="relative">
                  <div className="absolute -left-[1.55rem] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                  <p
                    className="text-primary font-semibold uppercase mb-0.5"
                    style={{ fontSize: "0.65rem", letterSpacing: "0.08em" }}
                  >
                    {year}
                  </p>
                  <h3 className="font-bold text-sm mb-1">{label}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Mission Statement ──────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden p-6 sm:p-10 text-center mb-6"
            style={{
              background:
                "linear-gradient(135deg, hsl(320 90% 55% / 0.12), hsl(260 80% 60% / 0.08))",
              border: "1px solid hsl(320 90% 55% / 0.2)",
            }}
          >
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-4 opacity-80" />
            <blockquote
              className="font-display font-bold leading-tight mb-3"
              style={{
                fontSize: "clamp(1.1rem, 3vw, 1.8rem)",
                background:
                  "linear-gradient(135deg, hsl(320 90% 65%), hsl(340 85% 55%), hsl(280 80% 65%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              „Musik kennt keine Grenzen – auch keine menschlichen."
            </blockquote>
            <p className="text-muted-foreground text-sm">— Das Scoopify-Team</p>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
