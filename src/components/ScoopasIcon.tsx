import scoopasIcon from "@/assets/scoopas-icon.svg";

interface ScoopasIconProps {
  className?: string;
  size?: number;
}

export function ScoopasIcon({ className = "", size = 24 }: ScoopasIconProps) {
  return (
    <img 
      src={scoopasIcon} 
      alt="Scoopas" 
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
