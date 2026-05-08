import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMiningGame } from "@/hooks/useMiningGame";
import { useMiningShop } from "@/hooks/useMiningShop";
import { useNetworkScanner } from "@/hooks/useNetworkScanner";
import { useMiningSound } from "@/hooks/useMiningSound";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pickaxe, Package, ShoppingCart, Coins, Zap, Clock, DollarSign, Sparkles, Volume2, VolumeX, Mountain, User, Trophy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import coalOre from "@/assets/ores/coal.png";
import copperOre from "@/assets/ores/copper.png";
import ironOre from "@/assets/ores/iron.png";
import goldOre from "@/assets/ores/gold.png";
import emeraldOre from "@/assets/ores/emerald.png";
import diamondOre from "@/assets/ores/diamond.png";
import bitcoinOre from "@/assets/ores/bitcoin.png";

const USERNAME_KEY = "leaderboardUsername";

export default function Cave() {
  const { totalHashRate } = useNetworkScanner();
  const [showSellAllDialog, setShowSellAllDialog] = useState(false);
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) || "");
  const [draftName, setDraftName] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('caveSoundMuted') === 'true');
  useEffect(() => { localStorage.setItem('caveSoundMuted', String(isMuted)); }, [isMuted]);

  const { btcBalance, purchasedItems, shopItems, addBTC, purchaseItem, getActiveBoosts, getLuckMultiplier, hasAutoMiner } = useMiningShop();
  const { playSound } = useMiningSound();
  const { inventory, recentFind, totalValue, clearInventory, sellOre } = useMiningGame(totalHashRate, getLuckMultiplier(), hasAutoMiner(), addBTC);
  const activeBoosts = getActiveBoosts();

  const rarityColor: Record<string, string> = {
    legendary: 'from-warning/30 to-warning/10 border-warning/30',
    epic: 'from-purple-500/20 to-purple-500/5 border-purple-400/25',
    rare: 'from-primary/20 to-primary/5 border-primary/25',
    uncommon: 'from-accent/20 to-accent/5 border-accent/25',
    common: 'from-muted/30 to-muted/10 border-border/30',
  };

  const handlePurchase = (id: string) => {
    const success = purchaseItem(id);
    if (success) { playSound('purchase'); toast.success('Purchased!'); }
    else { const item = shopItems.find(i => i.id === id); toast.error(item && btcBalance < item.price ? 'Not enough BTC!' : 'Cannot purchase'); }
  };

  const handleSellOre = (oreId: string, amount: number, value: number) => { sellOre(oreId, amount); toast.success(`Sold for ${(value * amount * 0.1).toFixed(1)} Cave BTC!`); };
  const handleSellAll = () => { addBTC(inventory.reduce((s, i) => s + (i.value * i.count * 0.1), 0)); clearInventory(); setShowSellAllDialog(false); toast.success("Sold all items!"); };
  const saveUsername = () => {
    const trimmed = draftName.trim();
    if (trimmed.length < 2 || trimmed.length > 32) { toast.error("Username must be 2-32 characters"); return; }
    localStorage.setItem(USERNAME_KEY, trimmed);
    setUsername(trimmed);
  };
  const submitCaveScore = async () => {
    if (!username) return;
    setSubmittingScore(true);
    const { error } = await supabase.from("leaderboard_cave_entries" as any).insert({ username, cave_btc: btcBalance } as any);
    setSubmittingScore(false);
    if (error) toast.error(error.message.includes("banned") ? "You are banned from submitting" : "Could not submit Cave BTC");
    else toast.success("Cave BTC submitted!");
  };

  const oreImages: Record<string, string> = { coal: coalOre, copper: copperOre, iron: ironOre, gold: goldOre, emerald: emeraldOre, diamond: diamondOre, bitcoin: bitcoinOre };

  const getTimeRemaining = (e?: Date) => { if (!e) return 'Permanent'; const m = Math.floor((e.getTime() - Date.now()) / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

  if (!username) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4 animate-scale-up">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/20"><Mountain className="h-6 w-6 text-primary" /></div>
            <h1 className="text-lg font-bold font-mono">Enter the Cave</h1>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Mountain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Mining Cave</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{username} · Cave BTC only, not real BTC</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-mono gap-1" onClick={submitCaveScore} disabled={submittingScore}><Trophy className="h-3 w-3" />Submit</Button>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-warning font-bold">₿ {btcBalance.toFixed(1)}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-primary font-bold">{(totalHashRate / 1000).toFixed(2)} TH/s</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-accent font-bold">{getLuckMultiplier().toFixed(1)}x</span>
          </div>
        </div>
      </div>

      {/* Cave animation area */}
      <div className="relative rounded-xl border border-border/40 bg-gradient-to-b from-secondary/50 to-card/80 overflow-hidden h-48">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-8 text-4xl">🪨</div>
          <div className="absolute top-16 right-12 text-3xl">⛰️</div>
          <div className="absolute bottom-8 left-20 text-4xl">🗻</div>
          <div className="absolute bottom-4 right-24 text-3xl">🪨</div>
          <div className="absolute top-8 right-40 text-2xl">💎</div>
        </div>

        {totalHashRate > 0 && (
          <div className="absolute right-1/4 bottom-8 animate-bounce">
            <Pickaxe className="h-12 w-12 text-warning" />
          </div>
        )}

        <div className="relative z-10 flex items-center justify-center h-full">
          <p className="text-sm font-mono text-foreground/80">
            {totalHashRate > 0 ? '⛏️ Mining in progress...' : '⏳ Waiting for miners...'}
          </p>

          {recentFind && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
              <div className={`bg-gradient-to-r ${rarityColor[recentFind.rarity]} border px-4 py-2 rounded-xl flex items-center gap-2`}>
                <img src={oreImages[recentFind.id]} alt={recentFind.name} className="w-8 h-8 object-contain" />
                <div>
                  <span className="font-bold text-sm font-mono">{recentFind.name}!</span>
                   <div className="text-[10px] text-muted-foreground font-mono">+{(recentFind.value * 0.1).toFixed(1)} Cave BTC</div>
                </div>
                <Sparkles className="w-4 h-4 text-warning animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active boosts */}
      {activeBoosts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <Zap className="h-3.5 w-3.5 text-warning" />
          {activeBoosts.map(b => (
            <Badge key={b.id} variant="outline" className="text-[9px] font-mono gap-1 px-2 py-0.5">
              {b.icon} {b.name} <Clock className="h-2.5 w-2.5" /> {getTimeRemaining(b.expiresAt)}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8 max-w-xs">
          <TabsTrigger value="inventory" className="text-xs font-mono gap-1"><Package className="h-3 w-3" />Inventory</TabsTrigger>
          <TabsTrigger value="shop" className="text-xs font-mono gap-1"><ShoppingCart className="h-3 w-3" />Shop</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Inventory list */}
            <div className="lg:col-span-2 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold font-mono uppercase text-muted-foreground">Items</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">Value: <span className="text-primary font-bold">{totalValue}</span></span>
                  <Button variant="destructive" size="sm" className="h-6 px-2 text-[9px] font-mono" onClick={() => setShowSellAllDialog(true)} disabled={inventory.length === 0}>
                    <DollarSign className="h-3 w-3 mr-0.5" />Sell All
                  </Button>
                </div>
              </div>
              {inventory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground font-mono text-xs">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No items yet. Keep mining!</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1.5">
                    {inventory.sort((a, b) => b.value - a.value).map(item => (
                      <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-lg border bg-gradient-to-r ${rarityColor[item.rarity]}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center p-1 bg-secondary/50">
                          <img src={oreImages[item.id]} alt={item.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs font-mono">{item.name}</span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono capitalize">{item.rarity}</Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ×{item.count} · {item.value}ea · Total: {item.value * item.count}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] font-mono" onClick={() => handleSellOre(item.id, 1, item.value)}>
                            <Coins className="h-2.5 w-2.5 mr-0.5" />1
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] font-mono" onClick={() => handleSellOre(item.id, item.count, item.value)}>All</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Stats sidebar */}
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <h3 className="text-xs font-bold font-mono uppercase text-muted-foreground">Mining Stats</h3>
              {[
                { label: "Status", value: totalHashRate > 0 ? '✓ Active' : '✗ Inactive' },
                { label: "Unique Items", value: inventory.length },
                { label: "Total Items", value: inventory.reduce((s, i) => s + i.count, 0) },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <span className="text-[10px] text-muted-foreground font-mono">{s.label}</span>
                  <span className="text-sm font-bold font-mono">{s.value}</span>
                </div>
              ))}
              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground font-mono mb-2">Rarity</p>
                {['legendary', 'epic', 'rare', 'uncommon', 'common'].map(r => {
                  const c = inventory.filter(i => i.rarity === r).reduce((s, i) => s + i.count, 0);
                  if (c === 0) return null;
                  return (
                    <div key={r} className="flex items-center justify-between py-1 text-[10px] font-mono">
                      <span className="capitalize text-muted-foreground">{r}</span>
                      <span className="font-bold">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shop" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {shopItems.map(item => {
              const isOwned = purchasedItems.some(p => p.id === item.id && !p.expiresAt);
              const canAfford = btcBalance >= item.price;
              return (
                <div key={item.id} className={`rounded-xl border p-4 transition-all ${isOwned ? 'border-accent/30 bg-accent/5' : 'border-border/40 bg-card/40'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm font-mono">{item.name}</h3>
                        {isOwned && <Badge variant="outline" className="text-[8px] text-accent border-accent/30">Owned</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-warning font-bold font-mono text-sm">₿ {item.price} Cave</span>
                    <Button size="sm" className="h-7 text-xs font-mono" onClick={() => handlePurchase(item.id)} disabled={!canAfford || isOwned}>
                      {isOwned ? 'Owned' : canAfford ? 'Buy' : 'Need BTC'}
                    </Button>
                  </div>
                  {item.effect && (
                    <div className="mt-2 text-[9px] text-muted-foreground font-mono space-y-0.5">
                      {item.effect.multiplier && <div>✨ {item.effect.multiplier}x luck</div>}
                      {item.effect.duration !== undefined && <div>⏱️ {item.effect.duration === 0 ? 'Permanent' : `${item.effect.duration}m`}</div>}
                      {item.effect.autoMine && <div>🤖 Auto-mining</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showSellAllDialog} onOpenChange={setShowSellAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">Sell All Items?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              You'll receive <span className="text-warning font-bold">₿ {inventory.reduce((s, i) => s + (i.value * i.count * 0.1), 0).toFixed(2)} Cave BTC</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSellAll} className="font-mono text-xs bg-warning text-warning-foreground hover:bg-warning/90">
              <DollarSign className="w-3 h-3 mr-1" />Sell All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
