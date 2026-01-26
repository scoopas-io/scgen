import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo/Brand - matching header style */}
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
              <span className="text-foreground">sc<span className="text-primary">oo</span>pas</span>
            </h1>
            <span className="text-[10px] md:text-xs font-sans font-bold tracking-[0.25em] text-muted-foreground uppercase -mt-1">
              Musikkatalog
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Bitte Passwort eingeben, um fortzufahren
          </p>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                "pr-10 h-12 text-center text-lg tracking-widest bg-card border-border/50",
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
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">
              Falsches Passwort
            </p>
          )}

          <Button type="submit" className="w-full h-12 font-semibold" disabled={!password}>
            Anmelden
          </Button>
        </form>
      </div>
    </div>
  );
}
