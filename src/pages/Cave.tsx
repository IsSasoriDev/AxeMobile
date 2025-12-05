import { useState, useEffect } from "react";
import { useMiningGame } from "@/hooks/useMiningGame";
import { useMiningShop } from "@/hooks/useMiningShop";
import { useNetworkScanner } from "@/hooks/useNetworkScanner";
import { useMiningSound } from "@/hooks/useMiningSound";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pickaxe, Package, Trash2, TrendingUp, ShoppingCart, Coins, Zap, Clock, DollarSign, Sparkles, Volume2, VolumeX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import coalOre from "@/assets/ores/coal.png";
import copperOre from "@/assets/ores/copper.png";
import ironOre from "@/assets/ores/iron.png";
import goldOre from "@/assets/ores/gold.png";
import emeraldOre from "@/assets/ores/emerald.png";
import diamondOre from "@/assets/ores/diamond.png";
import bitcoinOre from "@/assets/ores/bitcoin.png";

export default function Cave() {
  const { totalHashRate } = useNetworkScanner();
  const [showSellAllDialog, setShowSellAllDialog] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('caveSoundMuted');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('caveSoundMuted', String(isMuted));
  }, [isMuted]);
  
  const { 
    btcBalance, 
    purchasedItems, 
    shopItems, 
    addBTC, 
    purchaseItem, 
    getActiveBoosts,
    getLuckMultiplier,
    hasAutoMiner 
  } = useMiningShop();
  
  const { playSound } = useMiningSound();
  
  const { inventory, recentFind, totalValue, clearInventory, sellOre } = useMiningGame(
    totalHashRate, 
    getLuckMultiplier(),
    hasAutoMiner(),
    addBTC
  );

  const activeBoosts = getActiveBoosts();

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      case 'epic': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'rare': return 'bg-gradient-to-r from-blue-500 to-cyan-500';
      case 'uncommon': return 'bg-gradient-to-r from-green-500 to-emerald-500';
      default: return 'bg-muted';
    }
  };

  const getRarityBadgeVariant = (rarity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (rarity) {
      case 'legendary': return 'default';
      case 'epic': return 'secondary';
      case 'rare': return 'default';
      default: return 'outline';
    }
  };

  const handlePurchase = (itemId: string) => {
    const success = purchaseItem(itemId);
    if (success) {
      playSound('purchase');
      toast.success('Item purchased successfully!');
    } else {
      const item = shopItems.find(i => i.id === itemId);
      if (item && btcBalance < item.price) {
        toast.error('Not enough BTC!');
      } else {
        toast.error('Already owned or cannot purchase');
      }
    }
  };

  const handleSellOre = (oreId: string, amount: number, value: number) => {
    sellOre(oreId, amount);
    const btcEarned = value * amount * 0.1;
    toast.success(`Sold for ${btcEarned.toFixed(1)} BTC!`);
  };

  const handleSellAll = () => {
    const totalEarned = inventory.reduce((sum, item) => sum + (item.value * item.count * 0.1), 0);
    addBTC(totalEarned);
    clearInventory();
    setShowSellAllDialog(false);
    toast.success(`Sold all items for ${totalEarned.toFixed(2)} BTC!`);
  };

  const oreImages: Record<string, string> = {
    coal: coalOre,
    copper: copperOre,
    iron: ironOre,
    gold: goldOre,
    emerald: emeraldOre,
    diamond: diamondOre,
    bitcoin: bitcoinOre,
  };

  const getTimeRemaining = (expiresAt?: Date) => {
    if (!expiresAt) return 'Permanent';
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Mining Cave
            </h1>
            <p className="text-muted-foreground mt-2">
              Your miners are working hard to find valuable resources
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="shrink-0"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">BTC Balance</div>
            <div className="text-2xl font-bold text-orange-500 flex items-center gap-1">
              ₿ {btcBalance.toFixed(1)}
            </div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Hashrate</div>
            <div className="text-2xl font-bold text-primary">
              {(totalHashRate / 1000).toFixed(2)} TH/s
            </div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Luck Boost</div>
            <div className="text-2xl font-bold text-green-500">
              {getLuckMultiplier().toFixed(1)}x
            </div>
          </div>
        </div>
      </div>

      {/* Cave Animation Area with Miner Character */}
      <Card className="relative overflow-hidden min-h-[400px] bg-gradient-to-b from-stone-800 to-stone-950 dark:from-stone-950 dark:to-black">
        <CardContent className="p-8">
          <div className="relative h-[350px] flex items-center justify-center">
            {/* Cave Background */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-10 left-10 text-6xl">🪨</div>
              <div className="absolute top-32 right-20 text-4xl">⛰️</div>
              <div className="absolute bottom-20 left-32 text-5xl">🗻</div>
              <div className="absolute bottom-10 right-40 text-4xl">🪨</div>
              <div className="absolute top-20 right-60 text-3xl">💎</div>
            </div>

            {/* Animated Pickaxe */}
            {totalHashRate > 0 && (
              <div className="absolute right-1/4 bottom-16 animate-bounce">
                <Pickaxe className="h-16 w-16 text-amber-600" />
              </div>
            )}

            {/* Mining Status */}
            <div className="relative z-10 text-center">
              <p className="text-xl font-semibold text-white drop-shadow-lg mb-2">
                {totalHashRate > 0 ? 'Mining in progress...' : 'Waiting for miners...'}
              </p>
              
              {/* Recent Find Popup - Enhanced */}
              {recentFind && (
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full animate-in fade-in slide-in-from-bottom-4"
                  style={{ animation: 'bounce 0.6s ease-in-out' }}
                >
                  <div className={`${getRarityColor(recentFind.rarity)} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3`}>
                    <div className="relative">
                      <img 
                        src={oreImages[recentFind.id]} 
                        alt={recentFind.name}
                        className="w-12 h-12 object-contain animate-in zoom-in-50 duration-300"
                      />
                      <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 animate-pulse" />
                    </div>
                    <div>
                      <span className="font-bold text-lg">Found {recentFind.name}!</span>
                      <div className="text-sm opacity-90">+{(recentFind.value * 0.1).toFixed(1)} BTC</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Boosts Banner */}
      {activeBoosts.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span className="font-semibold">Active Boosts:</span>
              {activeBoosts.map(boost => (
                <Badge key={boost.id} variant="secondary" className="gap-1">
                  {boost.icon} {boost.name}
                  <Clock className="h-3 w-3 ml-1" />
                  {getTimeRemaining(boost.expiresAt)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="shop" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Shop
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle>Inventory</CardTitle>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total Value</div>
                    <div className="text-lg font-bold text-primary flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {totalValue}
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowSellAllDialog(true)}
                    disabled={inventory.length === 0}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Sell All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>No items found yet. Keep mining!</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {inventory
                        .sort((a, b) => b.value - a.value)
                        .map((item) => (
                          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow border-2" style={{ borderColor: `${item.color}30` }}>
                            <div className="flex items-center gap-4 p-4">
                              <div className={`${getRarityColor(item.rarity)} w-16 h-16 rounded-lg flex items-center justify-center p-2`}>
                                <img 
                                  src={oreImages[item.id]} 
                                  alt={item.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">{item.name}</h3>
                                  <Badge variant={getRarityBadgeVariant(item.rarity)} className="capitalize">
                                    {item.rarity}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span>Count: <span className="font-bold text-foreground">{item.count}</span></span>
                                  <span>Value: <span className="font-bold text-primary">{item.value} each</span></span>
                                  <span>Total: <span className="font-bold text-primary">{item.value * item.count}</span></span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleSellOre(item.id, 1, item.value)}
                                  disabled={item.count < 1}
                                >
                                  <Coins className="h-3 w-3 mr-1" />
                                  Sell 1
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleSellOre(item.id, item.count, item.value)}
                                  disabled={item.count < 1}
                                >
                                  <Coins className="h-3 w-3 mr-1" />
                                  Sell All
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
          <CardHeader>
            <CardTitle>Mining Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Active Miners</div>
              <div className="text-2xl font-bold">{totalHashRate > 0 ? '✓ Active' : '✗ Inactive'}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Unique Items</div>
              <div className="text-2xl font-bold">{inventory.length}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Items</div>
              <div className="text-2xl font-bold">
                {inventory.reduce((sum, item) => sum + item.count, 0)}
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground mb-2">Rarity Distribution</div>
              <div className="space-y-2">
                {['legendary', 'epic', 'rare', 'uncommon', 'common'].map(rarity => {
                  const count = inventory.filter(i => i.rarity === rarity).reduce((sum, i) => sum + i.count, 0);
                  if (count === 0) return null;
                  return (
                    <div key={rarity} className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className="capitalize">{rarity}</Badge>
                      <span className="font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Shop Tab */}
        <TabsContent value="shop" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shopItems.map((item) => {
              const isOwned = purchasedItems.some(p => p.id === item.id && !p.expiresAt);
              const canAfford = btcBalance >= item.price;
              
              return (
                <Card key={item.id} className={`overflow-hidden hover-scale ${isOwned ? 'border-green-500/50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="text-4xl mb-2">{item.icon}</div>
                      {isOwned && <Badge variant="outline" className="text-green-500">Owned</Badge>}
                    </div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-orange-500 font-bold text-xl">
                        ₿ {item.price}
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handlePurchase(item.id)}
                        disabled={!canAfford || isOwned}
                        variant={canAfford ? "default" : "outline"}
                      >
                        {isOwned ? 'Owned' : canAfford ? 'Buy' : 'Need BTC'}
                      </Button>
                    </div>
                    {item.effect && (
                      <div className="mt-3 text-xs text-muted-foreground space-y-1">
                        {item.effect.multiplier && (
                          <div>✨ {item.effect.multiplier}x multiplier</div>
                        )}
                        {item.effect.duration !== undefined && (
                          <div>⏱️ {item.effect.duration === 0 ? 'Permanent' : `${item.effect.duration} minutes`}</div>
                        )}
                        {item.effect.autoMine && (
                          <div>🤖 Auto-mining enabled</div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tip */}
          <Card className="mt-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                💡 <span className="font-semibold">Tip:</span> Sell your ores to earn BTC, then use BTC to buy boosts and upgrades to find even rarer ores!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sell All Confirmation Dialog */}
      <AlertDialog open={showSellAllDialog} onOpenChange={setShowSellAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sell All Items?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sell all items in your inventory? You will receive{' '}
              <span className="font-bold text-orange-500">
                ₿ {inventory.reduce((sum, item) => sum + (item.value * item.count * 0.1), 0).toFixed(2)}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSellAll} className="bg-orange-600 hover:bg-orange-700">
              <DollarSign className="w-4 h-4 mr-2" />
              Sell All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
