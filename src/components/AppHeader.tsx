import { Link, useLocation } from "react-router-dom";
import { Music, Zap, Database, Volume2, Share2, Users, Disc, Menu, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoopasIcon } from "@/components/ScoopasIcon";
import { HeaderMiniPlayer } from "@/components/GlobalAudioPlayer";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { PersonaStatusDashboard } from "@/components/PersonaStatusDashboard";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppHeaderProps {
  stats: { artists: number; albums: number; songs: number; totalTracks?: number };
}

export const AppHeader = ({ stats }: AppHeaderProps) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAdmin, isViewer, logout, role } = useAuth();
  
  // All navigation items — adminOnly hides from viewers, viewerOnly hides from admins
  const allNavItems = [
    { path: "/", label: "Home", icon: Home, adminOnly: false, viewerOnly: false },
    { path: "/erweitern", label: "Erweitern", icon: Zap, adminOnly: true, viewerOnly: false },
    { path: "/katalog", label: "Katalog", icon: Database, adminOnly: true, viewerOnly: false },
    { path: "/kuenstler", label: "Künstler & Songs", icon: Music, adminOnly: false, viewerOnly: true },
    { path: "/audio-generator", label: "Audio", icon: Volume2, adminOnly: true, viewerOnly: false },
    { path: "/social-tools", label: "Social", icon: Share2, adminOnly: true, viewerOnly: false },
  ];

  // Filter nav items based on role
  const navItems = allNavItems.filter(item =>
    (!item.adminOnly || isAdmin) && (!item.viewerOnly || !isAdmin)
  );

  return (
    <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
      <div className="container py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Logo — scoopify for viewer, scoopas for admin */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Link to="/" className="flex flex-col min-w-0">
              {isAdmin ? (
                <>
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-display font-bold tracking-tight truncate">
                    <span className="text-foreground">sc<span className="text-primary">oo</span>pas</span>
                  </h1>
                  <span className="text-[9px] md:text-[10px] font-sans font-bold tracking-[0.25em] text-muted-foreground uppercase text-center -mt-1.5">
                    Musikkatalog
                  </span>
                </>
              ) : (
                <>
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-display font-bold tracking-tight truncate">
                    <span className="text-foreground">sc</span><span className="text-primary">oopi</span><span className="text-foreground">fy</span>
                  </h1>
                  <span className="text-[9px] md:text-[10px] font-sans font-bold tracking-[0.25em] text-muted-foreground uppercase text-center -mt-1.5">
                    KI-Musik
                  </span>
                </>
              )}
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

          {/* Right side: Role Badge + Stats + Mini Player + Logout + Mobile Menu */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Role Badge — only show for admins */}
            {isAdmin && (
              <Badge
                variant="default"
                className="text-[10px] px-2 py-0.5 hidden sm:inline-flex bg-primary/20 text-primary border-primary/30"
              >
                Admin
              </Badge>
            )}

            {/* Persona Status Dashboard - Admin only */}
            {isAdmin && <PersonaStatusDashboard />}

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
              <div className="flex items-center gap-1" title="Titel (V1+V2)">
                <Music className="h-3.5 w-3.5 text-primary" />
                <span>{stats.totalTracks ?? stats.songs}</span>
              </div>
            </div>
            
            {/* Header Mini Player */}
            <HeaderMiniPlayer />

            {/* Logout Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hidden sm:flex"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abmelden</TooltipContent>
            </Tooltip>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Navigation</h2>
                    <Badge 
                      variant={isAdmin ? "default" : "secondary"} 
                      className={cn(
                        "text-xs",
                        isAdmin && "bg-primary/20 text-primary"
                      )}
                    >
                      {isAdmin ? "Admin" : "Viewer"}
                    </Badge>
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
                  <div className="p-4 border-t border-border space-y-3">
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
                        <p className="text-sm font-medium">{stats.totalTracks ?? stats.songs}</p>
                        <p className="text-xs text-muted-foreground">Titel</p>
                      </div>
                    </div>
                    {/* Mobile Logout */}
                    <Button 
                      variant="outline" 
                      className="w-full gap-2" 
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Abmelden
                    </Button>
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