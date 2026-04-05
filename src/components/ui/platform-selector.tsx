import { useState } from "react";
import { Monitor, Smartphone, Pickaxe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Platform } from "@/hooks/usePlatform";

interface PlatformSelectorProps {
  onSelect: (platform: Platform) => void;
}

export function PlatformSelector({ onSelect }: PlatformSelectorProps) {
  const [selected, setSelected] = useState<Platform | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setFadeOut(true);
    setTimeout(() => onSelect(selected), 500);
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-background transition-all duration-500 ${fadeOut ? 'opacity-0 scale-105' : 'opacity-100'}`}>
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.3) 1px, transparent 0)',
        backgroundSize: '32px 32px'
      }} />
      
      <div className="relative flex flex-col items-center space-y-8 px-6 max-w-lg">
        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 animate-float">
          <Pickaxe className="h-10 w-10 text-primary" />
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black font-mono text-foreground tracking-tight">Welcome to AxeMobile</h1>
          <p className="text-sm text-muted-foreground font-mono">How are you using this app?</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={() => setSelected("pc")}
            className={`p-6 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${
              selected === "pc"
                ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                : "border-border/40 bg-card/40 hover:border-primary/30"
            }`}
          >
            <Monitor className={`h-10 w-10 ${selected === "pc" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-center">
              <p className="font-bold font-mono text-sm">Desktop</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">PC / Laptop</p>
            </div>
          </button>

          <button
            onClick={() => setSelected("mobile")}
            className={`p-6 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${
              selected === "mobile"
                ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                : "border-border/40 bg-card/40 hover:border-primary/30"
            }`}
          >
            <Smartphone className={`h-10 w-10 ${selected === "mobile" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-center">
              <p className="font-bold font-mono text-sm">Mobile</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">Phone / Tablet</p>
            </div>
          </button>
        </div>

        <Button 
          onClick={handleConfirm} 
          disabled={!selected}
          className="w-full h-10 font-mono font-bold"
        >
          Continue
        </Button>
        
        <p className="text-[9px] text-muted-foreground/50 font-mono text-center">
          You can change this later in Settings
        </p>
      </div>
    </div>
  );
}
