import { useState, useEffect } from "react";
import { Settings, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";

interface SavedMiner {
  id: string;
  name: string;
  ip_address: string;
  model: string;
}

const Config = () => {
  const [poolAddress, setPoolAddress] = useState("");
  const [port, setPort] = useState("3333");
  const [password, setPassword] = useState("x");
  const [fanSpeed, setFanSpeed] = useState("100");
  const [miners, setMiners] = useState<SavedMiner[]>([]);
  const [selectedMiners, setSelectedMiners] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("savedMiners");
    if (saved) {
      const parsed = JSON.parse(saved) as SavedMiner[];
      setMiners(parsed);
      setSelectedMiners(new Set(parsed.map(m => m.id)));
    }
  }, []);

  const toggleMiner = (id: string) => {
    setSelectedMiners(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedMiners(new Set(miners.map(m => m.id)));
  };

  const selectNone = () => {
    setSelectedMiners(new Set());
  };

  const sendSettings = async () => {
    if (!poolAddress.trim()) {
      toast.error("Please enter a pool address");
      return;
    }
    if (!port.trim()) {
      toast.error("Please enter a port");
      return;
    }
    if (selectedMiners.size === 0) {
      toast.error("Please select at least one miner");
      return;
    }

    setSending(true);
    const selected = miners.filter(m => selectedMiners.has(m.id));
    let successCount = 0;
    let failCount = 0;

    for (const miner of selected) {
      try {
        const fanSpeedNum = parseInt(fanSpeed, 10);
        await invoke("update_miner_pool", {
          ip: miner.ip_address,
          pool: `stratum+tcp://${poolAddress}:${port}`,
          password: password || "x",
          fanSpeed: !isNaN(fanSpeedNum) && fanSpeedNum >= 0 && fanSpeedNum <= 100 ? fanSpeedNum : null
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to update ${miner.name}:`, error);
        failCount++;
      }
    }

    setSending(false);

    if (successCount > 0) {
      toast.success(`Updated ${successCount} miner(s) successfully`);
    }
    if (failCount > 0) {
      toast.error(`Failed to update ${failCount} miner(s)`);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/20">
          <Settings className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Pool Config</h1>
          <p className="text-muted-foreground">Configure pool settings for your miners</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pool Settings</CardTitle>
            <CardDescription>Enter your pool connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pool">Pool Address</Label>
              <Input
                id="pool"
                placeholder="pool.solobtc.eu"
                value={poolAddress}
                onChange={(e) => setPoolAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Without stratum+tcp://, just the domain</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                placeholder="3333"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="x"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fanSpeed">Fan Speed (%)</Label>
              <Input
                id="fanSpeed"
                type="number"
                min="0"
                max="100"
                placeholder="100"
                value={fanSpeed}
                onChange={(e) => setFanSpeed(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">0-100%, controls cooling fan speed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select Miners</CardTitle>
            <CardDescription>
              Choose which miners to update ({selectedMiners.size}/{miners.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={selectNone}>Select None</Button>
            </div>
            
            {miners.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No miners found. Add miners from the home page first.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {miners.map((miner) => (
                  <div
                    key={miner.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => toggleMiner(miner.id)}
                  >
                    <Checkbox
                      checked={selectedMiners.has(miner.id)}
                      onCheckedChange={() => toggleMiner(miner.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{miner.name}</p>
                      <p className="text-xs text-muted-foreground">{miner.ip_address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <Button 
          size="lg" 
          onClick={sendSettings} 
          disabled={sending || selectedMiners.size === 0}
          className="w-full md:w-auto"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send to {selectedMiners.size} Miner(s)
            </>
          )}
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          disabled
          className="w-full md:w-auto opacity-50"
        >
          Bulk Update (Coming Soon)
        </Button>
      </div>
    </div>
  );
};

export default Config;
