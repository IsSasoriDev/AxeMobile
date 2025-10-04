import { useState, useEffect } from "react";
import { Calculator as CalcIcon, TrendingUp, Coins, Zap, Clock, DollarSign, Percent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface CoinData {
  name: string;
  symbol: string;
  networkHashrate: number; // in TH/s
  blockReward: number;
  blockTime: number; // in seconds
  price: number; // in USD
  difficulty: number;
}

const coinData: Record<string, CoinData> = {
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    networkHashrate: 600000000, // 600 EH/s = 600,000,000 TH/s
    blockReward: 3.125, // After 2024 halving
    blockTime: 600,
    price: 65000,
    difficulty: 85000000000000,
  },
  bitcoincash: {
    name: "Bitcoin Cash",
    symbol: "BCH",
    networkHashrate: 4000000, // 4 EH/s = 4,000,000 TH/s
    blockReward: 3.125, // After 2024 halving
    blockTime: 600,
    price: 450,
    difficulty: 560000000000,
  },
  digibyte: {
    name: "DigiByte",
    symbol: "DGB",
    networkHashrate: 800000, // 800 PH/s = 800,000 TH/s
    blockReward: 665, // DGB SHA256 block reward (approximate)
    blockTime: 15,
    price: 0.012,
    difficulty: 12000000000,
  },
  ecash: {
    name: "eCash",
    symbol: "XEC",
    networkHashrate: 180000, // 180 PH/s = 180,000 TH/s
    blockReward: 6250000, // XEC has 2 decimals, so this is 62.5 XEC base units
    blockTime: 600,
    price: 0.00003,
    difficulty: 2500000000,
  },
  "bitcoin-ii": {
    name: "Bitcoin-II",
    symbol: "BC2",
    networkHashrate: 15000, // 15 PH/s = 15,000 TH/s
    blockReward: 6.25, // BC2 block reward
    blockTime: 600,
    price: 0.15,
    difficulty: 200000000,
  },
};

