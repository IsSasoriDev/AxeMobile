import { useState, useEffect, useRef, useCallback } from "react";
import { Settings, Send, Loader2, Fan, Cpu, Zap, Server, Bell, Thermometer, Trophy, Volume2, Save, Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";

// Custom preset interface
interface CustomPreset {
  name: string;
  fan: number;
  frequency: number;
  voltage: number;
}

// Performance presets
const DEFAULT_PRESETS = {
  eco: { name: "Eco Mode", icon: "🌱", fan: 50, frequency: 350, voltage: 1000, description: "Low power, quiet operation" },
  balanced: { name: "Balanced", icon: "⚖️", fan: 75, frequency: 485, voltage: 1200, description: "Default settings" },
  performance: { name: "Performance", icon: "🚀", fan: 100, frequency: 575, voltage: 1300, description: "Higher hashrate" },
  max: { name: "Max OC", icon: "⚡", fan: 100, frequency: 650, voltage: 1400, description: "Maximum overclock" },
};

// Notification settings interface
interface NotificationSettings {
  blockFoundEnabled: boolean;
  tempWarningEnabled: boolean;
  tempThreshold: number;
  soundEnabled: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  blockFoundEnabled: true,
  tempWarningEnabled: true,
  tempThreshold: 70,
  soundEnabled: true,
};

// Play test sound
const playTestSound = (type: 'block' | 'warning') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (type === 'block') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.4);
        oscillator.start(audioContext.currentTime + i * 0.15);
        oscillator.stop(audioContext.currentTime + i * 0.15 + 0.4);
      });
    } else {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);
      oscillator.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 0.35);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
};

