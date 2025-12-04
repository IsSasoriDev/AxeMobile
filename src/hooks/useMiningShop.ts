import { useState, useEffect, useCallback } from 'react';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'boost' | 'upgrade' | 'cosmetic';
  icon: string;
  effect?: {
    multiplier?: number;
    duration?: number; // in minutes, 0 = permanent
    autoMine?: boolean;
  };
}

export interface PurchasedItem extends ShopItem {
  purchasedAt: Date;
  expiresAt?: Date;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'lucky_pickaxe',
    name: 'Lucky Pickaxe',
    description: '+50% chance to find rare ores for 30 minutes',
    price: 100,
    type: 'boost',
    icon: '⛏️',
    effect: { multiplier: 1.5, duration: 30 }
  },
  {
    id: 'golden_pickaxe',
    name: 'Golden Pickaxe',
    description: '+100% chance to find rare ores for 1 hour',
    price: 250,
    type: 'boost',
    icon: '🔱',
    effect: { multiplier: 2.0, duration: 60 }
  },
  {
    id: 'diamond_drill',
    name: 'Diamond Drill',
    description: '+200% chance to find rare ores for 2 hours',
    price: 500,
    type: 'boost',
    icon: '💎',
    effect: { multiplier: 3.0, duration: 120 }
  },
  {
    id: 'auto_miner',
    name: 'Auto Miner',
    description: 'Mines automatically even at 0 hashrate (permanent)',
    price: 1000,
    type: 'upgrade',
    icon: '🤖',
    effect: { autoMine: true, duration: 0 }
  },
  {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: 'Mine 2x faster for 1 hour',
    price: 200,
    type: 'boost',
    icon: '⚡',
    effect: { multiplier: 2.0, duration: 60 }
  },
  {
    id: 'mega_luck',
    name: 'Mega Luck Charm',
    description: '+300% rare ore chance for 30 minutes',
    price: 750,
    type: 'boost',
    icon: '🍀',
    effect: { multiplier: 4.0, duration: 30 }
  },
  {
    id: 'bitcoin_magnet',
    name: 'Bitcoin Magnet',
    description: '10x chance to find Bitcoin (permanent)',
    price: 2000,
    type: 'upgrade',
    icon: '₿',
    effect: { multiplier: 10.0, duration: 0 }
  },
  {
    id: 'treasure_detector',
    name: 'Treasure Detector',
    description: 'Shows next ore rarity (permanent)',
    price: 1500,
    type: 'upgrade',
    icon: '📡',
    effect: { duration: 0 }
  },
];

export const useMiningShop = () => {
  const [btcBalance, setBtcBalance] = useState(0);
  const [purchasedItems, setPurchasedItems] = useState<PurchasedItem[]>([]);

  // Load data from localStorage
  useEffect(() => {
    const storedBalance = localStorage.getItem('MINING_BTC_BALANCE');
    const storedItems = localStorage.getItem('MINING_PURCHASED_ITEMS');
    
    if (storedBalance) {
      setBtcBalance(parseFloat(storedBalance));
    }
    
    if (storedItems) {
      const parsed = JSON.parse(storedItems);
      const withDates = parsed.map((item: any) => ({
        ...item,
        purchasedAt: new Date(item.purchasedAt),
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
      }));
      setPurchasedItems(withDates);
    }
  }, []);

  // Clean up expired items
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const validItems = purchasedItems.filter(item => {
        if (!item.expiresAt) return true; // Permanent items
        return item.expiresAt > now;
      });
      
      if (validItems.length !== purchasedItems.length) {
        setPurchasedItems(validItems);
        localStorage.setItem('MINING_PURCHASED_ITEMS', JSON.stringify(validItems));
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [purchasedItems]);

  const addBTC = useCallback((amount: number) => {
    setBtcBalance(prev => {
      const newBalance = prev + amount;
      localStorage.setItem('MINING_BTC_BALANCE', newBalance.toString());
      return newBalance;
    });
  }, []);

  const purchaseItem = useCallback((itemId: string) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return false;

    if (btcBalance < item.price) {
      return false; // Not enough BTC
    }

    // Check if permanent upgrade already owned
    if (item.effect?.duration === 0) {
      const alreadyOwned = purchasedItems.some(p => p.id === itemId);
      if (alreadyOwned) return false;
    }

    // Deduct BTC
    setBtcBalance(prev => {
      const newBalance = prev - item.price;
      localStorage.setItem('MINING_BTC_BALANCE', newBalance.toString());
      return newBalance;
    });

    // Add to purchased items
    const purchasedAt = new Date();
    const expiresAt = item.effect?.duration 
      ? new Date(purchasedAt.getTime() + item.effect.duration * 60000)
      : undefined;

    const purchasedItem: PurchasedItem = {
      ...item,
      purchasedAt,
      expiresAt,
    };

    setPurchasedItems(prev => {
      const updated = [...prev, purchasedItem];
      localStorage.setItem('MINING_PURCHASED_ITEMS', JSON.stringify(updated));
      return updated;
    });

    return true;
  }, [btcBalance, purchasedItems]);

  // Get active boosts
  const getActiveBoosts = useCallback(() => {
    const now = new Date();
    return purchasedItems.filter(item => {
      if (!item.expiresAt) return true; // Permanent
      return item.expiresAt > now;
    });
  }, [purchasedItems]);

  // Calculate total luck multiplier
  const getLuckMultiplier = useCallback(() => {
    const activeBoosts = getActiveBoosts();
    return activeBoosts.reduce((total, item) => {
      return total * (item.effect?.multiplier || 1);
    }, 1);
  }, [getActiveBoosts]);

  // Check if auto miner is active
  const hasAutoMiner = useCallback(() => {
    const activeBoosts = getActiveBoosts();
    return activeBoosts.some(item => item.effect?.autoMine);
  }, [getActiveBoosts]);

  return {
    btcBalance,
    purchasedItems,
    shopItems: SHOP_ITEMS,
    addBTC,
    purchaseItem,
    getActiveBoosts,
    getLuckMultiplier,
    hasAutoMiner,
  };
};
