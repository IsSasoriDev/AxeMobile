import { useState, useEffect, useRef } from "react";
import dtvLogo from "@/assets/dtv-electronics-logo.png";
import { TypingText } from "./typing-text";

interface CinematicIntroProps {
  onComplete: () => void;
}

export function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [phase, setPhase] = useState<'blackhole' | 'growing' | 'consume' | 'logo' | 'text'>('blackhole');
  const [fadeOut, setFadeOut] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [showText, setShowText] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);

  // Keep ref in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Single timeline for all phase transitions
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Phase 1: Blackhole idle (1.5s)
    timers.push(setTimeout(() => setPhase('growing'), 1500));
    
    // Phase 2: Growing (1.5s)
    timers.push(setTimeout(() => setPhase('consume'), 3000));
    
    // Phase 3: Consume screen (1s)
    timers.push(setTimeout(() => {
      setPhase('logo');
      setShowLogo(true);
    }, 4000));
    
    // Phase 4: Show text (0.8s after logo)
    timers.push(setTimeout(() => {
      setPhase('text');
      setShowText(true);
    }, 4800));
    
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  // Black hole animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationId: number;
    let startTime = performance.now();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) + 100;
    
    // Particles for accretion disk
    const particles: Array<{
      angle: number;
      radius: number;
      baseRadius: number;
      speed: number;
      size: number;
      color: string;
      life: number;
    }> = [];

    for (let i = 0; i < 300; i++) {
      const layer = Math.floor(Math.random() * 3);
      const baseRadius = 70 + layer * 50 + Math.random() * 40;
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: baseRadius,
        baseRadius,
        speed: 0.01 + Math.random() * 0.02,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.3 
          ? `hsl(${25 + Math.random() * 15}, 100%, ${55 + Math.random() * 15}%)` 
          : 'hsl(0, 0%, 100%)',
        life: 0.6 + Math.random() * 0.4,
      });
    }

    // Stars background
    const stars: Array<{ x: number; y: number; size: number; brightness: number; vx: number; vy: number }> = [];
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 180 + Math.random() * Math.max(canvas.width, canvas.height);
      stars.push({
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        size: Math.random() * 2,
        brightness: 0.4 + Math.random() * 0.6,
        vx: 0,
        vy: 0,
      });
    }

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const currentPhase = phaseRef.current;
      
      // Stop animation when we're past consume phase
      if (currentPhase === 'logo' || currentPhase === 'text') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Calculate progress for each phase
      let growProgress = 0;
      let consumeProgress = 0;
      
      if (elapsed > 1.5 && elapsed <= 3) {
        growProgress = (elapsed - 1.5) / 1.5;
      } else if (elapsed > 3) {
        growProgress = 1;
        consumeProgress = Math.min((elapsed - 3) / 1, 1);
      }

      // Smooth easing
      const smoothGrow = growProgress * growProgress * (3 - 2 * growProgress);
      const smoothConsume = consumeProgress * consumeProgress * consumeProgress;

      // Clear with fade
      ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + smoothConsume * 0.4})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Black hole size
      const baseSize = 50 + Math.sin(elapsed * 2) * 5;
      const holeSize = baseSize + smoothGrow * 80 + smoothConsume * (maxRadius - 130);

      // Gravitational pull
      const pullStrength = 0.004 + smoothGrow * 0.02 + smoothConsume * 0.15;

      // Draw and update stars
      stars.forEach(star => {
        const dx = centerX - star.x;
        const dy = centerY - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > holeSize * 0.6) {
          star.vx += (dx / dist) * pullStrength;
          star.vy += (dy / dist) * pullStrength;
          star.x += star.vx;
          star.y += star.vy;
          star.vx *= 0.97;
          star.vy *= 0.97;
          
          // Lensing effect
          const lens = 3000 / (dist + 80);
          const lensX = star.x + (-dy / dist) * lens * Math.sin(elapsed * 1.5);
          const lensY = star.y + (dx / dist) * lens * Math.sin(elapsed * 1.5);
          
          const alpha = star.brightness * (1 - smoothConsume * 0.95);
          if (alpha > 0.02) {
            ctx.beginPath();
            ctx.arc(lensX, lensY, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
          }
        }
      });

      // Draw accretion disk
      const diskAlpha = 1 - smoothConsume * 2.5;
      if (diskAlpha > 0) {
        particles.forEach(p => {
          const speed = p.speed * (1 + smoothGrow * 2 + smoothConsume * 6);
          p.angle += speed * (1 + 40 / p.radius);
          
          const shrink = 1 - smoothGrow * 0.2 - smoothConsume * 0.8;
          const r = p.baseRadius * shrink;
          
          if (r > 15) {
            const x = centerX + Math.cos(p.angle) * r * 1.4;
            const y = centerY + Math.sin(p.angle) * r * 0.35;
            
            const brightness = (Math.sin(p.angle) + 1) / 2;
            const alpha = p.life * brightness * diskAlpha;
            
            if (alpha > 0.03) {
              ctx.beginPath();
              ctx.arc(x, y, p.size * shrink, 0, Math.PI * 2);
              ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
              ctx.fill();
            }
          }
        });
      }

      // Draw photon ring
      const ringAlpha = (0.7 + Math.sin(elapsed * 4) * 0.2) * (1 - smoothConsume * 2);
      if (ringAlpha > 0.05) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, holeSize + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 180, 80, ${ringAlpha})`;
        ctx.lineWidth = 2 + smoothGrow * 2;
        ctx.stroke();
      }

      // Draw event horizon
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, holeSize + 20);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(0.85, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, holeSize, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleTypingComplete = () => {
    // Let it sit for a beat, then fade smoothly into the app
    setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 1000);
    }, 900);
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-background transition-opacity duration-1000 ease-in-out ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      {/* Black hole canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0"
      />
      
      {/* Logo and Text overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-out ${
        showLogo ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="relative flex flex-col items-center">
          {/* Logo pop */}
          <div 
            className={`relative transition-all duration-500 ${
              showLogo ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            {/* Glow rings */}
            <div className={`absolute inset-0 -m-16 rounded-full bg-primary/30 blur-3xl transition-all duration-700 ${
              showLogo ? 'opacity-100 scale-110' : 'opacity-0 scale-50'
            }`} />
            <div className={`absolute inset-0 -m-8 rounded-full bg-primary/20 blur-2xl transition-all duration-500 delay-100 ${
              showLogo ? 'opacity-100' : 'opacity-0'
            }`} />
            
            {/* Burst rings */}
            <div className={`absolute inset-0 -m-24 transition-all duration-1000 ${
              showLogo ? 'scale-[2] opacity-0' : 'scale-75 opacity-60'
            }`}>
              <div className="w-full h-full rounded-full border-2 border-primary/50" />
            </div>
            
            {/* Logo image */}
            <img 
              src={dtvLogo} 
              alt="DTV Electronics" 
              className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_0_40px_hsl(var(--primary)/0.65)]"
            />
          </div>
          
          {/* Text section */}
          <div 
            className={`mt-8 transition-all duration-700 ${
              showText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            <h1 
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-foreground to-primary tracking-wider text-center"
              style={{
                textShadow: '0 0 30px hsl(var(--primary) / 0.5), 0 0 60px hsl(var(--primary) / 0.25)'
              }}
            >
              {showText ? (
                <TypingText 
                  text="DTV ELECTRONICS"
                  onComplete={handleTypingComplete}
                  typingSpeed={55}
                  deletingSpeed={0}
                  pauseDuration={600}
                  loop={false}
                  completeOnType
                />
              ) : (
                <span aria-hidden="true">&nbsp;</span>
              )}
            </h1>
            <p className={`text-center text-sm md:text-base text-primary/80 mt-3 tracking-[0.25em] font-light transition-all duration-500 delay-300 ${
              showText ? 'opacity-100' : 'opacity-0'
            }`}>
              EST. BLOCK 723,420
            </p>
          </div>
        </div>
      </div>

      {/* Subtle scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground) / 0.06) 2px, hsl(var(--foreground) / 0.06) 4px)'
        }}
      />
    </div>
  );
}
