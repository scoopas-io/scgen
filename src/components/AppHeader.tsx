import { Link, useLocation } from "react-router-dom";
import { Music, Zap, Database, Volume2, ListMusic, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoopasIcon } from "@/components/ScoopasIcon";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  stats: { artists: number; albums: number; songs: number };
  onOpenSunoDialog?: () => void;
}

export const AppHeader = ({ stats, onOpenSunoDialog }: AppHeaderProps) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Generator", icon: Zap },
    { path: "/songkatalog", label: "Songkatalog", icon: ListMusic },
    { path: "/social-tools", label: "Social-Tools", icon: Share2 },
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
            {onOpenSunoDialog && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={onOpenSunoDialog}
              >
                <Volume2 className="h-4 w-4" />
                <span className="hidden sm:inline">scoopas.ai Alben</span>
              </Button>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>{stats.artists}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-primary" />
                <span>{stats.albums}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>{stats.songs}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
