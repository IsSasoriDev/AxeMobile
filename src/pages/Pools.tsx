import { Waves, Bitcoin, Coins, CircuitBoard, Banknote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CryptoCoin {
  id: string;
  name: string;
  symbol: string;
  description: string;
  icon: any;
  color: string;
}

const coins: CryptoCoin[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    description: "The original cryptocurrency and most secure blockchain network",
    icon: Bitcoin,
    color: "text-orange-500"
  },
  {
    id: "bitcoincash", 
    name: "Bitcoin Cash",
    symbol: "BCH",
    description: "Peer-to-peer electronic cash system with larger block sizes",
    icon: Coins,
    color: "text-green-500"
  },
  {
    id: "digibyte",
    name: "DigiByte",
    symbol: "DGB", 
    description: "Multi-algorithm blockchain with enhanced security and speed",
    icon: CircuitBoard,
    color: "text-blue-500"
  },
  {
    id: "ecash",
    name: "eCash",
    symbol: "XEC",
    description: "Digital currency designed for everyday transactions",
    icon: Banknote,
    color: "text-purple-500"
  },
  {
    id: "bitcoin-ii",
    name: "Bitcoin-II",
    symbol: "BC2",
    description: "Next generation Bitcoin with enhanced features and efficiency",
    icon: Bitcoin,
    color: "text-orange-500"
  }
];

export default function Pools() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Select Cryptocurrency
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose a cryptocurrency to see its popular mining pools
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {coins.map((coin) => (
          <Card 
            key={coin.id}
            className="shadow-card hover:shadow-glow transition-all duration-300 cursor-pointer"
            onClick={() => navigate(`/pools/${coin.id}`)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <coin.icon className={`h-8 w-8 ${coin.color}`} />
                <div>
                  <div className="text-xl">{coin.name}</div>
                  <div className="text-sm text-muted-foreground font-normal">{coin.symbol}</div>
                </div>
              </CardTitle>
              <CardDescription className="mt-2">
                {coin.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Button className="w-full gap-2">
                <Waves className="h-4 w-4" />
                View {coin.name} Pools
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-6 text-center">
        <Waves className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold mb-2">Mining Pool Selection</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Each cryptocurrency has different mining pools with varying features, fees, and mining algorithms. 
          Choose the coin you want to mine to see the most popular and reliable pools for that network.
        </p>
      </div>
    </div>
  );
}