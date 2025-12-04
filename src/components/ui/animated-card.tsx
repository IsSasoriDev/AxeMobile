import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  animation?: 'scale' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'bounce' | 'flip' | 'float' | 'fade';
}

export function AnimatedCard({ 
  children, 
  className, 
  delay = 0,
  animation = 'fade'
}: AnimatedCardProps) {
  const animationClass = animation === 'fade' 
    ? 'animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both'
    : {
        'scale': 'animate-scale-up',
        'slide-up': 'animate-slide-up',
        'slide-down': 'animate-slide-down',
        'slide-left': 'animate-slide-left',
        'slide-right': 'animate-slide-right',
        'bounce': 'animate-bounce-in',
        'flip': 'animate-flip-in',
        'float': 'animate-float',
      }[animation];

  return (
    <div
      className={cn(animationClass, className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
