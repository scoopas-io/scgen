import { Link, useLocation } from "react-router-dom";
import { Music, Zap, Database, Volume2, Share2, Users, Disc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoopasIcon } from "@/components/ScoopasIcon";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  stats: { artists: number; albums: number; songs: number };
}

export const AppHeader = ({ stats }: AppHeaderProps) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Generator", icon: Zap },
    { path: "/katalog", label: "Katalog", icon: Database },
    { path: "/audio-generator", label: "Audio", icon: Volume2 },
    { path: "/social-tools", label: "Social", icon: Share2 },
  ];

  return (
    <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
      <div className="container py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
                <span className="text-foreground">KI Musikkatalog</span>{" "}
                <span className="text-gradient-gold">Generator</span>
              </h1>
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <ScoopasIcon size={16} />
              <span className="text-xs font-medium text-primary">
                Powered by scoopas.AI
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <Button
                  key={path}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2",
                    location.pathname === path && "bg-primary/10 text-primary"
                  )}
                  asChild
                >
                  <Link to={path}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5" title="Künstler">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{stats.artists}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Alben">
                <Disc className="h-3.5 w-3.5 text-primary" />
                <span>{stats.albums}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Songs">
                <Music className="h-3.5 w-3.5 text-primary" />
                <span>{stats.songs}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