export default function Calculator() {
  const [selectedCoin, setSelectedCoin] = useState<string>("bitcoin");
  const [hashrate, setHashrate] = useState<string>("500");
  const [hashrateUnit, setHashrateUnit] = useState<string>("GH/s");
  const [poolFee, setPoolFee] = useState<string>("1");
  const [powerConsumption, setPowerConsumption] = useState<string>("15");
  const [electricityCost, setElectricityCost] = useState<string>("0.10");

  const coin = coinData[selectedCoin];

  // Convert hashrate to TH/s
  const getHashrateInTH = (): number => {
    const hr = parseFloat(hashrate) || 0;
    switch (hashrateUnit) {
      case "GH/s":
        return hr / 1000;
      case "TH/s":
        return hr;
      case "PH/s":
        return hr * 1000;
      default:
        return hr / 1000;
    }
  };

  // Calculate pool mining profitability
  const calculatePoolMining = () => {
    const hashrateInTH = getHashrateInTH();
    const dailyBlocks = (24 * 60 * 60) / coin.blockTime;
    const poolShare = hashrateInTH / coin.networkHashrate;
    
    const dailyReward = dailyBlocks * coin.blockReward * poolShare;
    const feeMultiplier = 1 - (parseFloat(poolFee) / 100);
    const dailyRewardAfterFee = dailyReward * feeMultiplier;
    
    const dailyRevenue = dailyRewardAfterFee * coin.price;
    const weeklyRevenue = dailyRevenue * 7;
    const monthlyRevenue = dailyRevenue * 30;
    const yearlyRevenue = dailyRevenue * 365;

    return {
      dailyCoins: dailyRewardAfterFee,
      weeklyCoins: dailyRewardAfterFee * 7,
      monthlyCoins: dailyRewardAfterFee * 30,
      yearlyCoins: dailyRewardAfterFee * 365,
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue,
    };
  };

  // Calculate solo mining probability
  const calculateSoloMining = () => {
    const hashrateInTH = getHashrateInTH();
    const networkHashrate = coin.networkHashrate;
    
    // Probability of finding a block per attempt
    const probability = hashrateInTH / networkHashrate;
    
    // Expected blocks per day
    const dailyBlocks = (24 * 60 * 60) / coin.blockTime;
    const expectedBlocksPerDay = dailyBlocks * probability;
    const expectedBlocksPerWeek = expectedBlocksPerDay * 7;
    const expectedBlocksPerMonth = expectedBlocksPerDay * 30;
    const expectedBlocksPerYear = expectedBlocksPerDay * 365;
    
    // Time to find a block (on average)
    const secondsPerBlock = coin.blockTime / probability;
    const daysPerBlock = secondsPerBlock / (24 * 60 * 60);
    
    // Revenue if you find a block
    const blockValue = coin.blockReward * coin.price;
    
    return {
      probabilityPercent: probability * 100,
      expectedBlocksPerDay,
      expectedBlocksPerWeek,
      expectedBlocksPerMonth,
      expectedBlocksPerYear,
      daysPerBlock,
      blockValue,
      expectedDailyRevenue: expectedBlocksPerDay * blockValue,
      expectedMonthlyRevenue: expectedBlocksPerMonth * blockValue,
      expectedYearlyRevenue: expectedBlocksPerYear * blockValue,
    };
  };

  // Calculate costs
  const calculateCosts = () => {
    const power = parseFloat(powerConsumption) || 0;
    const cost = parseFloat(electricityCost) || 0;
    
    const dailyCost = (power / 1000) * 24 * cost;
    const weeklyCost = dailyCost * 7;
    const monthlyCost = dailyCost * 30;
    const yearlyCost = dailyCost * 365;
    
    return {
      dailyCost,
      weeklyCost,
      monthlyCost,
      yearlyCost,
    };
  };

  const poolResults = calculatePoolMining();
  const soloResults = calculateSoloMining();
  const costs = calculateCosts();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCoins = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
  };

  const formatTime = (days: number) => {
    if (days < 1) {
      const hours = days * 24;
      if (hours < 1) {
        const minutes = hours * 60;
        return `${minutes.toFixed(1)} minutes`;
      }
      return `${hours.toFixed(1)} hours`;
    } else if (days < 30) {
      return `${days.toFixed(1)} days`;
    } else if (days < 365) {
      const months = days / 30;
      return `${months.toFixed(1)} months`;
    } else {
      const years = days / 365;
      return `${years.toFixed(1)} years`;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Mining Calculator
        </h1>
        <p className="text-muted-foreground mt-1">
          Calculate your mining profitability for pool and solo mining
        </p>
      </div>

      {/* Input Parameters */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalcIcon className="h-5 w-5" />
            Mining Parameters
          </CardTitle>
          <CardDescription>
            Enter your mining setup details to calculate profitability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Coin Selection */}
            <div className="space-y-2">
              <Label htmlFor="coin">Cryptocurrency</Label>
              <Select value={selectedCoin} onValueChange={setSelectedCoin}>
                <SelectTrigger id="coin">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(coinData).map(([key, data]) => (
                    <SelectItem key={key} value={key}>
                      {data.name} ({data.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hashrate */}
            <div className="space-y-2">
              <Label htmlFor="hashrate">Your Hashrate</Label>
              <div className="flex gap-2">
                <Input
                  id="hashrate"
                  type="number"
                  value={hashrate}
                  onChange={(e) => setHashrate(e.target.value)}
                  placeholder="500"
                  className="flex-1"
                />
                <Select value={hashrateUnit} onValueChange={setHashrateUnit}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GH/s">GH/s</SelectItem>
                    <SelectItem value="TH/s">TH/s</SelectItem>
                    <SelectItem value="PH/s">PH/s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pool Fee */}
            <div className="space-y-2">
              <Label htmlFor="pool-fee">Pool Fee (%)</Label>
              <Input
                id="pool-fee"
                type="number"
                value={poolFee}
                onChange={(e) => setPoolFee(e.target.value)}
                placeholder="1"
                step="0.1"
              />
            </div>

            {/* Power Consumption */}
            <div className="space-y-2">
              <Label htmlFor="power">Power Consumption (W)</Label>
              <Input
                id="power"
                type="number"
                value={powerConsumption}
                onChange={(e) => setPowerConsumption(e.target.value)}
                placeholder="15"
              />
            </div>

            {/* Electricity Cost */}
            <div className="space-y-2">
              <Label htmlFor="electricity">Electricity Cost ($/kWh)</Label>
              <Input
                id="electricity"
                type="number"
                value={electricityCost}
                onChange={(e) => setElectricityCost(e.target.value)}
                placeholder="0.10"
                step="0.01"
              />
            </div>

            {/* Network Info */}
            <div className="space-y-2">
              <Label>Network Hashrate</Label>
              <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm">
                {(coin.networkHashrate / 1000000).toFixed(2)} EH/s
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Tabs */}
      <Tabs defaultValue="pool" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pool">Pool Mining</TabsTrigger>
          <TabsTrigger value="solo">Solo Mining</TabsTrigger>
        </TabsList>

        {/* Pool Mining Results */}
        <TabsContent value="pool" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Pool Mining Profitability
              </CardTitle>
              <CardDescription>
                Expected earnings when mining in a pool with {poolFee}% fee
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Revenue Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Daily
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{formatCurrency(poolResults.dailyRevenue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCoins(poolResults.dailyCoins)} {coin.symbol}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Weekly
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{formatCurrency(poolResults.weeklyRevenue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCoins(poolResults.weeklyCoins)} {coin.symbol}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Monthly
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{formatCurrency(poolResults.monthlyRevenue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCoins(poolResults.monthlyCoins)} {coin.symbol}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Yearly
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{formatCurrency(poolResults.yearlyRevenue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCoins(poolResults.yearlyCoins)} {coin.symbol}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Costs and Profit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-red-500/5 border-red-500/20">
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Monthly Electricity Cost
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-500">{formatCurrency(costs.monthlyCost)}</div>
                  </CardContent>
                </Card>

                <Card className="bg-green-500/5 border-green-500/20">
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Monthly Net Profit
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">
                      {formatCurrency(poolResults.monthlyRevenue - costs.monthlyCost)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-500/5 border-blue-500/20">
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      Profit Margin
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-500">
                      {((((poolResults.monthlyRevenue - costs.monthlyCost) / poolResults.monthlyRevenue) * 100) || 0).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Solo Mining Results */}
        <TabsContent value="solo" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-orange-500" />
                Solo Mining Probability
              </CardTitle>
              <CardDescription>
                Your chances of finding blocks when mining solo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Probability Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardDescription>Block Finding Probability</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {soloResults.probabilityPercent < 0.01
                        ? soloResults.probabilityPercent.toExponential(2)
                        : soloResults.probabilityPercent.toFixed(6)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-500/5 border-orange-500/20">
                  <CardHeader className="pb-3">
                    <CardDescription>Expected Time to Block</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500">
                      {formatTime(soloResults.daysPerBlock)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-500/5 border-green-500/20">
                  <CardHeader className="pb-3">
                    <CardDescription>Block Reward Value</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-500">
                        {formatCurrency(soloResults.blockValue)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {coin.blockReward} {coin.symbol}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Expected Earnings */}
              <div>
                <h4 className="text-sm font-medium mb-3">Expected Earnings (Statistical Average)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Daily</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <div className="text-xl font-bold">{formatCurrency(soloResults.expectedDailyRevenue)}</div>
                        <div className="text-xs text-muted-foreground">
                          ~{soloResults.expectedBlocksPerDay.toFixed(4)} blocks
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Weekly</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <div className="text-xl font-bold">
                          {formatCurrency(soloResults.expectedDailyRevenue * 7)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ~{soloResults.expectedBlocksPerWeek.toFixed(4)} blocks
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Monthly</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <div className="text-xl font-bold">{formatCurrency(soloResults.expectedMonthlyRevenue)}</div>
                        <div className="text-xs text-muted-foreground">
                          ~{soloResults.expectedBlocksPerMonth.toFixed(4)} blocks
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Yearly</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <div className="text-xl font-bold">{formatCurrency(soloResults.expectedYearlyRevenue)}</div>
                        <div className="text-xs text-muted-foreground">
                          ~{soloResults.expectedBlocksPerYear.toFixed(2)} blocks
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Warning for low probability */}
              {soloResults.probabilityPercent < 0.001 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      ⚠️ Low Probability
                    </Badge>
                    <div className="flex-1 text-sm">
                      <p className="font-medium mb-1">Solo mining not recommended</p>
                      <p className="text-muted-foreground">
                        With your current hashrate, it would take approximately {formatTime(soloResults.daysPerBlock)} to 
                        find a block. Consider pool mining for more consistent returns.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disclaimer */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Disclaimer:</strong> Mining profitability calculations are estimates based on current network conditions, 
            coin prices, and difficulty. Actual results may vary significantly due to market volatility, network difficulty changes, 
            and hardware performance. Solo mining is highly variable and actual time to find blocks can differ greatly from statistical averages.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
