import { useState } from "react";
import { Calculator as CalcIcon, TrendingUp, Coins, Zap, Clock, DollarSign, Percent, RefreshCw, Activity, Hash, Cpu } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Button } from "@/components/ui/button";
import { useCoinStats } from "@/hooks/useCoinStats";
import { toast } from "sonner";

export default function Calculator() {
  const { coinData, isLoading: statsLoading, lastUpdate, refreshStats } = useCoinStats();
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
    
    const probability = hashrateInTH / networkHashrate;
    const dailyBlocks = (24 * 60 * 60) / coin.blockTime;
    const expectedBlocksPerDay = dailyBlocks * probability;
    const expectedBlocksPerWeek = expectedBlocksPerDay * 7;
    const expectedBlocksPerMonth = expectedBlocksPerDay * 30;
    const expectedBlocksPerYear = expectedBlocksPerDay * 365;
    
    const secondsPerBlock = coin.blockTime / probability;
    const daysPerBlock = secondsPerBlock / (24 * 60 * 60);
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
    <div className="container mx-auto p-4 md:p-8 min-h-screen space-y-8">
      {/* Hero Section */}
      <AnimatedCard animation="scale" delay={0}>
        <div className="relative overflow-hidden rounded-3xl p-12 mb-8 border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/5 to-background" style={{ boxShadow: 'var(--shadow-glow)' }}>
          <div className="absolute inset-0 opacity-5 bg-gradient-primary" />
          
          <div className="relative z-10 text-center space-y-6">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Cpu className="h-12 w-12 text-primary animate-float" />
              <h1 
                className="text-5xl md:text-7xl font-bold text-foreground" 
                style={{ 
                  textShadow: '0 0 40px hsl(var(--primary) / 0.6), 0 0 80px hsl(var(--primary) / 0.3), 0 0 120px hsl(var(--primary) / 0.2)'
                }}
              >
                Mining Calculator
              </h1>
              <Coins className="h-12 w-12 text-accent animate-float" style={{ animationDelay: '1s' }} />
            </div>
            
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Badge variant="outline" className="px-4 py-2 text-sm font-semibold border-success text-success bg-success/10">
                <Activity className="h-4 w-4 mr-2 inline animate-pulse" />
                Live Data
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-sm font-semibold border-primary text-primary bg-primary/10">
                Real-Time Network Stats
              </Badge>
              {lastUpdate && (
                <Badge variant="outline" className="px-3 py-1.5 text-xs border-muted-foreground/30">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </Badge>
              )}
            </div>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Calculate your potential mining earnings with live network statistics
            </p>
            
            <Button
              onClick={() => {
                refreshStats();
                toast.success('Refreshing live data...');
              }}
              disabled={statsLoading}
              size="lg"
              className="gap-2 hover:scale-105 transition-all duration-300"
              style={{ boxShadow: 'var(--shadow-glow)' }}
            >
              <RefreshCw className={`h-5 w-5 ${statsLoading ? 'animate-spin' : ''}`} />
              {statsLoading ? "Updating..." : "Refresh Live Stats"}
            </Button>
          </div>
        </div>
      </AnimatedCard>

      {/* Input Parameters */}
      <AnimatedCard animation="slide-up" delay={100}>
        <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl animate-glow-pulse">
                  <CalcIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Mining Parameters</CardTitle>
                  <CardDescription className="mt-1">
                    Configure your mining setup
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Coin Selection */}
              <div className="space-y-2">
                <Label htmlFor="coin" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Cryptocurrency
                </Label>
                <Input
                  type="text"
                  value="Bitcoin (BTC)"
                  disabled
                  className="border-primary/20 bg-muted/50 cursor-not-allowed"
                />
              </div>

              {/* Hashrate */}
              <div className="space-y-2">
                <Label htmlFor="hashrate" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Your Hashrate
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="hashrate"
                    type="number"
                    value={hashrate}
                    onChange={(e) => setHashrate(e.target.value)}
                    placeholder="500"
                    className="flex-1 border-primary/20 focus:border-primary/60"
                  />
                  <Select value={hashrateUnit} onValueChange={setHashrateUnit}>
                    <SelectTrigger className="w-24 border-primary/20">
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
                <Label htmlFor="pool-fee" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Pool Fee (%)
                </Label>
                <Input
                  id="pool-fee"
                  type="number"
                  value={poolFee}
                  onChange={(e) => setPoolFee(e.target.value)}
                  placeholder="1"
                  step="0.1"
                  className="border-primary/20 focus:border-primary/60"
                />
              </div>

              {/* Power Consumption */}
              <div className="space-y-2">
                <Label htmlFor="power" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Power Consumption (W)
                </Label>
                <Input
                  id="power"
                  type="number"
                  value={powerConsumption}
                  onChange={(e) => setPowerConsumption(e.target.value)}
                  placeholder="15"
                  className="border-primary/20 focus:border-primary/60"
                />
              </div>

              {/* Electricity Cost */}
              <div className="space-y-2">
                <Label htmlFor="electricity" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Electricity Cost ($/kWh)
                </Label>
                <Input
                  id="electricity"
                  type="number"
                  value={electricityCost}
                  onChange={(e) => setElectricityCost(e.target.value)}
                  placeholder="0.10"
                  step="0.01"
                  className="border-primary/20 focus:border-primary/60"
                />
              </div>
            </div>

            {/* Live Network Info */}
            <div className="mt-8 pt-8 border-t border-border/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-success animate-pulse" />
                Live Network Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-all hover:scale-105">
                  <div className="text-sm text-muted-foreground mb-2">Network Hashrate</div>
                  {statsLoading ? (
                    <div className="h-8 bg-muted/50 rounded animate-pulse" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground" style={{ textShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}>
                      {(coin.networkHashrate / 1000000).toFixed(2)} EH/s
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-transparent border border-accent/20 hover:border-accent/40 transition-all hover:scale-105">
                  <div className="text-sm text-muted-foreground mb-2">Current Price</div>
                  {statsLoading ? (
                    <div className="h-8 bg-muted/50 rounded animate-pulse" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground" style={{ textShadow: '0 0 20px hsl(var(--accent) / 0.4)' }}>
                      ${coin.price.toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-info/10 to-transparent border border-info/20 hover:border-info/40 transition-all hover:scale-105">
                  <div className="text-sm text-muted-foreground mb-2">Difficulty</div>
                  {statsLoading ? (
                    <div className="h-8 bg-muted/50 rounded animate-pulse" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground" style={{ textShadow: '0 0 20px hsl(var(--info) / 0.4)' }}>
                      {(coin.difficulty / 1e12).toFixed(2)}T
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* Results Tabs */}
      <AnimatedCard delay={200}>
        <Tabs defaultValue="pool" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="pool" className="text-base">Pool Mining</TabsTrigger>
            <TabsTrigger value="solo" className="text-base">Solo Mining</TabsTrigger>
          </TabsList>

          {/* Pool Mining Results */}
          <TabsContent value="pool" className="space-y-4 mt-6">
            <Card className="border-success/30 hover:border-success/50 transition-all duration-300" style={{ boxShadow: 'var(--shadow-card)' }}>
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-success/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-success/10 rounded-xl animate-glow-pulse">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Pool Mining Profitability</CardTitle>
                    <CardDescription className="mt-1">
                      Expected earnings mining in a pool with {poolFee}% fee
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                {/* Revenue Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/30 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-success mb-3">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Daily</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mb-1" style={{ textShadow: '0 0 20px hsl(var(--success) / 0.4)' }}>
                      {formatCurrency(poolResults.dailyRevenue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCoins(poolResults.dailyCoins)} {coin.symbol}
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-primary mb-3">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Weekly</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mb-1">
                      {formatCurrency(poolResults.weeklyRevenue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCoins(poolResults.weeklyCoins)} {coin.symbol}
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-accent/10 to-transparent border border-accent/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-accent mb-3">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Monthly</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mb-1">
                      {formatCurrency(poolResults.monthlyRevenue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCoins(poolResults.monthlyCoins)} {coin.symbol}
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-info/10 to-transparent border border-info/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-info mb-3">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Yearly</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mb-1">
                      {formatCurrency(poolResults.yearlyRevenue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCoins(poolResults.yearlyCoins)} {coin.symbol}
                    </div>
                  </div>
                </div>

                {/* Costs and Profit */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border/50">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-destructive/10 to-transparent border border-destructive/30 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-destructive mb-3">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">Monthly Power Cost</span>
                    </div>
                    <div className="text-3xl font-bold text-destructive">
                      {formatCurrency(costs.monthlyCost)}
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-success/10 to-transparent border border-success/30 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-success mb-3">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm font-medium">Monthly Net Profit</span>
                    </div>
                    <div className="text-3xl font-bold text-success" style={{ textShadow: '0 0 25px hsl(var(--success) / 0.5)' }}>
                      {formatCurrency(poolResults.monthlyRevenue - costs.monthlyCost)}
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/30 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 text-primary mb-3">
                      <Percent className="h-4 w-4" />
                      <span className="text-sm font-medium">Profit Margin</span>
                    </div>
                    <div className="text-3xl font-bold text-primary">
                      {((((poolResults.monthlyRevenue - costs.monthlyCost) / poolResults.monthlyRevenue) * 100) || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Solo Mining Results */}
          <TabsContent value="solo" className="space-y-4 mt-6">
            <Card className="border-warning/30 hover:border-warning/50 transition-all duration-300" style={{ boxShadow: 'var(--shadow-card)' }}>
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-warning/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-warning/10 rounded-xl animate-glow-pulse">
                    <Coins className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Solo Mining Statistics</CardTitle>
                    <CardDescription className="mt-1">
                      Probability and expected earnings when solo mining
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                {/* Key Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/30 hover:scale-105 transition-all duration-300">
                    <div className="text-sm text-muted-foreground mb-3">Block Find Probability</div>
                    <div className="text-4xl font-bold text-warning mb-2" style={{ textShadow: '0 0 20px hsl(var(--warning) / 0.4)' }}>
                      {soloResults.probabilityPercent.toExponential(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground">per block attempt</div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-info/10 to-transparent border border-info/20 hover:scale-105 transition-all duration-300">
                    <div className="text-sm text-muted-foreground mb-3">Time to Find Block</div>
                    <div className="text-4xl font-bold text-info mb-2">
                      {formatTime(soloResults.daysPerBlock)}
                    </div>
                    <div className="text-xs text-muted-foreground">average estimate</div>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-success/10 to-transparent border border-success/20 hover:scale-105 transition-all duration-300">
                    <div className="text-sm text-muted-foreground mb-3">Block Reward Value</div>
                    <div className="text-4xl font-bold text-success mb-2" style={{ textShadow: '0 0 20px hsl(var(--success) / 0.4)' }}>
                      {formatCurrency(soloResults.blockValue)}
                    </div>
                    <div className="text-xs text-muted-foreground">{coin.blockReward} {coin.symbol}</div>
                  </div>
                </div>

                {/* Expected Earnings */}
                <div className="pt-6 border-t border-border/50">
                  <h3 className="text-lg font-semibold mb-4">Expected Earnings (Statistical Average)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 transition-all">
                      <div className="text-sm text-muted-foreground mb-2">Expected Daily</div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(soloResults.expectedDailyRevenue)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ~{soloResults.expectedBlocksPerDay.toExponential(2)} blocks
                      </div>
                    </div>

                    <div className="p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 transition-all">
                      <div className="text-sm text-muted-foreground mb-2">Expected Monthly</div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(soloResults.expectedMonthlyRevenue)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ~{soloResults.expectedBlocksPerMonth.toFixed(4)} blocks
                      </div>
                    </div>

                    <div className="p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 transition-all">
                      <div className="text-sm text-muted-foreground mb-2">Expected Yearly</div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(soloResults.expectedYearlyRevenue)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ~{soloResults.expectedBlocksPerYear.toFixed(2)} blocks
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </AnimatedCard>
    </div>
  );
}
