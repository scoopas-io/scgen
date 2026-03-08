import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(password);
    if (!success) {
      setError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-md scale-150" />
              <div className="relative bg-primary/10 border border-primary/20 rounded-full p-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-1">
            <span className="text-foreground">sc</span>
            <span className="text-primary">oopi</span>
            <span className="text-foreground">fy</span>
          </h1>
          <p className="text-[11px] font-sans font-bold tracking-[0.3em] text-muted-foreground uppercase">
            KI-Musik entdecken
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Passwort eingeben, um fortzufahren
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Passwort"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className={cn(
                "pr-10 h-12 text-center text-base tracking-widest bg-card/60 border-border/50",
                isShaking && "animate-shake",
                error && "border-destructive focus-visible:ring-destructive"
              )}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">Falsches Passwort</p>
          )}

          <Button type="submit" className="w-full h-12 font-semibold text-base rounded-xl" disabled={!password}>
            Weiter
          </Button>
        </form>
      </div>
    </div>
  );
}