const Config = () => {
  const { devices } = useNetworkScanner();
  
  // Pool settings
  const [poolAddress, setPoolAddress] = useState("");
  const [port, setPort] = useState("3333");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("x");
  
  // Performance settings
  const [fanSpeed, setFanSpeed] = useState(100);
  const [frequency, setFrequency] = useState(485);
  const [coreVoltage, setCoreVoltage] = useState(1200);
  const [activePreset, setActivePreset] = useState<string | null>("balanced");
  
  // Custom presets
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [customPresetName, setCustomPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  
  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  
  // Selection
  const [selectedMiners, setSelectedMiners] = useState<Set<string>>(new Set());
  
  // Loading states
  const [sendingPool, setSendingPool] = useState(false);
  const [sendingPerformance, setSendingPerformance] = useState(false);
  
  // Restart countdown state
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [pendingRestartMiners, setPendingRestartMiners] = useState<MinerDevice[]>([]);
  const [restartType, setRestartType] = useState<'pool' | 'performance'>('pool');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

  // Load notification settings and custom presets from localStorage
  useEffect(() => {
    const storedNotifications = localStorage.getItem('NOTIFICATION_SETTINGS');
    if (storedNotifications) {
      try {
        setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(storedNotifications) });
      } catch (e) {
        console.error('Failed to parse notification settings:', e);
      }
    }
    
    const storedPresets = localStorage.getItem('CUSTOM_PRESETS');
    if (storedPresets) {
      try {
        setCustomPresets(JSON.parse(storedPresets));
      } catch (e) {
        console.error('Failed to parse custom presets:', e);
      }
    }
  }, []);

  // Save notification settings
  const updateNotificationSettings = (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...notificationSettings, ...updates };
    setNotificationSettings(newSettings);
    localStorage.setItem('NOTIFICATION_SETTINGS', JSON.stringify(newSettings));
    toast.success("Notification settings saved");
  };

  // Select all miners by default when devices load
  useEffect(() => {
    if (devices.length > 0 && selectedMiners.size === 0) {
      setSelectedMiners(new Set(devices.map(m => m.IP)));
    }
  }, [devices]);

  // Apply preset (default or custom)
  const applyPreset = (presetKey: string) => {
    const preset = DEFAULT_PRESETS[presetKey as keyof typeof DEFAULT_PRESETS];
    if (preset) {
      setFanSpeed(preset.fan);
      setFrequency(preset.frequency);
      setCoreVoltage(preset.voltage);
      setActivePreset(presetKey);
      toast.success(`Applied ${preset.name} preset`);
    }
  };

  const applyCustomPreset = (preset: CustomPreset, index: number) => {
    setFanSpeed(preset.fan);
    setFrequency(preset.frequency);
    setCoreVoltage(preset.voltage);
    setActivePreset(`custom-${index}`);
    toast.success(`Applied ${preset.name} preset`);
  };

  // Save current settings as custom preset
  const saveCustomPreset = () => {
    if (!customPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }
    
    const newPreset: CustomPreset = {
      name: customPresetName.trim(),
      fan: fanSpeed,
      frequency: frequency,
      voltage: coreVoltage,
    };
    
    const updatedPresets = [...customPresets, newPreset];
    setCustomPresets(updatedPresets);
    localStorage.setItem('CUSTOM_PRESETS', JSON.stringify(updatedPresets));
    setCustomPresetName("");
    setShowSaveInput(false);
    toast.success(`Saved "${newPreset.name}" preset`);
  };

  // Delete custom preset
  const deleteCustomPreset = (index: number) => {
    const updatedPresets = customPresets.filter((_, i) => i !== index);
    setCustomPresets(updatedPresets);
    localStorage.setItem('CUSTOM_PRESETS', JSON.stringify(updatedPresets));
    toast.success("Preset deleted");
  };

  // Check if current values match any preset
  useEffect(() => {
    const matchingDefault = Object.entries(DEFAULT_PRESETS).find(
      ([_, preset]) => 
        preset.fan === fanSpeed && 
        preset.frequency === frequency && 
        preset.voltage === coreVoltage
    );
    
    if (matchingDefault) {
      setActivePreset(matchingDefault[0]);
      return;
    }
    
    const matchingCustomIndex = customPresets.findIndex(
      preset => 
        preset.fan === fanSpeed && 
        preset.frequency === frequency && 
        preset.voltage === coreVoltage
    );
    
    if (matchingCustomIndex !== -1) {
      setActivePreset(`custom-${matchingCustomIndex}`);
      return;
    }
    
    setActivePreset(null);
  }, [fanSpeed, frequency, coreVoltage, customPresets]);

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

  const restartMiners = async (miners: MinerDevice[]) => {
    let restartedCount = 0;
    for (const miner of miners) {
      try {
        await invoke("restart_miner", { ip: miner.IP });
        restartedCount++;
      } catch (error) {
        console.error(`Failed to restart ${miner.name || miner.IP}:`, error);
      }
    }
    return restartedCount;
  };

  const startCountdown = useCallback((miners: MinerDevice[], type: 'pool' | 'performance') => {
    setPendingRestartMiners(miners);
    setRestartType(type);
    setCountdown(5);
    setShowCountdown(true);
    cancelledRef.current = false;
  }, []);

  const cancelRestart = useCallback(() => {
    cancelledRef.current = true;
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setShowCountdown(false);
    setPendingRestartMiners([]);
    toast.info("Restart cancelled - settings saved without restart");
    setSendingPool(false);
    setSendingPerformance(false);
  }, []);

  const executeRestart = useCallback(async () => {
    setShowCountdown(false);
    const miners = pendingRestartMiners;
    const type = restartType;
    
    toast.info(`Restarting ${miners.length} miner(s)...`);
    const restartedCount = await restartMiners(miners);
    toast.success(`Restarted ${restartedCount} miner(s)`);
    
    setPendingRestartMiners([]);
    if (type === 'pool') {
      setSendingPool(false);
    } else {
      setSendingPerformance(false);
    }
  }, [pendingRestartMiners, restartType]);

  // Countdown effect
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      countdownRef.current = setTimeout(() => {
        if (!cancelledRef.current) {
          setCountdown(prev => prev - 1);
        }
      }, 1000);
      
      return () => {
        if (countdownRef.current) {
          clearTimeout(countdownRef.current);
        }
      };
    } else if (showCountdown && countdown === 0 && !cancelledRef.current) {
      executeRestart();
    }
  }, [showCountdown, countdown, executeRestart]);

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

    setSendingPool(true);
    const selected = devices.filter(m => selectedMiners.has(m.IP));
    let successCount = 0;
    let failCount = 0;
    const successfulMiners: MinerDevice[] = [];

    for (const miner of selected) {
      try {
        await invoke("update_miner_settings", {
          ip: miner.IP,
          stratumUrl: `stratum+tcp://${poolAddress}`,
          stratumPort: parseInt(port, 10),
          stratumUser: username || null,
          stratumPassword: password || "x",
          fanSpeed: null,
          frequency: null,
          coreVoltage: null,
        });
        successCount++;
        successfulMiners.push(miner);
      } catch (error) {
        console.error(`Failed to update ${miner.name || miner.IP}:`, error);
        failCount++;
      }
    }

    if (failCount > 0) {
      toast.error(`Failed to update ${failCount} miner(s)`);
    }

    // Start countdown for restart
    if (successfulMiners.length > 0) {
      toast.success(`Saved pool settings on ${successCount} miner(s)`);
      startCountdown(successfulMiners, 'pool');
    } else {
      setSendingPool(false);
    }
  };

  const sendPerformanceSettings = async () => {
    if (selectedMiners.size === 0) {
      toast.error("Please select at least one miner");
      return;
    }

    setSendingPerformance(true);
    const selected = devices.filter(m => selectedMiners.has(m.IP));
    let successCount = 0;
    let failCount = 0;
    const successfulMiners: MinerDevice[] = [];

    for (const miner of selected) {
      try {
        await invoke("update_miner_settings", {
          ip: miner.IP,
          stratumUrl: null,
          stratumPort: null,
          stratumUser: null,
          stratumPassword: null,
          fanSpeed: fanSpeed,
          frequency: frequency,
          coreVoltage: coreVoltage,
        });
        successCount++;
        successfulMiners.push(miner);
      } catch (error) {
        console.error(`Failed to update performance on ${miner.name || miner.IP}:`, error);
        failCount++;
      }
    }

    if (failCount > 0) {
      toast.error(`Failed to update ${failCount} miner(s)`);
    }

    // Start countdown for restart
    if (successfulMiners.length > 0) {
      toast.success(`Saved performance settings on ${successCount} miner(s)`);
      startCountdown(successfulMiners, 'performance');
    } else {
      setSendingPerformance(false);
    }
  };

  return (
    <>
      {/* Restart Countdown Dialog */}
      <Dialog open={showCountdown} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary animate-spin" />
              Restarting Miners
            </DialogTitle>
            <DialogDescription>
              Settings saved successfully. Miners will restart in {countdown} seconds.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-6xl font-bold text-primary mb-4">{countdown}</div>
              <Progress value={(5 - countdown) * 20} className="h-2" />
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Miners to restart ({pendingRestartMiners.length}):</p>
              <div className="max-h-24 overflow-auto space-y-1">
                {pendingRestartMiners.map((miner) => (
                  <div key={miner.IP} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {miner.name || miner.IP}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelRestart}>
              <X className="h-4 w-4 mr-2" />
              Cancel Restart
            </Button>
            <Button onClick={executeRestart}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 md:p-3 rounded-xl bg-primary/20">
          <Settings className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Miner Config</h1>
          <p className="text-sm text-muted-foreground">Configure pool, performance, and notifications</p>
        </div>
      </div>

      {/* Miner Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Select Miners</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedMiners.size}/{devices.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>All</Button>
            <Button variant="outline" size="sm" onClick={selectNone}>None</Button>
          </div>
          
          {devices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No miners found. Add miners from the Stats page.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-auto">
              {devices.map((miner) => (
                <div
                  key={miner.IP}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    selectedMiners.has(miner.IP) 
                      ? 'bg-primary/10 border-primary/50' 
                      : 'bg-card hover:bg-accent/50'
                  }`}
                  onClick={() => toggleMiner(miner.IP)}
                >
                  <Checkbox
                    checked={selectedMiners.has(miner.IP)}
                    onCheckedChange={() => toggleMiner(miner.IP)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{miner.name || miner.IP}</p>
                    <p className="text-xs text-muted-foreground truncate">{miner.IP}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${miner.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Grid */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Pool Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Pool Settings</CardTitle>
            </div>
            <CardDescription>Configure stratum pool connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pool">Pool Address</Label>
                <Input
                  id="pool"
                  placeholder="solo.ckpool.org"
                  value={poolAddress}
                  onChange={(e) => setPoolAddress(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Without stratum+tcp://</p>
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
                <Label htmlFor="username">Username/Worker</Label>
                <Input
                  id="username"
                  placeholder="bc1q..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  placeholder="x"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <Button 
              className="w-full"
              onClick={sendPoolSettings} 
              disabled={sendingPool || selectedMiners.size === 0}
            >
              {sendingPool ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving & Restarting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Save & Restart Miners
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Performance Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Performance</CardTitle>
            </div>
            <CardDescription>Adjust fan, frequency, and voltage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Default Presets */}
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(DEFAULT_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      activePreset === key
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-card hover:bg-accent/50 border-border'
                    }`}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <p className="text-xs font-medium mt-1">{preset.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Custom Presets</Label>
                {!showSaveInput && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowSaveInput(true)}
                    className="h-7 text-xs"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Current
                  </Button>
                )}
              </div>
              
              {showSaveInput && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Preset name..."
                    value={customPresetName}
                    onChange={(e) => setCustomPresetName(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && saveCustomPreset()}
                  />
                  <Button size="sm" onClick={saveCustomPreset} className="h-8">
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setShowSaveInput(false); setCustomPresetName(""); }}
                    className="h-8"
                  >
                    ✕
                  </Button>
                </div>
              )}
              
              {customPresets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {customPresets.map((preset, index) => (
                    <div
                      key={index}
                      className={`group relative p-2 rounded-lg border text-center transition-all cursor-pointer ${
                        activePreset === `custom-${index}`
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-card hover:bg-accent/50 border-border'
                      }`}
                      onClick={() => applyCustomPreset(preset, index)}
                    >
                      <span className="text-lg">⚙️</span>
                      <p className="text-xs font-medium mt-1 truncate">{preset.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {preset.frequency}MHz • {preset.voltage}mV
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCustomPreset(index); }}
                        className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No custom presets. Adjust sliders and save your settings.
                </p>
              )}
            </div>

            {/* Fan Speed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Fan className="h-4 w-4" />
                  Fan Speed
                </Label>
                <span className="text-sm font-mono bg-secondary px-2 py-0.5 rounded">
                  {fanSpeed}%
                </span>
              </div>
              <Slider
                value={[fanSpeed]}
                onValueChange={(v) => setFanSpeed(v[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Frequency
                </Label>
                <span className="text-sm font-mono bg-secondary px-2 py-0.5 rounded">
                  {frequency} MHz
                </span>
              </div>
              <Slider
                value={[frequency]}
                onValueChange={(v) => setFrequency(v[0])}
                min={300}
                max={650}
                step={5}
                className="w-full"
              />
            </div>

            {/* Voltage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Core Voltage
                </Label>
                <span className="text-sm font-mono bg-secondary px-2 py-0.5 rounded">
                  {coreVoltage} mV
                </span>
              </div>
              <Slider
                value={[coreVoltage]}
                onValueChange={(v) => setCoreVoltage(v[0])}
                min={850}
                max={1400}
                step={10}
                className="w-full"
              />
            </div>

            {activePreset === 'max' && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-medium">
                  ⚠️ Max OC may damage your device. Use at your own risk.
                </p>
              </div>
            )}
            
            <Button 
              className="w-full"
              onClick={sendPerformanceSettings} 
              disabled={sendingPerformance || selectedMiners.size === 0}
            >
              {sendingPerformance ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving & Restarting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Save & Restart Miners
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notification Settings</CardTitle>
            </div>
            <CardDescription>Configure alerts for block found and temperature warnings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Block Found Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Block Found</p>
                    <p className="text-xs text-muted-foreground">Alert on new best diff</p>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.blockFoundEnabled}
                  onCheckedChange={(checked) => updateNotificationSettings({ blockFoundEnabled: checked })}
                />
              </div>

              {/* Temperature Warning Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Thermometer className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Temp Warning</p>
                    <p className="text-xs text-muted-foreground">Alert when too hot</p>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.tempWarningEnabled}
                  onCheckedChange={(checked) => updateNotificationSettings({ tempWarningEnabled: checked })}
                />
              </div>

              {/* Temperature Threshold */}
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Temp Threshold</p>
                  <span className="text-sm font-mono bg-secondary px-2 py-0.5 rounded">
                    {notificationSettings.tempThreshold}°C
                  </span>
                </div>
                <Slider
                  value={[notificationSettings.tempThreshold]}
                  onValueChange={(v) => updateNotificationSettings({ tempThreshold: v[0] })}
                  min={50}
                  max={90}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Sound Toggle & Test */}
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    <p className="font-medium text-sm">Sound Effects</p>
                  </div>
                  <Switch
                    checked={notificationSettings.soundEnabled}
                    onCheckedChange={(checked) => updateNotificationSettings({ soundEnabled: checked })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs"
                    onClick={() => playTestSound('block')}
                    disabled={!notificationSettings.soundEnabled}
                  >
                    🎉 Test Block
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs"
                    onClick={() => playTestSound('warning')}
                    disabled={!notificationSettings.soundEnabled}
                  >
                    ⚠️ Test Warn
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
};

export default Config;
