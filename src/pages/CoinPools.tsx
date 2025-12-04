import { useState } from "react";
import { ArrowLeft, Copy, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";

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

const poolsByCoin: Record<string, Pool[]> = {
  bitcoin: [
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
  ],
};

const coinNames: Record<string, string> = {
  bitcoin: "Bitcoin"
};

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

export default function CoinPools() {
  const { coin } = useParams<{ coin: string }>();
  const navigate = useNavigate();
  const [copiedPool, setCopiedPool] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null);

  if (!coin || !poolsByCoin[coin]) {
    navigate('/pools');
    return null;
  }

  const pools = poolsByCoin[coin];
  const coinName = coinNames[coin];

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
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/pools')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Coins
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {coinName} Mining Pools
          </h1>
          <p className="text-muted-foreground mt-1">
            Popular {coinName} mining pools with stratum addresses and information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pools.map((pool) => (
          <Card 
            key={pool.id} 
            className="shadow-card hover:shadow-glow transition-all duration-300"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {pool.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {pool.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(pool.status)}
                  <Badge variant="outline" className={getStatusColor(pool.status)}>
                    {pool.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-sm text-muted-foreground mb-1">Stratum Address</div>
                <div className="font-mono text-sm break-all">
                  {pool.stratumUrl}:{pool.port}
                </div>
              </div>

              {pool.password && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground mb-1">Password</div>
                  <div className="font-mono text-sm break-all">
                    {pool.password}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Fees: </span>
                  <span className={pool.fees.includes("0%") || pool.fees.includes("1.0%") ? "text-green-500 font-medium" : "text-orange-500"}>
                    {pool.fees}
                  </span>
                </div>
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
                      {copiedPassword === pool.id ? "Copied!" : "Copy Password"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}