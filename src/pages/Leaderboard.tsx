import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Send, User, Crown, Medal, Award, Ban, Pickaxe, Coins } from "lucide-react";
import { toast } from "sonner";
import { useNetworkScanner } from "@/hooks/useNetworkScanner";

interface BestDiffEntry {
  rank: number;
  username: string;
  miner_name: string;
  best_difficulty: number;
  time_to_find_seconds: number;
  achieved_at: string;
  prize_cave_btc: number;
  is_current_user: boolean;
}

interface CaveEntry {
  rank: number;
  username: string;
  cave_btc: number;
  achieved_at: string;
  prize_cave_btc: number;
  is_current_user: boolean;
}

const USERNAME_KEY = "leaderboardUsername";

const formatDiff = (d: number) => {
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)}T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)}G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)}M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(2)}K`;
  return d.toString();
};

const formatTime = (s: number) => {
  if (!s || s <= 0) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
};

const prizeText = (rank: number, prize: number) => rank <= 3 ? `Prize: ${prize.toLocaleString()} Cave BTC` : `Ranked prize: ${prize.toLocaleString()} Cave BTC`;

export default function Leaderboard() {
  const [username, setUsername] = useState<string>(() => localStorage.getItem(USERNAME_KEY) || "");
  const [draftName, setDraftName] = useState("");
  const [bestEntries, setBestEntries] = useState<BestDiffEntry[]>([]);
  const [caveEntries, setCaveEntries] = useState<CaveEntry[]>([]);
  const [bans, setBans] = useState<{ username: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMiner, setSelectedMiner] = useState<string>("");

  const { devices } = useNetworkScanner();

  const fetchData = async () => {
    setLoading(true);
    const [{ data: best }, { data: cave }, { data: b }] = await Promise.all([
      supabase.rpc("get_best_diff_leaderboard" as any, { _username: username || null, _limit: 100 } as any),
      supabase.rpc("get_cave_btc_leaderboard" as any, { _username: username || null, _limit: 100 } as any),
      supabase.from("leaderboard_bans" as any).select("username"),
    ]);
    setBestEntries((best as unknown as BestDiffEntry[]) || []);
    setCaveEntries((cave as unknown as CaveEntry[]) || []);
    setBans((b as unknown as { username: string }[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [username]);

  const isBanned = useMemo(
    () => bans.some(b => b.username.toLowerCase() === username.toLowerCase()),
    [bans, username]
  );

  const saveUsername = () => {
    const trimmed = draftName.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      toast.error("Username must be 2-32 characters");
      return;
    }
    localStorage.setItem(USERNAME_KEY, trimmed);
    setUsername(trimmed);
  };

  const submitBest = async () => {
    if (!selectedMiner) { toast.error("Select a miner"); return; }
    const device: any = devices.find(d => (d.name || d.IP) === selectedMiner);
    if (!device) { toast.error("Miner not found"); return; }
    const diff = Number(device.bestDiff || 0);
    if (!diff) { toast.error("This miner has no best difficulty yet"); return; }

    setSubmitting(true);
    const startKey = `minerStart_${selectedMiner}`;
    let startedAt = Number(localStorage.getItem(startKey) || 0);
    if (!startedAt) { startedAt = Date.now(); localStorage.setItem(startKey, String(startedAt)); }
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

    const { error } = await supabase.from("leaderboard_entries" as any).insert({
      username, miner_name: selectedMiner, best_difficulty: diff, time_to_find_seconds: seconds,
    } as any);
    setSubmitting(false);

    if (error) toast.error(error.message.includes("banned") ? "You are banned from the leaderboard" : "Submission failed");
    else { toast.success("Submitted to leaderboard!"); fetchData(); }
  };

  if (!username) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4 animate-scale-up">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-warning/10 border border-warning/20"><Trophy className="h-6 w-6 text-warning" /></div>
            <h1 className="text-lg font-bold font-mono">Enter the Leaderboard</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Pick a username once to continue</p>
          </div>
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Username</Label>
            <div className="relative mt-1">
              <User className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. AxeWizard" maxLength={32} className="h-8 text-xs font-mono pl-8" onKeyDown={e => e.key === "Enter" && saveUsername()} />
            </div>
          </div>
          <Button onClick={saveUsername} className="w-full h-8 text-xs font-mono">Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10 border border-warning/20"><Trophy className="h-5 w-5 text-warning" /></div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Leaderboards</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Playing as <span className="text-foreground">{username}</span>{isBanned && <span className="ml-2 text-destructive">• BANNED</span>}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-[10px] font-mono text-muted-foreground">
        Best Diff rewards are Cave BTC only, not real BTC: 1st 100,000 · 2nd 50,000 · 3rd 25,000 · everyone else 5,000. Top 100 show here, but your global rank still counts.
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
        <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Submit your Best Difficulty</h2>
        {isBanned ? (
          <div className="flex items-center gap-2 text-xs font-mono text-destructive"><Ban className="h-3.5 w-3.5" /> You are banned from submitting.</div>
        ) : devices.length === 0 ? (
          <p className="text-[11px] font-mono text-muted-foreground">No miners detected. Add one in Stats first.</p>
        ) : (
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Miner</Label>
              <Select value={selectedMiner} onValueChange={setSelectedMiner}>
                <SelectTrigger className="h-8 text-xs font-mono mt-1"><SelectValue placeholder="Choose miner..." /></SelectTrigger>
                <SelectContent>{devices.map((d: any) => { const name = d.name || d.IP; return <SelectItem key={name} value={name}>{name} — Best: {formatDiff(Number(d.bestDiff || 0))}</SelectItem>; })}</SelectContent>
              </Select>
            </div>
            <Button onClick={submitBest} disabled={submitting || !selectedMiner} className="h-8 text-xs font-mono gap-2"><Send className="h-3 w-3" /> {submitting ? "Submitting..." : "Submit"}</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="best" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-8">
          <TabsTrigger value="best" className="text-xs font-mono gap-1"><Pickaxe className="h-3 w-3" />Best Diff</TabsTrigger>
          <TabsTrigger value="cave" className="text-xs font-mono gap-1"><Coins className="h-3 w-3" />Most Cave BTC</TabsTrigger>
        </TabsList>
        <TabsContent value="best" className="mt-3">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground mb-3">Top 100 • Highest Diff Wins</h2>
            {loading ? <p className="text-[11px] font-mono text-muted-foreground text-center py-6">Loading...</p> : bestEntries.length === 0 ? <p className="text-[11px] font-mono text-muted-foreground text-center py-6">No entries yet.</p> : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[44px_1fr_1fr_92px_88px_110px] gap-2 px-2 text-[9px] font-mono uppercase text-muted-foreground/60 tracking-wider"><span>Rank</span><span>Player</span><span>Miner</span><span className="text-right">Diff</span><span className="text-right">Time</span><span className="text-right">Cave BTC</span></div>
                {bestEntries.map(e => <RankRow key={`${e.username}-${e.rank}`} rank={e.rank} username={e.username} middle={e.miner_name || "—"} score={formatDiff(e.best_difficulty)} extra={formatTime(e.time_to_find_seconds)} prize={e.prize_cave_btc} isMe={e.is_current_user} />)}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="cave" className="mt-3">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground mb-3">Top 100 • Most Cave BTC</h2>
            {loading ? <p className="text-[11px] font-mono text-muted-foreground text-center py-6">Loading...</p> : caveEntries.length === 0 ? <p className="text-[11px] font-mono text-muted-foreground text-center py-6">No Cave BTC entries yet.</p> : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[44px_1fr_1fr_110px] gap-2 px-2 text-[9px] font-mono uppercase text-muted-foreground/60 tracking-wider"><span>Rank</span><span>Player</span><span className="text-right">Cave BTC</span><span className="text-right">Prize</span></div>
                {caveEntries.map(e => <RankRow key={`${e.username}-${e.rank}`} rank={e.rank} username={e.username} middle="" score={e.cave_btc.toLocaleString(undefined, { maximumFractionDigits: 1 })} extra="" prize={e.prize_cave_btc} isMe={e.is_current_user} compact />)}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RankRow({ rank, username, middle, score, extra, prize, isMe, compact }: { rank: number; username: string; middle: string; score: string; extra: string; prize: number; isMe: boolean; compact?: boolean }) {
  const icon = rank === 1 ? <Crown className="h-3.5 w-3.5 text-warning" /> : rank === 2 ? <Medal className="h-3.5 w-3.5 text-muted-foreground" /> : rank === 3 ? <Award className="h-3.5 w-3.5 text-orange-500" /> : null;
  const cls = isMe ? "border-primary/40 bg-primary/5" : "border-border/20 bg-secondary/10 hover:bg-secondary/20";
  if (compact) return <div title={prizeText(rank, prize)} className={`grid grid-cols-[44px_1fr_1fr_110px] gap-2 items-center px-2 py-2 rounded-lg text-xs font-mono border transition-colors ${cls}`}><span className="flex items-center gap-1">{icon}<span className="font-bold">{rank}</span></span><span className="truncate font-bold">{username}</span><span className="text-right font-bold text-warning">{score}</span><span className="text-right text-accent">{prize.toLocaleString()}</span></div>;
  return <div title={prizeText(rank, prize)} className={`grid grid-cols-[44px_1fr_1fr_92px_88px_110px] gap-2 items-center px-2 py-2 rounded-lg text-xs font-mono border transition-colors ${cls}`}><span className="flex items-center gap-1">{icon}<span className="font-bold">{rank}</span></span><span className="truncate font-bold">{username}</span><span className="truncate text-muted-foreground">{middle}</span><span className="text-right font-bold text-warning">{score}</span><span className="text-right text-muted-foreground">{extra}</span><span className="text-right text-accent">{prize.toLocaleString()}</span></div>;
}
