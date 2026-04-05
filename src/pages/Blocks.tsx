import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Cpu, ArrowUp, ArrowDown, Layers, Zap, Activity, TrendingUp, BarChart3, Box, Hammer, Search, X } from "lucide-react";
import { toast } from "sonner";

interface Block {
  id: string; height: number; hash: string; time: number; size: number;
  weight: number; tx_count: number; total_fee: number; miner: string; difficulty: number;
}

interface MempoolInfo { count: number; vsize: number; total_fee: number; min_fee: number; }
interface FeeEstimate { fastest: number; halfHour: number; hour: number; economy: number; }
interface DifficultyAdjustment {
  progressPercent: number; difficultyChange: number; estimatedRetargetDate: number;
  remainingBlocks: number; remainingTime: number; previousRetarget: number; timeAvg: number;
}

/* ── 3D Isometric Block Building Animation ── */
function BlockBuildingAnimation({ latestBlock, isBuilding }: { latestBlock: Block | null; isBuilding: boolean }) {
  const [buildPhase, setBuildPhase] = useState<'collecting' | 'building' | 'mined' | 'idle'>('idle');
  const [fillPercent, setFillPercent] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [shakeClass, setShakeClass] = useState('');
  const [glowIntensity, setGlowIntensity] = useState(0);
  const [idleRotation, setIdleRotation] = useState(0);
  const [idleBreath, setIdleBreath] = useState(0);
  const idleFrameRef = useRef<number>(0);

  // Idle rotation + breathing glow
  useEffect(() => {
    if (buildPhase !== 'idle') return;
    const start = performance.now();
    const animate = (now: number) => {
      const t = (now - start) / 1000;
      setIdleRotation(t * 8); // slow rotation deg/s
      setIdleBreath(Math.sin(t * 1.5) * 0.5 + 0.5); // 0-1 breathing
      idleFrameRef.current = requestAnimationFrame(animate);
    };
    idleFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(idleFrameRef.current);
  }, [buildPhase]);

  useEffect(() => {
    if (!isBuilding) {
      setBuildPhase('idle');
      setFillPercent(0);
      setTxCount(0);
      setShakeClass('');
      setGlowIntensity(0);
      return;
    }

    setBuildPhase('collecting');
    setFillPercent(0);
    setTxCount(0);

    let frame: number;
    const start = performance.now();
    const totalDuration = 5000;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / totalDuration, 1);

      if (t < 0.35) {
        const phase_t = t / 0.35;
        setFillPercent(phase_t * 35);
        setTxCount(Math.floor(phase_t * 1200));
        setGlowIntensity(phase_t * 0.3);
      } else if (t < 0.7) {
        if (buildPhase !== 'building') setBuildPhase('building');
        const phase_t = (t - 0.35) / 0.35;
        const eased = 1 - Math.pow(1 - phase_t, 3);
        setFillPercent(35 + eased * 60);
        setTxCount(1200 + Math.floor(eased * 2800));
        setGlowIntensity(0.3 + eased * 0.5);
        if (phase_t > 0.5) setShakeClass('animate-[shake_0.1s_ease-in-out_infinite]');
      } else if (t < 0.78) {
        const phase_t = (t - 0.7) / 0.08;
        setFillPercent(95 + phase_t * 5);
        setTxCount(4000 + Math.floor(phase_t * 200));
        setGlowIntensity(0.8 + phase_t * 0.2);
      } else {
        if (buildPhase !== 'mined') {
          setBuildPhase('mined');
          setShakeClass('');
          setFillPercent(100);
        }
        const phase_t = Math.min((t - 0.78) / 0.22, 1);
        setGlowIntensity(1 - phase_t * 0.5);
      }

      if (t < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setBuildPhase('idle');
        setFillPercent(0);
        setTxCount(0);
        setGlowIntensity(0);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isBuilding]);

  const segments = Array.from({ length: 12 }, (_, i) => {
    const segFill = Math.max(0, Math.min(1, (fillPercent - i * (100 / 12)) / (100 / 12)));
    return { filled: segFill > 0, opacity: segFill, row: Math.floor(i / 3), col: i % 3 };
  });

  const cubeSize = 100;
  const isMined = buildPhase === 'mined';
  const isActive = buildPhase !== 'idle';
  const isIdle = buildPhase === 'idle';

  // Compute transform
  const cubeTransform = isIdle
    ? `rotateX(-25deg) rotateY(${45 + idleRotation}deg) scale(${1 + idleBreath * 0.03})`
    : `rotateX(-25deg) rotateY(45deg)${isMined ? ' scale(1.08)' : ''}`;

  const idleGlow = isIdle ? idleBreath * 0.12 : 0;

  return (
    <div className={`relative h-56 rounded-xl border transition-all duration-500 overflow-hidden ${
      isMined ? 'border-accent/50 bg-accent/5' :
      isActive ? 'border-primary/30 bg-card/40' :
      'border-border/50 bg-card/30'
    } backdrop-blur-sm`}>

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }} />

      {/* Ambient glow behind cube */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(circle at 50% 55%, hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isActive ? glowIntensity * 0.15 : idleGlow}), transparent 50%)`,
        transition: isIdle ? 'none' : 'all 0.3s ease',
      }} />

      {/* === 3D Isometric Cube === */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '600px' }}>
        <div className={`relative ${shakeClass}`} style={{
          width: cubeSize, height: cubeSize,
          transformStyle: 'preserve-3d',
          transform: cubeTransform,
          transition: isIdle ? 'none' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {/* Front face */}
          <div className="absolute inset-0 border transition-colors duration-300" style={{
            transform: `translateZ(${cubeSize / 2}px)`,
            borderColor: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.15 + idleBreath * 0.15 : 0.3 + glowIntensity * 0.4})`,
            background: `linear-gradient(180deg, hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.03 + idleBreath * 0.04 : 0.05 + glowIntensity * 0.08}), transparent)`,
            boxShadow: isMined ? `inset 0 0 30px hsl(var(--accent) / 0.2)` : isIdle ? `inset 0 0 ${10 + idleBreath * 8}px hsl(var(--primary) / ${idleBreath * 0.08})` : 'none',
          }}>
            {/* TX fill segments on front */}
            <div className="absolute inset-[2px] grid grid-cols-3 grid-rows-4 gap-[1px]">
              {segments.map((seg, i) => (
                <div key={i} className="rounded-[1px] transition-all duration-200" style={{
                  background: seg.filled
                    ? `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${seg.opacity * (isMined ? 0.6 : 0.5)})`
                    : isIdle ? `hsl(var(--primary) / ${idleBreath * 0.04})` : 'transparent',
                  boxShadow: seg.filled && seg.opacity > 0.5
                    ? `0 0 ${4 + seg.opacity * 6}px hsl(var(--${isMined ? 'accent' : 'primary'}) / ${seg.opacity * 0.3})`
                    : 'none',
                }} />
              ))}
            </div>
          </div>

          {/* Right face */}
          <div className="absolute inset-0 border transition-colors duration-300" style={{
            transform: `rotateY(90deg) translateZ(${cubeSize / 2}px)`,
            borderColor: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.1 + idleBreath * 0.1 : 0.2 + glowIntensity * 0.3})`,
            background: `linear-gradient(180deg, hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.02 + idleBreath * 0.03 : 0.03 + glowIntensity * 0.06}), transparent)`,
          }}>
            <div className="absolute bottom-0 left-0 right-0 transition-all duration-300 rounded-t-sm" style={{
              height: `${fillPercent}%`,
              background: `linear-gradient(0deg, hsl(var(--${isMined ? 'accent' : 'primary'}) / ${0.15 + glowIntensity * 0.2}), hsl(var(--${isMined ? 'accent' : 'primary'}) / 0.03))`,
            }} />
          </div>

          {/* Top face */}
          <div className="absolute inset-0 border transition-colors duration-300" style={{
            transform: `rotateX(90deg) translateZ(${cubeSize / 2}px)`,
            borderColor: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.12 + idleBreath * 0.13 : 0.25 + glowIntensity * 0.35})`,
            background: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.02 + idleBreath * 0.04 : 0.04 + glowIntensity * 0.1})`,
          }}>
            {/* Top face fill overlay */}
            <div className="absolute inset-0 transition-all duration-300" style={{
              opacity: fillPercent / 100,
              background: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${0.1 + glowIntensity * 0.15})`,
            }} />
            {isMined && (
              <div className="absolute inset-2 opacity-30" style={{
                backgroundImage: `repeating-linear-gradient(45deg, hsl(var(--accent)) 0, hsl(var(--accent)) 1px, transparent 0, transparent 6px)`,
              }} />
            )}
          </div>

          {/* Left face */}
          <div className="absolute inset-0 border transition-colors duration-300" style={{
            transform: `rotateY(-90deg) translateZ(${cubeSize / 2}px)`,
            borderColor: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.05 + idleBreath * 0.08 : 0.1 + glowIntensity * 0.15})`,
            background: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.01 + idleBreath * 0.02 : 0.02 + glowIntensity * 0.04})`,
          }}>
            <div className="absolute bottom-0 left-0 right-0 transition-all duration-300 rounded-t-sm" style={{
              height: `${fillPercent}%`,
              background: `linear-gradient(0deg, hsl(var(--${isMined ? 'accent' : 'primary'}) / ${0.12 + glowIntensity * 0.15}), hsl(var(--${isMined ? 'accent' : 'primary'}) / 0.02))`,
            }} />
          </div>

          {/* Bottom face */}
          <div className="absolute inset-0 transition-colors duration-300" style={{
            transform: `rotateX(-90deg) translateZ(${cubeSize / 2}px)`,
            background: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${0.02 + glowIntensity * 0.03})`,
          }} />

          {/* Back face */}
          <div className="absolute inset-0 border transition-colors duration-300" style={{
            transform: `translateZ(-${cubeSize / 2}px)`,
            borderColor: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${isIdle ? 0.05 : 0.1 + glowIntensity * 0.15})`,
            background: `hsl(var(--${isMined ? 'accent' : 'primary'}) / ${0.01 + glowIntensity * 0.02})`,
          }}>
            <div className="absolute bottom-0 left-0 right-0 transition-all duration-300 rounded-t-sm" style={{
              height: `${fillPercent}%`,
              background: `linear-gradient(0deg, hsl(var(--${isMined ? 'accent' : 'primary'}) / ${0.1 + glowIntensity * 0.12}), hsl(var(--${isMined ? 'accent' : 'primary'}) / 0.02))`,
            }} />
          </div>
        </div>
      </div>

      {/* Mined flash overlay */}
      {isMined && (
        <div className="absolute inset-0 pointer-events-none animate-fade-in"
          style={{ background: `radial-gradient(circle at 50% 50%, hsl(var(--accent) / 0.12), transparent 60%)` }}
        />
      )}

      {/* Mined ring burst */}
      {isMined && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {[0, 1, 2].map(i => (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                width: `${60 + i * 40}px`, height: `${60 + i * 40}px`,
                borderColor: `hsl(var(--accent) / ${0.4 - i * 0.12})`,
                animation: `scale-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s both`,
                boxShadow: `0 0 ${10 + i * 5}px hsl(var(--accent) / ${0.2 - i * 0.05})`,
              }}
            />
          ))}
        </div>
      )}

      {/* Phase label */}
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
          isMined ? 'bg-accent shadow-[0_0_8px_hsl(var(--accent))]' :
          isActive ? 'bg-primary animate-pulse' : 'bg-primary/40'
        }`} style={isIdle ? { opacity: 0.4 + idleBreath * 0.6, boxShadow: `0 0 ${4 + idleBreath * 6}px hsl(var(--primary) / ${idleBreath * 0.5})` } : {}} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {buildPhase === 'collecting' && 'Collecting transactions...'}
          {buildPhase === 'building' && 'Constructing block...'}
          {buildPhase === 'mined' && '✓ Block mined!'}
          {buildPhase === 'idle' && 'Waiting for next block'}
        </span>
      </div>

      {/* Fill percentage */}
      {isActive && (
        <div className="absolute bottom-3 left-4 flex items-center gap-3">
          <div className="w-24 h-1 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-150 ease-linear" style={{
              width: `${fillPercent}%`,
              background: isMined ? 'hsl(var(--accent))' : `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`,
              boxShadow: `0 0 6px hsl(var(--${isMined ? 'accent' : 'primary'}) / 0.5)`,
            }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{Math.round(fillPercent)}%</span>
        </div>
      )}

      {/* TX count */}
      {isActive && (
        <div className="absolute bottom-3 right-4 text-[10px] font-mono text-muted-foreground tabular-nums">
          <span className="text-primary font-bold">{txCount.toLocaleString()}</span> TXs
        </div>
      )}

      {/* Block info on mined */}
      {isMined && latestBlock && (
        <div className="absolute top-3 right-4 text-right animate-fade-in">
          <p className="text-sm font-mono font-black text-accent">#{latestBlock.height.toLocaleString()}</p>
          <p className="text-[10px] font-mono text-muted-foreground">⛏️ {latestBlock.miner}</p>
        </div>
      )}
    </div>
  );
}

/* ── Block Search Component ── */
function BlockSearch({ onBlockFound }: { onBlockFound: (block: Block) => void }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Block[]>([]);
  const [showResults, setShowResults] = useState(false);

  const searchBlock = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const trimmed = query.trim();
      if (/^\d+$/.test(trimmed)) {
        const res = await fetch(`https://mempool.space/api/block-height/${trimmed}`);
        if (!res.ok) throw new Error("Block not found");
        const hash = await res.text();
        const blockRes = await fetch(`https://mempool.space/api/block/${hash}`);
        if (!blockRes.ok) throw new Error("Block not found");
        const b = await blockRes.json();
        const block: Block = {
          id: b.id, height: b.height, hash: b.id, time: b.timestamp,
          size: b.size, weight: b.weight, tx_count: b.tx_count,
          total_fee: b.extras?.totalFees || 0,
          miner: b.extras?.pool?.name || "Unknown", difficulty: b.difficulty,
        };
        setResults([block]);
        setShowResults(true);
      } else {
        const res = await fetch("https://mempool.space/api/v1/blocks");
        if (!res.ok) throw new Error("Failed to fetch blocks");
        const allBlocks = await res.json();
        const matched = allBlocks
          .filter((b: any) => (b.extras?.pool?.name || "").toLowerCase().includes(trimmed.toLowerCase()))
          .slice(0, 8)
          .map((b: any) => ({
            id: b.id, height: b.height, hash: b.id, time: b.timestamp,
            size: b.size, weight: b.weight, tx_count: b.tx_count,
            total_fee: b.extras?.totalFees || 0,
            miner: b.extras?.pool?.name || "Unknown", difficulty: b.difficulty,
          }));
        if (matched.length === 0) {
          toast.error("No blocks found for that miner");
        } else {
          setResults(matched);
          setShowResults(true);
        }
      }
    } catch {
      toast.error("Block not found");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by block height or miner name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchBlock()}
            className="pl-9 h-9 text-xs font-mono bg-card/50 border-border/50"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setShowResults(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={searchBlock} disabled={searching} className="gap-1.5 font-mono text-xs h-9 px-3">
          {searching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          Search
        </Button>
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-20 top-full mt-2 left-0 right-0 rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-lg overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {results.length} block{results.length > 1 ? 's' : ''} found
            </span>
            <button onClick={() => setShowResults(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.map((block) => (
              <button key={block.height}
                onClick={() => { onBlockFound(block); setShowResults(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-secondary/50 transition-colors border-b border-border/10 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-primary">#{block.height.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[8px] font-mono">{block.miner}</Badge>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {block.tx_count.toLocaleString()} TXs · {(block.size / 1e6).toFixed(2)} MB
                  </span>
                </div>
                <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 truncate">{block.hash}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Selected Block Detail ── */
function BlockDetail({ block, onClose }: { block: Block; onClose: () => void }) {
  const formatSize = (b: number) => b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${(b / 1e3).toFixed(0)} KB`;
  return (
    <div className="rounded-xl border border-primary/30 bg-card/60 backdrop-blur-sm p-4 animate-slide-up relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Box className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-black font-mono text-primary">Block #{block.height.toLocaleString()}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">⛏️ Mined by {block.miner}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Transactions", value: block.tx_count.toLocaleString() },
          { label: "Size", value: formatSize(block.size) },
          { label: "Weight", value: `${(block.weight / 1e6).toFixed(2)} MWU` },
          { label: "Total Fees", value: `${(block.total_fee / 1e8).toFixed(4)} BTC` },
        ].map(item => (
          <div key={item.label} className="text-center p-2 rounded-lg bg-secondary/30 border border-border/20">
            <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider">{item.label}</p>
            <p className="text-sm font-bold font-mono mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 p-2 rounded-lg bg-secondary/20 border border-border/10">
        <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Block Hash</p>
        <p className="text-[10px] font-mono text-muted-foreground break-all select-all">{block.hash}</p>
      </div>
      <p className="text-[9px] font-mono text-muted-foreground mt-2">
        Mined {new Date(block.time * 1000).toLocaleString()}
      </p>
    </div>
  );
}

/* ── Main Blocks Page ── */
export default function Blocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [mempool, setMempool] = useState<MempoolInfo | null>(null);
  const [fees, setFees] = useState<FeeEstimate | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyAdjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [hashrate, setHashrate] = useState(0);
  const [btcPrice, setBtcPrice] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const prevBlockHeight = useRef<number>(0);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      const [blocksRes, feesRes, diffRes, mempoolRes, hashrateRes, priceRes] = await Promise.allSettled([
        fetch("https://mempool.space/api/v1/blocks").then(r => r.json()),
        fetch("https://mempool.space/api/v1/fees/recommended").then(r => r.json()),
        fetch("https://mempool.space/api/v1/difficulty-adjustment").then(r => r.json()),
        fetch("https://mempool.space/api/mempool").then(r => r.json()),
        fetch("https://mempool.space/api/v1/mining/hashrate/1m").then(r => r.json()),
        fetch("https://mempool.space/api/v1/prices").then(r => r.json()),
      ]);
      if (blocksRes.status === "fulfilled") {
        const newBlocks = blocksRes.value.slice(0, 8).map((b: any) => ({
          id: b.id, height: b.height, hash: b.id, time: b.timestamp, size: b.size,
          weight: b.weight, tx_count: b.tx_count, total_fee: b.extras?.totalFees || 0,
          miner: b.extras?.pool?.name || "Unknown", difficulty: b.difficulty,
        }));
        if (prevBlockHeight.current > 0 && newBlocks[0]?.height > prevBlockHeight.current) {
          setIsBuilding(true);
          setTimeout(() => setIsBuilding(false), 6500);
        }
        if (newBlocks[0]) prevBlockHeight.current = newBlocks[0].height;
        setBlocks(newBlocks);
      }
      if (feesRes.status === "fulfilled") { const f = feesRes.value; setFees({ fastest: f.fastestFee, halfHour: f.halfHourFee, hour: f.hourFee, economy: f.economyFee }); }
      if (diffRes.status === "fulfilled") setDifficulty(diffRes.value);
      if (mempoolRes.status === "fulfilled") { const m = mempoolRes.value; setMempool({ count: m.count, vsize: m.vsize, total_fee: m.total_fee, min_fee: m.mempoolminfee || 0 }); }
      if (hashrateRes.status === "fulfilled" && hashrateRes.value?.hashrates?.length) { setHashrate(hashrateRes.value.hashrates.at(-1).avgHashrate / 1e18); }
      if (priceRes.status === "fulfilled") setBtcPrice(priceRes.value?.USD || 0);
      if (showToast) toast.success("Block data refreshed");
    } catch { if (showToast) toast.error("Failed to refresh data"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(() => fetchData(), 30000); return () => clearInterval(i); }, [fetchData]);

  const timeAgo = (ts: number) => { const d = Math.floor(Date.now() / 1000 - ts); if (d < 60) return `${d}s`; if (d < 3600) return `${Math.floor(d / 60)}m`; return `${Math.floor(d / 3600)}h`; };
  const formatSize = (b: number) => b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${(b / 1e3).toFixed(0)} KB`;
  const formatNum = (n: number) => n.toLocaleString();
  const formatBTC = (s: number) => (s / 1e8).toFixed(3);

  const feeColor = (key: string) => ({
    no: "border-muted-foreground/20 bg-muted/30",
    low: "border-accent/25 bg-accent/8",
    medium: "border-warning/25 bg-warning/8",
    high: "border-destructive/25 bg-destructive/8",
  }[key] || "");

  const feeTextColor = (key: string) => ({
    no: "text-muted-foreground",
    low: "text-accent",
    medium: "text-warning",
    high: "text-destructive",
  }[key] || "");

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Blocks Explorer</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Live Bitcoin Network</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm"
            onClick={() => { setIsBuilding(true); setTimeout(() => setIsBuilding(false), 6500); }}
            className="gap-1.5 text-[10px] font-mono h-7 px-2">
            <Hammer className="h-3 w-3" /> Demo
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={loading} className="gap-1.5 font-mono text-xs h-8">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <BlockSearch onBlockFound={(block) => setSelectedBlock(block)} />

      {/* Selected block detail */}
      {selectedBlock && <BlockDetail block={selectedBlock} onClose={() => setSelectedBlock(null)} />}

      {/* Network stat pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { icon: Cpu, label: "Hashrate", value: hashrate > 0 ? `${hashrate.toFixed(0)} EH/s` : "—" },
          { icon: TrendingUp, label: "BTC", value: btcPrice > 0 ? `$${formatNum(Math.round(btcPrice))}` : "—" },
          { icon: Activity, label: "Unconfirmed", value: mempool ? formatNum(mempool.count) : "—" },
          { icon: BarChart3, label: "Mempool", value: mempool ? formatSize(mempool.vsize) : "—" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm">
            <item.icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-mono">{item.label}</span>
            <span className="text-xs font-bold font-mono">{item.value}</span>
          </div>
        ))}
      </div>

      {/* 3D Block Building Animation */}
      <BlockBuildingAnimation latestBlock={blocks[0] || null} isBuilding={isBuilding} />

      {/* Recent Blocks */}
      <div>
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2 font-mono">
          <Box className="h-3 w-3" /> Recent Blocks
        </h2>
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {blocks.map((block, i) => (
            <Tooltip key={block.height}>
              <TooltipTrigger asChild>
                <div
                  onClick={() => setSelectedBlock(block)}
                  className="min-w-[160px] max-w-[180px] snap-start shrink-0 cursor-pointer rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-3 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 group relative overflow-hidden"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold font-mono text-primary">{formatNum(block.height)}</span>
                    <span className="text-[9px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-full">{timeAgo(block.time)}</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground font-mono">
                    <div className="flex justify-between"><span>TXs</span><span className="text-foreground font-medium">{formatNum(block.tx_count)}</span></div>
                    <div className="flex justify-between"><span>Size</span><span className="text-foreground font-medium">{formatSize(block.size)}</span></div>
                    <div className="flex justify-between"><span>Fees</span><span className="text-foreground font-medium">{formatBTC(block.total_fee)}</span></div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-border/20">
                    <span className="text-[9px] text-muted-foreground font-mono">⛏️ {block.miner}</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs"><p className="font-mono text-[10px] break-all">{block.hash}</p></TooltipContent>
            </Tooltip>
          ))}
          {loading && blocks.length === 0 && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[160px] snap-start shrink-0 animate-pulse rounded-xl border border-border/20 p-3 space-y-2">
              <div className="h-4 bg-muted rounded w-16" /><div className="h-3 bg-muted rounded w-full" /><div className="h-3 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* Fee Estimates + Difficulty */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
            <Zap className="h-3 w-3 text-warning" /> Fee Estimates
          </h3>
          {fees ? (
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: "No Priority", value: fees.economy, key: "no" },
                { label: "Low", value: fees.hour, key: "low" },
                { label: "Medium", value: fees.halfHour, key: "medium" },
                { label: "High", value: fees.fastest, key: "high" },
              ].map((tier) => (
                <div key={tier.key} className={`rounded-lg p-2 text-center border ${feeColor(tier.key)} transition-all hover:scale-[1.03]`}>
                  <p className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{tier.label}</p>
                  <p className={`text-lg font-black font-mono mt-0.5 ${feeTextColor(tier.key)}`}>{tier.value}</p>
                  <p className="text-[7px] text-muted-foreground/60 font-mono">sat/vB</p>
                </div>
              ))}
            </div>
          ) : <div className="h-20 flex items-center justify-center text-muted-foreground text-xs font-mono">Loading...</div>}
        </div>

        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
            <Activity className="h-3 w-3 text-primary" /> Difficulty Adjustment
          </h3>
          {difficulty ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
                  <span>{difficulty.progressPercent.toFixed(1)}%</span>
                  <span>{formatNum(difficulty.remainingBlocks)} blocks left</span>
                </div>
                <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000" style={{ width: `${difficulty.progressPercent}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">Change</p>
                  <p className={`text-sm font-bold font-mono flex items-center justify-center gap-0.5 ${difficulty.difficultyChange >= 0 ? "text-accent" : "text-destructive"}`}>
                    {difficulty.difficultyChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(difficulty.difficultyChange).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">Avg Block</p>
                  <p className="text-sm font-bold font-mono">~{Math.round(difficulty.timeAvg / 60)}m</p>
                </div>
                <div>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">Retarget</p>
                  <p className="text-xs font-bold font-mono">{new Date(difficulty.estimatedRetargetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
              </div>
            </div>
          ) : <div className="h-20 flex items-center justify-center text-muted-foreground text-xs font-mono">Loading...</div>}
        </div>
      </div>

      {/* Mempool */}
      {mempool && (
        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
            <Layers className="h-3 w-3 text-accent" /> Mempool
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Unconfirmed TXs", value: formatNum(mempool.count) },
              { label: "Memory Usage", value: formatSize(mempool.vsize) },
              { label: "Total Fees", value: `${formatBTC(mempool.total_fee)} BTC` },
              { label: "Min Fee", value: `${mempool.min_fee.toFixed(1)} sat/vB` },
            ].map((item) => (
              <div key={item.label} className="text-center p-2.5 rounded-lg bg-secondary/30 border border-border/20">
                <p className="text-[8px] text-muted-foreground mb-0.5 font-mono uppercase tracking-wider">{item.label}</p>
                <p className="text-base font-bold font-mono">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-center text-muted-foreground pb-3 font-mono">
        Data from mempool.space · Auto-refreshes every 30s
      </p>
    </div>
  );
}
