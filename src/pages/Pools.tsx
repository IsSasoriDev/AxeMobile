import { useState } from "react";
import { Bitcoin, ChevronDown, Copy, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface Pool {
  id: string;
  name: string;
  description: string;
  stratumUrl: string;
  port: number;
  fees: string;
  status: "active" | "offline" | "warning";
  password?: string;
}

interface CryptoCoin {
  id: string;
  name: string;
  symbol: string;
  description: string;
  icon: any;
  color: string;
  pools: Pool[];
}

const coins: CryptoCoin[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    description: "The original cryptocurrency and most secure blockchain network",
    icon: Bitcoin,
    color: "text-orange-500",
    pools: [
      {
        id: "public-pool",
        name: "Public Pool",
        description: "Open source, no fees, transparent mining pool",
        stratumUrl: "public-pool.io",
        port: 21496,
        fees: "0% fees",
        status: "active",
      },
      {
        id: "solo-ck",
        name: "Solo CK Pool",
        description: "Solo mining pool by ckpool, 98% block reward",
        stratumUrl: "solo.ckpool.org",
        port: 3333,
        fees: "2% fee",
        status: "active",
      },
      {
        id: "letsmine",
        name: "Letsmine.it",
        description: "European Bitcoin mining pool with low latency",
        stratumUrl: "de1.letsmine.it",
        port: 3332,
        fees: "1% fee",
        status: "active",
        password: "diff=auto"
      },
      {
        id: "solo-cat",
        name: "Solo.cat Pool",
        description: "Solo mining pool with instant payouts",
        stratumUrl: "solo.cat",
        port: 3333,
        fees: "1% fee",
        status: "active",
      }
    ]
  }
];

const getStatusIcon = (status: Pool["status"]) => {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "offline":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
};

const getStatusColor = (status: Pool["status"]) => {
  switch (status) {
    case "active":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "offline":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "warning":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  }
};

export default function Pools() {
  const [openCoin, setOpenCoin] = useState<string | null>(null);
  const [copiedPool, setCopiedPool] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null);

  const handleCopyStratum = async (pool: Pool) => {
    const stratumString = `${pool.stratumUrl}:${pool.port}`;
    try {
      await navigator.clipboard.writeText(stratumString);
      setCopiedPool(pool.id);
      toast.success(`Copied ${pool.name} stratum address!`);
      setTimeout(() => setCopiedPool(null), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCopyPassword = async (pool: Pool) => {
    if (!pool.password) return;
    try {
      await navigator.clipboard.writeText(pool.password);
      setCopiedPassword(pool.id);
      toast.success(`Copied ${pool.name} password!`);
      setTimeout(() => setCopiedPassword(null), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Mining Pools
        </h1>
        <p className="text-muted-foreground mt-1">
          Click on a cryptocurrency to see available mining pools
        </p>
      </div>

      <div className="space-y-4">
        {coins.map((coin) => (
          <Collapsible
            key={coin.id}
            open={openCoin === coin.id}
            onOpenChange={(open) => setOpenCoin(open ? coin.id : null)}
          >
            <Card className="shadow-card hover:shadow-glow transition-all duration-300">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none transition-colors hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <coin.icon className={`h-10 w-10 ${coin.color}`} />
                      <div>
                        <div className="text-2xl">{coin.name}</div>
                        <div className="text-sm text-muted-foreground font-normal">{coin.symbol}</div>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-muted-foreground">
                        {coin.pools.length} pools
                      </Badge>
                      <ChevronDown 
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out ${
                          openCoin === coin.id ? "rotate-180" : ""
                        }`} 
                      />
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {coin.description}
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  <div className="border-t border-border/50 pt-4" />
                  {coin.pools.map((pool, index) => (
                    <div
                      key={pool.id}
                      className="bg-muted/30 rounded-lg p-4 space-y-3 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {pool.name}
                            {getStatusIcon(pool.status)}
                          </h3>
                          <p className="text-sm text-muted-foreground">{pool.description}</p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(pool.status)}>
                          {pool.status}
                        </Badge>
                      </div>
                      
                      <div className="bg-background/50 rounded p-2">
                        <div className="text-xs text-muted-foreground mb-1">Stratum Address</div>
                        <div className="font-mono text-sm">{pool.stratumUrl}:{pool.port}</div>
                      </div>

                      {pool.password && (
                        <div className="bg-background/50 rounded p-2">
                          <div className="text-xs text-muted-foreground mb-1">Password</div>
                          <div className="font-mono text-sm">{pool.password}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-sm">
                          <span className="text-muted-foreground">Fees: </span>
                          <span className={pool.fees.includes("0%") ? "text-green-500 font-medium" : "text-orange-500"}>
                            {pool.fees}
                          </span>
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyStratum(pool)}
                            className="gap-2"
                          >
                            {copiedPool === pool.id ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {copiedPool === pool.id ? "Copied!" : "Copy"}
                          </Button>
                          {pool.password && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyPassword(pool)}
                              className="gap-2"
                            >
                              {copiedPassword === pool.id ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                              {copiedPassword === pool.id ? "Copied!" : "Password"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}