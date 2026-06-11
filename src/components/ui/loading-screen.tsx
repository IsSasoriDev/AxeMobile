import { useState, useEffect, useRef, useMemo } from "react";
import { Pickaxe } from "lucide-react";
import { TypingText } from "./typing-text";
import { CinematicIntro } from "./cinematic-intro";
import { AtlasIntro } from "./atlas-intro";
import { useTheme } from "@/hooks/useTheme";
import powerMiningLogo from "@/assets/powermining-logo.png";
import ixtechLogo from "@/assets/ixtech-logo.png";
import dtvLogo from "@/assets/dtv-electronics-logo.png";

interface LoadingScreenProps {
  onComplete: () => void;
}

function SparkleParticles() {
  const particles = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 30 + Math.random() * 25;
      return {
        tx: `${Math.cos(angle) * distance}px`,
        ty: `${Math.sin(angle) * distance}px`,
        delay: `${Math.random() * 0.3}s`,
        duration: `${0.5 + Math.random() * 0.4}s`,
        size: 2 + Math.random() * 3,
      };
    }), []);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full bg-primary"
          style={{
            width: p.size,
            height: p.size,
            '--tx': p.tx,
            '--ty': p.ty,
            animation: `sparkle-burst ${p.duration} ${p.delay} ease-out forwards`,
            boxShadow: '0 0 6px hsl(var(--primary) / 0.8)',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [textDone, setTextDone] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const { theme } = useTheme();
  const isPowerMining = theme === "powermining";
  const isIxTech = theme === "ixtech";
  const isDTV = theme === "dtv";
  const isAtlas = theme === "atlas";
  const progressRef = useRef(0);

  // Animate progress bar from 0 to 100
  useEffect(() => {
    if (isDTV || isAtlas) return;
    const duration = 2200;
    const steps = 60;
    const increment = 100 / steps;
    const interval = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= 100) {
        current = 100;
        clearInterval(timer);
        progressRef.current = 100;
        setTimeout(() => {
          setShowSparkles(true);
          setFadeOut(true);
          setTimeout(() => onComplete(), 600);
        }, 300);
      }
      progressRef.current = current;
      setProgress(current);
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete, isDTV, isAtlas]);

  if (isDTV) return <CinematicIntro onComplete={onComplete} />;
  if (isAtlas) return <AtlasIntro onComplete={onComplete} />;

  const brandName = isPowerMining ? "PowerMining" : isIxTech ? "IxTech" : "AxeMobile";
  const tagline = isPowerMining ? "Professional Mining Solutions" : isIxTech ? "Innovation & Technology" : "Unleash the Open Source power";

  // Sync typing to finish exactly with the progress bar (~2200ms)
  // Account for setTimeout overhead (~10ms per step) so typing lands with bar
  const typingSpeed = Math.max(30, Math.floor((2200 - brandName.length * 10) / brandName.length));

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-all duration-600 ${fadeOut ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
      {/* Background patterns per theme */}
      {isPowerMining ? (
        <>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(var(--primary) / 0.3), transparent 50%), radial-gradient(circle at 70% 60%, hsl(var(--accent) / 0.2), transparent 50%)',
          }} />
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `linear-gradient(0deg, hsl(var(--primary) / 0.15) 1px, transparent 1px)`,
            backgroundSize: '100% 4px',
          }} />
        </>
      ) : isIxTech ? (
        <>
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(var(--primary) / 0.08), transparent 60%)',
          }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--primary)) 0, hsl(var(--primary)) 1px, transparent 0, transparent 40px), repeating-linear-gradient(0deg, hsl(var(--primary)) 0, hsl(var(--primary)) 1px, transparent 0, transparent 40px)`,
          }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.3) 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.12),transparent_60%)]" />
        </>
      )}

      <div className="relative flex flex-col items-center justify-center space-y-8">
        {/* Logo / Icon */}
        <div className="relative">
          {isPowerMining ? (
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-primary/10 animate-[pm-ring-pulse_2s_ease-in-out_infinite]" />
              <div className="absolute -inset-8 rounded-full border border-primary/10 animate-[pm-ring-expand_3s_ease-in-out_infinite]" />
              <img src={powerMiningLogo} alt="PowerMining" className="w-20 h-20 object-contain relative z-10 animate-float" style={{
                filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.4))',
              }} />
              {showSparkles && <SparkleParticles />}
            </div>
          ) : isIxTech ? (
            <div className="relative">
              <div className="absolute -inset-3 rounded-2xl border border-primary/20 animate-[ix-box-glow_2.5s_ease-in-out_infinite]" />
              <div className="absolute -inset-6 rounded-3xl border border-primary/10 animate-[ix-box-glow_2.5s_ease-in-out_infinite_0.5s]" />
              <img src={ixtechLogo} alt="IxTech" className="w-20 h-20 object-contain relative z-10 animate-float" style={{
                filter: 'drop-shadow(0 0 15px hsl(var(--primary) / 0.3))',
              }} />
              {showSparkles && <SparkleParticles />}
            </div>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-primary/20 animate-glow-pulse" />
              <div className="relative w-20 h-20 rounded-2xl bg-card border border-primary/30 flex items-center justify-center neon-glow">
                <Pickaxe className="h-10 w-10 text-primary" />
              </div>
              {showSparkles && <SparkleParticles />}
            </div>
          )}
        </div>

        {/* Brand name + tagline */}
        <div className="text-center space-y-3">
          <h1 className={`text-4xl font-black font-mono tracking-tight transition-all duration-700 ${
            isPowerMining ? 'text-primary' : isIxTech ? 'text-primary' : 'text-primary neon-text'
          } ${textDone ? 'drop-shadow-[0_0_24px_hsl(var(--primary)/0.6)]' : ''}`}
            style={{
              ...(isPowerMining ? { textShadow: textDone ? '0 0 30px hsl(var(--primary) / 0.6), 0 0 60px hsl(var(--primary) / 0.25)' : '0 0 20px hsl(var(--primary) / 0.4)' } 
                : isIxTech ? { textShadow: textDone ? '0 0 25px hsl(var(--primary) / 0.5), 0 0 50px hsl(var(--primary) / 0.2)' : '0 0 15px hsl(var(--primary) / 0.3)' } 
                : {}),
              ...(textDone ? { backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--foreground)), hsl(var(--primary)))', backgroundSize: '200% 100%', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', animation: 'shimmer 2s ease-in-out infinite' } : {}),
            }}
          >
            <TypingText text={brandName} typingSpeed={typingSpeed} deletingSpeed={0} pauseDuration={600} loop={false} onComplete={() => setTextDone(true)} />
          </h1>
          <p className="text-sm text-muted-foreground font-mono tracking-wider uppercase">{tagline}</p>
        </div>

        {/* Progress bar */}
        <div className="w-56 space-y-1.5">
          <div className={`w-full h-[3px] rounded-full overflow-hidden ${
            isPowerMining ? 'bg-primary/10' : isIxTech ? 'bg-primary/10' : 'bg-border/50'
          }`}>
            <div
              className="h-full rounded-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: isPowerMining
                  ? `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))`
                  : isIxTech
                  ? `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`
                  : `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))`,
                boxShadow: (() => {
                  const intensity = Math.max(0, (progress - 50) / 50);
                  const base = isPowerMining
                    ? `0 0 ${10 + intensity * 15}px hsl(var(--primary) / ${0.5 + intensity * 0.4})`
                    : isIxTech
                    ? `0 0 ${8 + intensity * 12}px hsl(var(--primary) / ${0.4 + intensity * 0.4})`
                    : `0 0 ${intensity * 15}px hsl(var(--primary) / ${intensity * 0.6})`;
                  return progress > 50 ? base : (isPowerMining ? `0 0 10px hsl(var(--primary) / 0.5)` : isIxTech ? `0 0 8px hsl(var(--primary) / 0.4)` : 'none');
                })(),
              }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground/60 font-mono text-center tracking-widest">
            {progress < 100 ? `Loading... ${Math.round(progress)}%` : 'Ready'}
          </p>
        </div>
      </div>

      {/* PowerMining: scanning line effect */}
      {isPowerMining && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            style={{ animation: 'scan 3s linear infinite' }} />
        </div>
      )}

      {/* IxTech: corner accents */}
      {isIxTech && (
        <>
          <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-primary/30 rounded-tl-lg" />
          <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-primary/30 rounded-tr-lg" />
          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-primary/30 rounded-bl-lg" />
          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-primary/30 rounded-br-lg" />
        </>
      )}
    </div>
  );
}
