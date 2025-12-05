import { useState, useEffect } from "react";
import { Settings, Send, Loader2, Fan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";

const Config = () => {
  const { devices } = useNetworkScanner();
  const [poolAddress, setPoolAddress] = useState("");
  const [port, setPort] = useState("3333");
  const [password, setPassword] = useState("x");
  const [fanSpeed, setFanSpeed] = useState("100");
  const [selectedMiners, setSelectedMiners] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendingFan, setSendingFan] = useState(false);

  // Select all miners by default when devices load
  useEffect(() => {
    if (devices.length > 0 && selectedMiners.size === 0) {
      setSelectedMiners(new Set(devices.map(m => m.IP)));
    }
  }, [devices]);

  const toggleMiner = (ip: string) => {
    setSelectedMiners(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ip)) {
        newSet.delete(ip);
      } else {
        newSet.add(ip);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedMiners(new Set(devices.map(m => m.IP)));
  };

  const selectNone = () => {
    setSelectedMiners(new Set());
  };

  const sendPoolSettings = async () => {
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
    const selected = devices.filter(m => selectedMiners.has(m.IP));
    let successCount = 0;
    let failCount = 0;

    for (const miner of selected) {
      try {
        await invoke("update_miner_pool", {
          ip: miner.IP,
          pool: `stratum+tcp://${poolAddress}:${port}`,
          password: password || "x",
          fanSpeed: null
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to update ${miner.name || miner.IP}:`, error);
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

  const sendFanSpeed = async () => {
    if (selectedMiners.size === 0) {
      toast.error("Please select at least one miner");
      return;
    }

    const fanSpeedNum = parseInt(fanSpeed, 10);
    if (isNaN(fanSpeedNum) || fanSpeedNum < 0 || fanSpeedNum > 100) {
      toast.error("Fan speed must be 0-100");
      return;
    }

    setSendingFan(true);
    const selected = devices.filter(m => selectedMiners.has(m.IP));
    let successCount = 0;
    let failCount = 0;

    for (const miner of selected) {
      try {
        await invoke("update_miner_pool", {
          ip: miner.IP,
          pool: null,
          password: null,
          fanSpeed: fanSpeedNum
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to update fan on ${miner.name || miner.IP}:`, error);
        failCount++;
      }
    }

    setSendingFan(false);

    if (successCount > 0) {
      toast.success(`Updated fan speed on ${successCount} miner(s)`);
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select Miners</CardTitle>
            <CardDescription>
              Choose which miners to update ({selectedMiners.size}/{devices.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={selectNone}>Select None</Button>
            </div>
            
            {devices.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No miners found. Add miners from the Stats page first.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {devices.map((miner) => (
                  <div
                    key={miner.IP}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => toggleMiner(miner.IP)}
                  >
                    <Checkbox
                      checked={selectedMiners.has(miner.IP)}
                      onCheckedChange={() => toggleMiner(miner.IP)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{miner.name || miner.IP}</p>
                      <p className="text-xs text-muted-foreground">{miner.IP} • {miner.model || 'Unknown'}</p>
                    </div>
                    <span className={`text-xs ${miner.isActive ? 'text-green-500' : 'text-red-500'}`}>
                      {miner.isActive ? '● Online' : '○ Offline'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fan Speed - Separate Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fan className="h-5 w-5 text-primary" />
            <CardTitle>Fan Control</CardTitle>
          </div>
          <CardDescription>Adjust cooling fan speed for selected miners</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
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
            </div>
            <Button 
              onClick={sendFanSpeed} 
              disabled={sendingFan || selectedMiners.size === 0}
            >
              {sendingFan ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Fan className="h-4 w-4" />
                  Set Fan Speed
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button 
        size="lg" 
        onClick={sendPoolSettings} 
        disabled={sending || selectedMiners.size === 0}
        className="w-full md:w-auto"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending Pool Settings...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send Pool Settings to {selectedMiners.size} Miner(s)
          </>
        )}
      </Button>
    </div>
  );
};

export default Config;
