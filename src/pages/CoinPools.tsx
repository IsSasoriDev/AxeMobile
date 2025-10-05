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
  bitcoincash: [
    {
      id: "antpool-bch", 
      name: "AntPool BCH",
      description: "Major Bitcoin Cash mining pool with reliable payouts and low fees.",
      stratumUrl: "stratum+tcp://stratum-bch.antpool.com",
      port: 3333,
      fees: "2.5%",
      status: "active",
    },
    {
      id: "viabtc-bch",
      name: "ViaBTC BCH", 
      description: "Leading Bitcoin Cash pool with advanced mining features.",
      stratumUrl: "stratum+tcp://bch.viabtc.com",
      port: 3333,
      fees: "2.0%",
      status: "active",
    },
    {
      id: "f2pool-bch",
      name: "F2Pool BCH",
      description: "Established Bitcoin Cash mining pool with global infrastructure.",
      stratumUrl: "stratum+tcp://stratum-bch.f2pool.com", 
      port: 3333,
      fees: "2.5%",
      status: "active",
    },
    {
      id: "btccom-bch",
      name: "BTC.com BCH",
      description: "Professional Bitcoin Cash mining pool with transparent operations.",
      stratumUrl: "stratum+tcp://bch.pool.btc.com",
      port: 3333,
      fees: "1.5%",
      status: "active",
    },
    {
      id: "mining-dutch-bch",
      name: "Mining Dutch BCH",
      description: "European Bitcoin Cash pool focused on decentralization.",
      stratumUrl: "stratum+tcp://bch.mining-dutch.nl",
      port: 3333,
      fees: "1.0%",
      status: "active",
    },
  ],
  digibyte: [
    {
      id: "theblocksfactory-dgb",
      name: "TheBlocksFactory DGB",
      description: "Dedicated DigiByte mining pool with multi-algorithm support.",
      stratumUrl: "stratum+tcp://dgb-sha256.theblocksfactory.com",
      port: 3333,
      fees: "1.0%",
      status: "active",
    },
    {
      id: "zpool-dgb",
      name: "Zpool DGB",
      description: "Multi-algorithm pool supporting DigiByte with automatic payouts.",
      stratumUrl: "stratum+tcp://sha256.mine.zpool.ca",
      port: 4333,
      fees: "2.0%",
      status: "active",
    },
    {
      id: "prohashing-dgb",
      name: "ProHashing DGB",
      description: "Professional DigiByte pool with advanced profit switching.",
      stratumUrl: "stratum+tcp://prohashing.com",
      port: 3333,
      fees: "4.99%",
      status: "active",
      password: "a=sha256,n=DGB",
    },
    {
      id: "multipool-dgb",
      name: "Multipool DGB",
      description: "Multi-coin pool with DigiByte SHA256 support.",
      stratumUrl: "stratum+tcp://sha256.multipool.us",
      port: 3333,
      fees: "1.5%",
      status: "active",
    },
    {
      id: "mining-dutch-dgb",
      name: "Mining Dutch DGB",
      description: "European DigiByte pool with low fees and reliable service.",
      stratumUrl: "stratum+tcp://dgb.mining-dutch.nl",
      port: 3333,
      fees: "1.0%",
      status: "active",
    },
  ],
  ecash: [
    {
      id: "viabtc-xec",
      name: "ViaBTC XEC",
      description: "Leading eCash mining pool with professional services.",
      stratumUrl: "stratum+tcp://xec.viabtc.com",
      port: 3333,
      fees: "2.0%",
      status: "active",
    },
    {
      id: "mining-dutch-xec",
      name: "Mining Dutch XEC",
      description: "European eCash pool with competitive fees and reliable payouts.",
      stratumUrl: "stratum+tcp://xec.mining-dutch.nl",
      port: 3333,
      fees: "1.0%",
      status: "active",
    },
    {
      id: "zpool-xec",
      name: "Zpool XEC",
      description: "Multi-algorithm pool supporting eCash with auto-exchange features.",
      stratumUrl: "stratum+tcp://sha256.mine.zpool.ca",
      port: 4333,
      fees: "2.0%",
      status: "active",
    },
    {
      id: "prohashing-xec",
      name: "ProHashing XEC",
      description: "Advanced eCash mining pool with profit optimization.",
      stratumUrl: "stratum+tcp://prohashing.com",
      port: 3333,
      fees: "4.99%",
      status: "active",
      password: "a=sha256,n=XEC",
    },
  ],
  "bitcoin-ii": [
    {
      id: "kryptex-bc2",
      name: "Kryptex BC2",
      description: "Global Bitcoin-II mining pool with competitive rates and reliable payouts.",
      stratumUrl: "stratum+tcp://pool.kryptex.com",
      port: 7019,
      fees: "1.0%",
      status: "active",
    },
    {
      id: "mining-dutch-bc2",
      name: "Mining Dutch BC2",
      description: "European Bitcoin-II pool with merged mining support for NMC, EMC, XMY, and TRC.",
      stratumUrl: "stratum+tcp://bc2.mining-dutch.nl",
      port: 3333,
      fees: "1.0%",
      status: "active",
    },
    {
      id: "jellyfc-bc2",
      name: "JellyFC Pool",
      description: "European Bitcoin-II mining pool with stable infrastructure and competitive fees.",
      stratumUrl: "stratum+tcp://bitcoin2.jellyfc.com",
      port: 5015,
      fees: "1.5%",
      status: "active",
    },
    {
      id: "zpool-bc2",
      name: "Zpool BC2",
      description: "Multi-algorithm pool supporting Bitcoin-II with automatic payouts.",
      stratumUrl: "stratum+tcp://sha256.mine.zpool.ca",
      port: 4333,
      fees: "2.0%",
      status: "active",
    },
    {
      id: "1miner-bc2",
      name: "1Miner",
      description: "European Bitcoin-II pool with reliable operations and competitive rates.",
      stratumUrl: "stratum+tcp://eu1.1miner.net",
      port: 4343,
      fees: "1.5%",
      status: "active",
    },
    {
      id: "nitopool-bc2",
      name: "NitoPool",
      description: "French Bitcoin-II mining pool with stable infrastructure.",
      stratumUrl: "stratum+tcp://bc2.stratum.nitopool.fr",
      port: 3002,
      fees: "1.0%",
      status: "active",
    },
  ],
};

const coinNames: Record<string, string> = {
  bitcoin: "Bitcoin",
  bitcoincash: "Bitcoin Cash", 
  digibyte: "DigiByte",
  ecash: "eCash",
  "bitcoin-ii": "Bitcoin-II"
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