import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative">
        <div className="h-20 w-20 rounded-full gradient-gold animate-pulse-glow flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-display font-medium text-foreground">
          Generiere Künstler...
        </p>
        <p className="text-sm text-muted-foreground">
          KI erstellt einzigartige Artist-Profile
        </p>
      </div>
      
      {/* Skeleton cards */}
      <div className="w-full max-w-2xl space-y-4 mt-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-shimmer"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
