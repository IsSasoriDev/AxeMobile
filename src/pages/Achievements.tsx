import { useState, useEffect } from "react";
import { Trophy, Star, Zap, Crown, Gem, Flame, Target, Award, Medal, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: typeof Trophy;
  targetDiff?: number;
  isBlockFind?: boolean;
  unlocked: boolean;
  unlockedBy?: string;
  unlockedAt?: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: typeof Trophy;
  targetDiff?: number;
  isBlockFind?: boolean;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-hash", name: "First Steps", description: "Submit your first valid share", icon: Star, targetDiff: 1, rarity: "common" },
  { id: "hundred-diff", name: "Getting Warmed Up", description: "Hit 100 difficulty", icon: Zap, targetDiff: 100, rarity: "common" },
  { id: "thousand-diff", name: "Hash Apprentice", description: "Hit 1,000 difficulty", icon: Target, targetDiff: 1000, rarity: "common" },
  { id: "10k-diff", name: "Miner Initiate", description: "Hit 10K difficulty", icon: Medal, targetDiff: 10000, rarity: "uncommon" },
  { id: "100k-diff", name: "Silicon Soldier", description: "Hit 100K difficulty", icon: Shield, targetDiff: 100000, rarity: "uncommon" },
  { id: "1m-diff", name: "Hash Warrior", description: "Hit 1M difficulty", icon: Flame, targetDiff: 1000000, rarity: "rare" },
  { id: "10m-diff", name: "ASIC Veteran", description: "Hit 10M difficulty", icon: Award, targetDiff: 10000000, rarity: "rare" },
  { id: "100m-diff", name: "Golden Nonce", description: "Hit 100M difficulty", icon: Gem, targetDiff: 100000000, rarity: "epic" },
  { id: "1g-diff", name: "G Club", description: "Hit 1G difficulty", icon: Crown, targetDiff: 1000000000, rarity: "epic" },
  { id: "block-found", name: "BLOCK FOUND!", description: "Find a Bitcoin block - The ultimate achievement", icon: Trophy, isBlockFind: true, rarity: "legendary" },
];

const rarityColors = {
  common: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-glow-pulse",
};

const rarityGlow = {
  common: "",
  uncommon: "shadow-green-500/10",
  rare: "shadow-blue-500/20",
  epic: "shadow-purple-500/30",
  legendary: "shadow-amber-500/40 shadow-lg",
};

const Achievements = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [bestDiff, setBestDiff] = useState(0);

  useEffect(() => {
    // Load saved achievements
    const saved = localStorage.getItem("achievements");
    const savedBest = localStorage.getItem("bestDifficulty");
    
    if (savedBest) {
      setBestDiff(JSON.parse(savedBest).value || 0);
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = ACHIEVEMENTS.map(a => ({
        ...a,
        unlocked: parsed[a.id]?.unlocked || false,
        unlockedBy: parsed[a.id]?.unlockedBy,
        unlockedAt: parsed[a.id]?.unlockedAt,
      }));
      setAchievements(merged);
    } else {
      setAchievements(ACHIEVEMENTS.map(a => ({ ...a, unlocked: false })));
    }
  }, []);

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
    <div className="h-full overflow-auto p-6 space-y-6 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-amber-500/20">
          <Trophy className="h-8 w-8 text-amber-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Achievements</h1>
          <p className="text-muted-foreground">Track your mining milestones</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progress</span>
            <span className="text-lg">{unlockedCount}/{totalCount}</span>
          </CardTitle>
          <CardDescription>
            Best Difficulty: <span className="text-primary font-semibold">{formatDiff(bestDiff)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          const isUnlocked = achievement.unlocked;
          
          return (
            <Card
              key={achievement.id}
              className={`relative overflow-hidden transition-all duration-300 ${
                isUnlocked 
                  ? `${rarityGlow[achievement.rarity]} border-2` 
                  : "opacity-60 grayscale"
              }`}
            >
              {isUnlocked && achievement.rarity === "legendary" && (
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5 animate-pulse" />
              )}
              <CardContent className="p-4 relative">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${rarityColors[achievement.rarity]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{achievement.name}</h3>
                      <Badge variant="outline" className={`text-xs ${rarityColors[achievement.rarity]}`}>
                        {achievement.rarity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{achievement.description}</p>
                    <p className="text-xs text-primary mt-2">
                      {achievement.isBlockFind ? "Target: Find a block" : `Target: ${formatDiff(achievement.targetDiff || 0)} diff`}
                    </p>
                    
                    {isUnlocked && achievement.unlockedBy && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Unlocked by: <span className="font-semibold">{achievement.unlockedBy}</span>
                        </p>
                        {achievement.unlockedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(achievement.unlockedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Achievements;
