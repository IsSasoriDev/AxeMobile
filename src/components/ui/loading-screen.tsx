import { useState, useEffect } from "react";
import { Pickaxe } from "lucide-react";
import { TypingText } from "./typing-text";
import { useTheme } from "@/hooks/useTheme";
import powerMiningLogo from "@/assets/powermining-logo.png";
import ixtechLogo from "@/assets/ixtech-logo.png";
import dtvLogo from "@/assets/dtv-electronics-logo.png";

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [showText, setShowText] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const { theme } = useTheme();
  const isPowerMining = theme === "powermining";
  const isIxTech = theme === "ixtech";
  const isDTV = theme === "dtv";

  const handleTypingComplete = () => {
    // Immediately start fade out when typing completes
    setFadeOut(true);
    
    // Complete loading after fade
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-all duration-1000 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center justify-center space-y-6">
        {isPowerMining ? (
          <div className="relative">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <img 
                src={powerMiningLogo} 
                alt="PowerMining" 
                className="w-24 h-24 object-contain animate-pulse"
              />
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-accent/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>
        ) : isIxTech ? (
          <div className="relative">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <img 
                src={ixtechLogo} 
                alt="IxTech" 
                className="w-24 h-24 object-contain animate-[ixtech-float_3s_ease-in-out_infinite]"
              />
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-[ixtech-glow_2s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-full bg-accent/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>
        ) : isDTV ? (
          <div className="relative">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <img 
                src={dtvLogo} 
                alt="DTV Electronics" 
                className="w-24 h-24 object-contain animate-pulse"
              />
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-accent/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>
        ) : (
          <div className="relative">
            <Pickaxe className="h-16 w-16 text-primary animate-pulse" />
            <div className="absolute inset-0 h-16 w-16 rounded-full bg-primary/20 animate-ping" />
          </div>
        )}
        
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            <TypingText 
              text={isPowerMining ? "PowerMining" : isIxTech ? "IxTech" : isDTV ? "DTV Electronics" : "AxeMobile"}
              onComplete={handleTypingComplete}
              typingSpeed={100}
              deletingSpeed={0}
              pauseDuration={800}
              loop={false}
            />
          </h1>
          <p className="text-muted-foreground">
            {isPowerMining ? "Professional Mining Solutions" : isIxTech ? "Innovation & Technology" : isDTV ? "EST. BLOCK 723,420" : "Unleash the Open Source power"}
          </p>
        </div>
      </div>
    </div>
  );
}