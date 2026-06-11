import { useState } from "react";
import { Bitcoin, Copy, CheckCircle, XCircle, Clock, Waves, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Pool {
  id: string; name: string; description: string; stratumUrl: string;
  port: number; fees: string; status: "active" | "offline" | "warning"; password?: string;
}

const pools: Pool[] = [
  { id: "public-pool", name: "Public Pool", description: "Open source, no fees, transparent", stratumUrl: "public-pool.io", port: 21496, fees: "0%", status: "active" },
  { id: "solo-ck", name: "Solo CK Pool", description: "Solo mining, 98% block reward", stratumUrl: "solo.ckpool.org", port: 3333, fees: "2%", status: "active" },
  { id: "atlas-pool", name: "AtlasPool", description: "Reliable, performant, globally deployed solo mining", stratumUrl: "solo.atlaspool.io", port: 3333, fees: "0%", status: "active" },
  { id: "letsmine", name: "Letsmine.it", description: "European pool, low latency", stratumUrl: "de1.letsmine.it", port: 3332, fees: "1%", status: "active", password: "diff=auto" },
  { id: "solo-cat", name: "Solo.cat", description: "Solo mining with instant payouts", stratumUrl: "solo.cat", port: 3333, fees: "1%", status: "active" },
];

const statusIcon = (s: Pool["status"]) => {
  if (s === "active") return <CheckCircle className="h-3 w-3 text-accent" />;
  if (s === "offline") return <XCircle className="h-3 w-3 text-destructive" />;
  return <Clock className="h-3 w-3 text-warning" />;
};

export default function Pools() {
  const [copiedPool, setCopiedPool] = useState<string | null>(null);

  const handleCopy = async (pool: Pool, type: 'stratum' | 'password') => {
    const text = type === 'stratum' ? `${pool.stratumUrl}:${pool.port}` : pool.password || '';
    await navigator.clipboard.writeText(text);
    setCopiedPool(`${pool.id}-${type}`);
    toast.success(`Copied ${type === 'stratum' ? 'stratum address' : 'password'}!`);
    setTimeout(() => setCopiedPool(null), 2000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Waves className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold font-mono tracking-tight">Mining Pools</h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Bitcoin Pool Directory</p>
        </div>
      </div>

      {/* Pool list */}
      <div className="space-y-2">
        {pools.map((pool) => (
          <div
            key={pool.id}
            className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 hover:border-primary/20 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/8 border border-primary/15 mt-0.5">
                  <Bitcoin className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm font-mono">{pool.name}</h3>
                    {statusIcon(pool.status)}
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-mono ${pool.fees === "0%" ? "border-accent/30 text-accent" : "border-warning/30 text-warning"}`}>
                      {pool.fees} fee
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{pool.description}</p>

                  {/* Stratum address */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <code className="text-[11px] font-mono bg-secondary/40 px-2 py-1 rounded border border-border/30">
                      {pool.stratumUrl}:{pool.port}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] font-mono gap-1"
                      onClick={() => handleCopy(pool, 'stratum')}
                    >
                      {copiedPool === `${pool.id}-stratum` ? <CheckCircle className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                      {copiedPool === `${pool.id}-stratum` ? "Copied" : "Copy"}
                    </Button>
                    {pool.password && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-mono gap-1"
                        onClick={() => handleCopy(pool, 'password')}
                      >
                        {copiedPool === `${pool.id}-password` ? <CheckCircle className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                        pw: {pool.password}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
