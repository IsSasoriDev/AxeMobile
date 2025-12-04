import { useState, useEffect, useCallback } from 'react';
import { useMiningSound } from './useMiningSound';

export interface OreItem {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  color: string;
  emoji: string;
  image: string;
  value: number;
}

export interface InventoryItem extends OreItem {
  count: number;
  lastFound: Date;
}

const ORE_TYPES: OreItem[] = [
  { id: 'coal', name: 'Coal', rarity: 'common', color: '#333333', emoji: '🪨', image: '/src/assets/ores/coal.png', value: 1 },
  { id: 'copper', name: 'Copper', rarity: 'common', color: '#B87333', emoji: '🟤', image: '/src/assets/ores/copper.png', value: 2 },
  { id: 'iron', name: 'Iron', rarity: 'uncommon', color: '#C0C0C0', emoji: '⚙️', image: '/src/assets/ores/iron.png', value: 5 },
  { id: 'gold', name: 'Gold', rarity: 'rare', color: '#FFD700', emoji: '💰', image: '/src/assets/ores/gold.png', value: 10 },
  { id: 'emerald', name: 'Emerald', rarity: 'epic', color: '#50C878', emoji: '💚', image: '/src/assets/ores/emerald.png', value: 25 },
  { id: 'diamond', name: 'Diamond', rarity: 'legendary', color: '#B9F2FF', emoji: '💎', image: '/src/assets/ores/diamond.png', value: 50 },
  { id: 'bitcoin', name: 'Bitcoin', rarity: 'legendary', color: '#F7931A', emoji: '₿', image: '/src/assets/ores/bitcoin.png', value: 100 },
];

export const useMiningGame = (currentHashrate: number, luckMultiplier: number = 1, hasAutoMiner: boolean = false, onOreFound?: (value: number) => void) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recentFind, setRecentFind] = useState<OreItem | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const { playSound } = useMiningSound();

  // Load inventory from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('MINING_INVENTORY');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      const withDates = parsed.map((item: any) => ({
        ...item,
        lastFound: new Date(item.lastFound),
      }));
      setInventory(withDates);
    }
  }, []);

  // Calculate total value
  useEffect(() => {
    const total = inventory.reduce((sum, item) => sum + (item.value * item.count), 0);
    setTotalValue(total);
  }, [inventory]);

  // Mining logic based on hashrate
  useEffect(() => {
    // Allow mining if hashrate > 0 OR auto miner is active
    if (currentHashrate === 0 && !hasAutoMiner) return;

    // Higher hashrate = faster mining
    // Base interval: 10 seconds, reduced by hashrate factor
    const baseInterval = 10000;
    const effectiveHashrate = hasAutoMiner ? Math.max(currentHashrate, 50) : currentHashrate;
    const hashrateBonus = Math.min(effectiveHashrate / 100, 0.8); // Max 80% reduction
    const interval = baseInterval * (1 - hashrateBonus);

    const miningInterval = setInterval(() => {
      // Play mining sound
      playSound('mine');

      // Determine rarity based on random chance with luck multiplier
      const roll = Math.random() * 100;
      
      // Apply luck multiplier by adjusting thresholds
      const luckAdjusted = roll / luckMultiplier;
      let selectedOre: OreItem;

      if (luckAdjusted < 0.5) {
        // 0.5% - Bitcoin (legendary)
        selectedOre = ORE_TYPES.find(o => o.id === 'bitcoin')!;
      } else if (luckAdjusted < 2) {
        // 1.5% - Diamond (legendary)
        selectedOre = ORE_TYPES.find(o => o.id === 'diamond')!;
      } else if (luckAdjusted < 7) {
        // 5% - Emerald (epic)
        selectedOre = ORE_TYPES.find(o => o.id === 'emerald')!;
      } else if (luckAdjusted < 20) {
        // 13% - Gold (rare)
        selectedOre = ORE_TYPES.find(o => o.id === 'gold')!;
      } else if (luckAdjusted < 45) {
        // 25% - Iron (uncommon)
        selectedOre = ORE_TYPES.find(o => o.id === 'iron')!;
      } else if (luckAdjusted < 70) {
        // 25% - Copper (common)
        selectedOre = ORE_TYPES.find(o => o.id === 'copper')!;
      } else {
        // 30% - Coal (common)
        selectedOre = ORE_TYPES.find(o => o.id === 'coal')!;
      }

      addOreToInventory(selectedOre);
    }, interval);

    return () => clearInterval(miningInterval);
  }, [currentHashrate, luckMultiplier, hasAutoMiner]);

  const addOreToInventory = useCallback((ore: OreItem) => {
    setRecentFind(ore);
    
    // Play sound based on rarity
    if (ore.rarity === 'legendary') {
      playSound('find_legendary');
    } else if (ore.rarity === 'epic' || ore.rarity === 'rare') {
      playSound('find_rare', ore.rarity);
    } else {
      playSound('find_common');
    }
    
    setInventory(prev => {
      const existing = prev.find(item => item.id === ore.id);
      let updated: InventoryItem[];
      
      if (existing) {
        updated = prev.map(item =>
          item.id === ore.id
            ? { ...item, count: item.count + 1, lastFound: new Date() }
            : item
        );
      } else {
        updated = [...prev, { ...ore, count: 1, lastFound: new Date() }];
      }
      
      // Save to localStorage
      localStorage.setItem('MINING_INVENTORY', JSON.stringify(updated));
      return updated;
    });

    // Notify parent component about BTC value
    if (onOreFound) {
      onOreFound(ore.value * 0.1); // Convert ore value to BTC (10% of value)
    }

    // Clear recent find after animation
    setTimeout(() => setRecentFind(null), 3000);
  }, [playSound, onOreFound]);

  const clearInventory = useCallback(() => {
    setInventory([]);
    localStorage.removeItem('MINING_INVENTORY');
    setTotalValue(0);
  }, []);

  const sellOre = useCallback((oreId: string, amount: number) => {
    setInventory(prev => {
      const item = prev.find(i => i.id === oreId);
      if (!item || item.count < amount) return prev;

      const btcValue = item.value * amount * 0.1; // 10% of value as BTC
      if (onOreFound) {
        onOreFound(btcValue);
      }

      const updated = prev.map(i => 
        i.id === oreId 
          ? { ...i, count: i.count - amount }
          : i
      ).filter(i => i.count > 0);

      localStorage.setItem('MINING_INVENTORY', JSON.stringify(updated));
      return updated;
    });
  }, [onOreFound]);

  return {
    inventory,
    recentFind,
    totalValue,
    clearInventory,
    sellOre,
  };
};
