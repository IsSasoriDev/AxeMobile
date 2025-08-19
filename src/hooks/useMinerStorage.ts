import { useState, useEffect } from "react";

export interface Miner {
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline" | "checking";
  lastChecked?: Date;
}

export function useMinerStorage() {
  const [miners, setMiners] = useState<Miner[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("axemobile-miners");
    if (stored) {
      try {
        const parsedMiners = JSON.parse(stored);
        setMiners(parsedMiners.map((miner: any) => ({
          ...miner,
          lastChecked: miner.lastChecked ? new Date(miner.lastChecked) : undefined
        })));
      } catch (error) {
        console.error("Failed to parse stored miners:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("axemobile-miners", JSON.stringify(miners));
  }, [miners]);

  const addMiner = (miner: Omit<Miner, "id">) => {
    const newMiner: Miner = {
      ...miner,
      id: Date.now().toString(),
    };
    setMiners(prev => [...prev, newMiner]);
    return newMiner;
  };

  const updateMiner = (id: string, updates: Partial<Miner>) => {
    setMiners(prev => prev.map(miner => 
      miner.id === id ? { ...miner, ...updates } : miner
    ));
  };

  const deleteMiner = (id: string) => {
    setMiners(prev => prev.filter(miner => miner.id !== id));
  };

  const checkMinerStatus = async (miner: Miner) => {
    updateMiner(miner.id, { status: "checking" });
    
    try {
      // Simple ping check - in a real app you'd want a proper ping service
      const response = await fetch(`http://${miner.ipAddress}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000)
      });
      
      updateMiner(miner.id, { 
        status: "online", 
        lastChecked: new Date() 
      });
    } catch (error) {
      updateMiner(miner.id, { 
        status: "offline", 
        lastChecked: new Date() 
      });
    }
  };

  return {
    miners,
    addMiner,
    updateMiner,
    deleteMiner,
    checkMinerStatus
  };
}