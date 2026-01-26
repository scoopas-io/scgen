import { Link, useLocation } from "react-router-dom";
import { Music, Zap, Database, Volume2, Share2, Users, Disc, Menu, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoopasIcon } from "@/components/ScoopasIcon";
import { HeaderMiniPlayer } from "@/components/GlobalAudioPlayer";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AppHeaderProps {
  stats: { artists: number; albums: number; songs: number };
}

export const AppHeader = ({ stats }: AppHeaderProps) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/erweitern", label: "Erweitern", icon: Zap },
    { path: "/katalog", label: "Katalog", icon: Database },
    { path: "/audio-generator", label: "Audio", icon: Volume2 },
    { path: "/social-tools", label: "Social", icon: Share2 },
  ];

  return (
    <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
      <div className="container py-3 md:py-4 px-3 md:px-6">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0">
              <h1 className="text-base md:text-xl lg:text-2xl font-display font-bold tracking-tight truncate">
                <span className="text-foreground">sc<span className="text-primary">oo</span>pas</span>{" "}
                <span className="text-gradient-primary hidden xs:inline">Musik</span>
              </h1>
            </Link>
          </div>

          {/* Desktop Nav */}
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

          {/* Right side: Stats + Mini Player + Mobile Menu */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Stats - hidden on mobile */}
            <div className="hidden sm:flex items-center gap-2 md:gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1" title="Künstler">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{stats.artists}</span>
              </div>
              <div className="flex items-center gap-1" title="Alben">
                <Disc className="h-3.5 w-3.5 text-primary" />
                <span>{stats.albums}</span>
              </div>
              <div className="flex items-center gap-1" title="Songs">
                <Music className="h-3.5 w-3.5 text-primary" />
                <span>{stats.songs}</span>
              </div>
            </div>
            
            {/* Header Mini Player */}
            <HeaderMiniPlayer />

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-border">
                    <h2 className="font-semibold text-lg">Navigation</h2>
                  </div>
                  <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(({ path, label, icon: Icon }) => (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                          location.pathname === path 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-muted"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{label}</span>
                      </Link>
                    ))}
                  </nav>
                  {/* Mobile Stats */}
                  <div className="p-4 border-t border-border">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Users className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-sm font-medium">{stats.artists}</p>
                        <p className="text-xs text-muted-foreground">Künstler</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Disc className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-sm font-medium">{stats.albums}</p>
                        <p className="text-xs text-muted-foreground">Alben</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Music className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-sm font-medium">{stats.songs}</p>
                        <p className="text-xs text-muted-foreground">Songs</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};