import { useState, useEffect } from "react";
import { Trophy, Star, Zap, Crown, Gem, Flame, Target, Award, Medal, Shield, Lock, Clock, Cpu, Wifi, Users, Wrench, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Achievement {
  id: string; name: string; description: string; icon: typeof Trophy;
  targetDiff?: number; isBlockFind?: boolean; category: string;
  unlocked: boolean; unlockedBy?: string; unlockedAt?: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

interface AchievementDef {
  id: string; name: string; description: string; icon: typeof Trophy;
  targetDiff?: number; isBlockFind?: boolean; category: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Difficulty milestones
  { id: "first-hash", name: "First Steps", description: "Submit your first valid share", icon: Star, targetDiff: 1, category: "difficulty", rarity: "common" },
  { id: "hundred-diff", name: "Getting Warmed Up", description: "Hit 100 difficulty", icon: Zap, targetDiff: 100, category: "difficulty", rarity: "common" },
  { id: "thousand-diff", name: "Hash Apprentice", description: "Hit 1K difficulty", icon: Target, targetDiff: 1000, category: "difficulty", rarity: "common" },
  { id: "10k-diff", name: "Miner Initiate", description: "Hit 10K difficulty", icon: Medal, targetDiff: 10000, category: "difficulty", rarity: "uncommon" },
  { id: "100k-diff", name: "Silicon Soldier", description: "Hit 100K difficulty", icon: Shield, targetDiff: 100000, category: "difficulty", rarity: "uncommon" },
  { id: "1m-diff", name: "M Club", description: "Hit 1M difficulty", icon: Flame, targetDiff: 1000000, category: "difficulty", rarity: "rare" },
  { id: "10m-diff", name: "ASIC Veteran", description: "Hit 10M difficulty", icon: Award, targetDiff: 10000000, category: "difficulty", rarity: "rare" },
  { id: "100m-diff", name: "Golden Nonce", description: "Hit 100M difficulty", icon: Gem, targetDiff: 100000000, category: "difficulty", rarity: "epic" },
  { id: "1g-diff", name: "G Club", description: "Hit 1G difficulty", icon: Crown, targetDiff: 1000000000, category: "difficulty", rarity: "epic" },
  { id: "10g-diff", name: "Hash God", description: "Hit 10G difficulty", icon: Crown, targetDiff: 10000000000, category: "difficulty", rarity: "legendary" },
  { id: "block-found", name: "BLOCK FOUND!", description: "Find a Bitcoin block", icon: Trophy, isBlockFind: true, category: "difficulty", rarity: "legendary" },
  // Uptime milestones
  { id: "uptime-1h", name: "First Hour", description: "1 hour continuous mining", icon: Clock, category: "uptime", rarity: "common" },
  { id: "uptime-24h", name: "Day Shift", description: "24 hours continuous mining", icon: Clock, category: "uptime", rarity: "uncommon" },
  { id: "uptime-7d", name: "Weekly Warrior", description: "7 days continuous mining", icon: Clock, category: "uptime", rarity: "rare" },
  { id: "uptime-30d", name: "Monthly Machine", description: "30 days continuous mining", icon: Clock, category: "uptime", rarity: "epic" },
  // Hashrate records  
  { id: "hr-500gh", name: "Half Terra", description: "Combined fleet 500 GH/s", icon: Cpu, category: "hashrate", rarity: "uncommon" },
  { id: "hr-1th", name: "Terra Club", description: "Combined fleet 1 TH/s", icon: Cpu, category: "hashrate", rarity: "rare" },
  { id: "hr-5th", name: "Hash Farm", description: "Combined fleet 5 TH/s", icon: Cpu, category: "hashrate", rarity: "epic" },
  // Hardware collection
  { id: "hw-first", name: "First Miner", description: "Connect your first miner", icon: Wifi, category: "hardware", rarity: "common" },
  { id: "hw-3", name: "Small Fleet", description: "Connect 3 miners", icon: Wifi, category: "hardware", rarity: "uncommon" },
  { id: "hw-5", name: "Mining Squad", description: "Connect 5 miners", icon: Wifi, category: "hardware", rarity: "rare" },
  { id: "hw-10", name: "Hash Army", description: "Connect 10 miners", icon: Wifi, category: "hardware", rarity: "epic" },
  { id: "hw-flash", name: "Firmware Flasher", description: "Flash firmware on a miner", icon: Wrench, category: "hardware", rarity: "uncommon" },
  // Community
  { id: "community-pool", name: "Pool Player", description: "Mine on AxePool", icon: Users, category: "community", rarity: "uncommon" },
  { id: "community-share", name: "Sharing is Caring", description: "Share your stats", icon: Heart, category: "community", rarity: "common" },
];

const rarityColor: Record<string, string> = {
  common: "border-muted-foreground/15 text-muted-foreground",
  uncommon: "border-accent/25 text-accent",
  rare: "border-primary/25 text-primary",
  epic: "border-purple-400/30 text-purple-400",
  legendary: "border-warning/35 text-warning",
};

const rarityBg: Record<string, string> = {
  common: "bg-muted-foreground/8",
  uncommon: "bg-accent/8",
  rare: "bg-primary/8",
  epic: "bg-purple-400/8",
  legendary: "bg-warning/8",
};

const categoryLabels: Record<string, { label: string; icon: typeof Trophy }> = {
  difficulty: { label: "Difficulty", icon: Target },
  uptime: { label: "Uptime", icon: Clock },
  hashrate: { label: "Hashrate", icon: Cpu },
  hardware: { label: "Hardware", icon: Wifi },
  community: { label: "Community", icon: Users },
};

const Achievements = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [bestDiff, setBestDiff] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    const saved = localStorage.getItem("achievements");
    const savedBest = localStorage.getItem("bestDifficulty");
    if (savedBest) setBestDiff(JSON.parse(savedBest).value || 0);
    if (saved) {
      const parsed = JSON.parse(saved);
      setAchievements(ACHIEVEMENTS.map(a => ({ ...a, unlocked: parsed[a.id]?.unlocked || false, unlockedBy: parsed[a.id]?.unlockedBy, unlockedAt: parsed[a.id]?.unlockedAt })));
    } else {
      setAchievements(ACHIEVEMENTS.map(a => ({ ...a, unlocked: false })));
    }
  }, []);

  const filtered = activeCategory === "all" ? achievements : achievements.filter(a => a.category === activeCategory);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = (unlockedCount / totalCount) * 100;

  const formatDiff = (diff: number) => {
    if (diff >= 1e12) return `${(diff / 1e12).toFixed(0)}T`;
    if (diff >= 1e9) return `${(diff / 1e9).toFixed(0)}G`;
    if (diff >= 1e6) return `${(diff / 1e6).toFixed(0)}M`;
    if (diff >= 1e3) return `${(diff / 1e3).toFixed(0)}K`;
    return diff.toString();
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
          <Trophy className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold font-mono tracking-tight">Achievements</h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Mining Milestones</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black font-mono text-primary">{unlockedCount}/{totalCount}</p>
          <p className="text-[9px] text-muted-foreground font-mono">Best: {formatDiff(bestDiff)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setActiveCategory("all")} className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
          activeCategory === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50"
        }`}>All</button>
        {Object.entries(categoryLabels).map(([key, { label, icon: CatIcon }]) => (
          <button key={key} onClick={() => setActiveCategory(key)} className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
            activeCategory === key ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50"
          }`}>
            <CatIcon className="h-2.5 w-2.5" /> {label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid gap-2 md:grid-cols-2">
        {filtered.map((achievement) => {
          const Icon = achievement.icon;
          const isUnlocked = achievement.unlocked;
          const color = rarityColor[achievement.rarity];
          const bg = rarityBg[achievement.rarity];

          return (
            <div
              key={achievement.id}
              className={`relative rounded-xl border p-3 transition-all duration-300 ${
                isUnlocked ? `${color} ${bg} backdrop-blur-sm` : "border-border/20 bg-card/20 opacity-40"
              } ${isUnlocked && achievement.rarity === "legendary" ? "shadow-[0_0_15px_hsl(var(--warning)/0.15)]" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg border ${isUnlocked ? color : "border-border/20 bg-muted/20"}`}>
                  {isUnlocked ? <Icon className="h-4 w-4" /> : <Lock className="h-4 w-4 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-xs font-mono">{achievement.name}</h3>
                    <Badge variant="outline" className={`text-[8px] px-1 py-0 font-mono ${color}`}>
                      {achievement.rarity}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{achievement.description}</p>
                  <p className="text-[9px] text-primary/70 mt-1 font-mono">
                    {achievement.isBlockFind ? "Find a block" : achievement.targetDiff ? `Target: ${formatDiff(achievement.targetDiff)}` : achievement.category}
                  </p>
                  {isUnlocked && achievement.unlockedBy && (
                    <p className="text-[9px] text-accent mt-1 font-mono flex items-center gap-1">
                      <Star className="h-2.5 w-2.5" /> {achievement.unlockedBy}
                      {achievement.unlockedAt && ` · ${new Date(achievement.unlockedAt).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Achievements;
