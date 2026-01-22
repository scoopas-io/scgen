interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Lade..." }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-3">
        <div className="relative">
          <div className="h-10 w-10 border-2 border-primary/30 rounded-full mx-auto" />
          <div className="absolute inset-0 h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
