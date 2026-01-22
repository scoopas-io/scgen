import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-secondary/80 to-secondary/30 flex items-center justify-center mb-4 border border-border">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild variant="outline" size="sm">
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
