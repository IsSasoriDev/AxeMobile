import { useState, useEffect } from "react";
import { Pickaxe } from "lucide-react";
import { TypingText } from "./typing-text";

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [showText, setShowText] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  const handleTypingComplete = () => {
    setShowText(false);
    // Start fade out after text deletion
    setTimeout(() => {
      setFadeOut(true);
    }, 500);
    
    // Complete loading after fade
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-all duration-1000 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <Pickaxe className="h-16 w-16 text-primary animate-pulse" />
          <div className="absolute inset-0 h-16 w-16 rounded-full bg-primary/20 animate-ping" />
        </div>
        
        {showText && (
          <div className="text-center animate-fade-in">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              <TypingText 
                text="AxeMobile" 
                onComplete={handleTypingComplete}
                typingSpeed={150}
                deletingSpeed={80}
                pauseDuration={1200}
                loop={false}
              />
            </h1>
            <p className="text-muted-foreground">
              Unleash the Open Source power
            </p>
          </div>
        )}
      </div>
    </div>
  );
}