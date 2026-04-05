import { useState, useEffect, useRef, useCallback } from "react";
import { Settings, Loader2, Fan, Cpu, Zap, Server, Bell, Thermometer, Trophy, Volume2, Save, Trash2, RotateCcw, X, Clock, AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";

interface CustomPreset { name: string; fan: number; frequency: number; voltage: number; }
interface NotificationSettings { blockFoundEnabled: boolean; tempWarningEnabled: boolean; tempThreshold: number; soundEnabled: boolean; }
interface ScheduledOC { enabled: boolean; startHour: number; endHour: number; preset: string; originalSettings: { fan: number; frequency: number; voltage: number } | null; }
interface DualPool { enabled: boolean; pool1Url: string; pool1Port: string; pool1User: string; pool2Url: string; pool2Port: string; pool2User: string; pool1Percent: number; }

const DEFAULT_PRESETS = {
  eco: { name: "Eco", icon: "🌱", fan: 50, frequency: 350, voltage: 1000, description: "Low power" },
  balanced: { name: "Balanced", icon: "⚖️", fan: 75, frequency: 485, voltage: 1200, description: "Default" },
  performance: { name: "Performance", icon: "🚀", fan: 100, frequency: 575, voltage: 1300, description: "High hashrate" },
  max: { name: "Max OC", icon: "⚡", fan: 100, frequency: 650, voltage: 1400, description: "Maximum" },
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  blockFoundEnabled: true, tempWarningEnabled: true, tempThreshold: 70, soundEnabled: true,
};

const playTestSound = (type: 'block' | 'warning') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (type === 'block') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = audioContext.createOscillator(); const g = audioContext.createGain();
        o.connect(g); g.connect(audioContext.destination); o.type = 'sine';
        o.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
        g.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.4);
        o.start(audioContext.currentTime + i * 0.15); o.stop(audioContext.currentTime + i * 0.15 + 0.4);
      });
    } else {
      const o = audioContext.createOscillator(); const g = audioContext.createGain();
      o.connect(g); g.connect(audioContext.destination); o.type = 'square';
      o.frequency.setValueAtTime(880, audioContext.currentTime);
      o.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 0.15);
      g.gain.setValueAtTime(0.2, audioContext.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      o.start(); o.stop(audioContext.currentTime + 0.5);
    }
  } catch (e) { console.error('Sound failed:', e); }
};

const Config = () => {
  const { devices } = useNetworkScanner();
  const [poolAddress, setPoolAddress] = useState("");
  const [port, setPort] = useState("3333");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("x");
  const [fanSpeed, setFanSpeed] = useState(100);
  const [frequency, setFrequency] = useState(485);
  const [coreVoltage, setCoreVoltage] = useState(1200);
  const [activePreset, setActivePreset] = useState<string | null>("balanced");
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [customPresetName, setCustomPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [selectedMiners, setSelectedMiners] = useState<Set<string>>(new Set());
  const [sendingPool, setSendingPool] = useState(false);
  const [sendingPerformance, setSendingPerformance] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [pendingRestartMiners, setPendingRestartMiners] = useState<MinerDevice[]>([]);
  const [restartType, setRestartType] = useState<'pool' | 'performance'>('pool');
  const [ocWarningAccepted, setOcWarningAccepted] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // Scheduled OC
  const [scheduledOC, setScheduledOC] = useState<ScheduledOC>(() => {
    const saved = localStorage.getItem("SCHEDULED_OC");
    if (saved) try { return JSON.parse(saved); } catch {}
    return { enabled: false, startHour: 22, endHour: 6, preset: "performance", originalSettings: null };
  });

  // Dual Pool (NerdAxe)
  const [dualPool, setDualPool] = useState<DualPool>(() => {
    const saved = localStorage.getItem("DUAL_POOL");
    if (saved) try { return JSON.parse(saved); } catch {}
    return { enabled: false, pool1Url: "", pool1Port: "3333", pool1User: "", pool2Url: "", pool2Port: "3333", pool2User: "", pool1Percent: 70 };
  });

  useEffect(() => {
    const sn = localStorage.getItem('NOTIFICATION_SETTINGS');
    if (sn) try { setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(sn) }); } catch {}
    const sp = localStorage.getItem('CUSTOM_PRESETS');
    if (sp) try { setCustomPresets(JSON.parse(sp)); } catch {}
  }, []);

  const updateNotificationSettings = (u: Partial<NotificationSettings>) => {
    const n = { ...notificationSettings, ...u };
    setNotificationSettings(n);
    localStorage.setItem('NOTIFICATION_SETTINGS', JSON.stringify(n));
    toast.success("Settings saved");
  };

  const updateScheduledOC = (u: Partial<ScheduledOC>) => {
    const n = { ...scheduledOC, ...u };
    setScheduledOC(n);
    localStorage.setItem('SCHEDULED_OC', JSON.stringify(n));
    if (u.enabled !== undefined) toast.success(u.enabled ? "Scheduled OC enabled" : "Scheduled OC disabled");
  };

  const updateDualPool = (u: Partial<DualPool>) => {
    const n = { ...dualPool, ...u };
    setDualPool(n);
    localStorage.setItem('DUAL_POOL', JSON.stringify(n));
  };

  useEffect(() => { if (devices.length > 0 && selectedMiners.size === 0) setSelectedMiners(new Set(devices.map(m => m.IP))); }, [devices]);

  const applyPreset = (key: string) => {
    if ((key === 'max' || key === 'performance') && !ocWarningAccepted) {
      toast.error("Accept the overclocking warning first");
      return;
    }
    const p = DEFAULT_PRESETS[key as keyof typeof DEFAULT_PRESETS];
    if (p) { setFanSpeed(p.fan); setFrequency(p.frequency); setCoreVoltage(p.voltage); setActivePreset(key); toast.success(`Applied ${p.name}`); }
  };

  const applyCustomPreset = (p: CustomPreset, i: number) => {
    setFanSpeed(p.fan); setFrequency(p.frequency); setCoreVoltage(p.voltage); setActivePreset(`custom-${i}`); toast.success(`Applied ${p.name}`);
  };

  const saveCustomPreset = () => {
    if (!customPresetName.trim()) { toast.error("Enter a name"); return; }
    const np: CustomPreset = { name: customPresetName.trim(), fan: fanSpeed, frequency, voltage: coreVoltage };
    const up = [...customPresets, np];
    setCustomPresets(up); localStorage.setItem('CUSTOM_PRESETS', JSON.stringify(up));
    setCustomPresetName(""); setShowSaveInput(false); toast.success(`Saved "${np.name}"`);
  };

  const deleteCustomPreset = (i: number) => {
    const up = customPresets.filter((_, idx) => idx !== i);
    setCustomPresets(up); localStorage.setItem('CUSTOM_PRESETS', JSON.stringify(up)); toast.success("Deleted");
  };

  useEffect(() => {
    const md = Object.entries(DEFAULT_PRESETS).find(([_, p]) => p.fan === fanSpeed && p.frequency === frequency && p.voltage === coreVoltage);
    if (md) { setActivePreset(md[0]); return; }
    const mc = customPresets.findIndex(p => p.fan === fanSpeed && p.frequency === frequency && p.voltage === coreVoltage);
    setActivePreset(mc !== -1 ? `custom-${mc}` : null);
  }, [fanSpeed, frequency, coreVoltage, customPresets]);

  const toggleMiner = (ip: string) => setSelectedMiners(prev => { const n = new Set(prev); n.has(ip) ? n.delete(ip) : n.add(ip); return n; });

  const restartMiners = async (miners: MinerDevice[]) => {
    let c = 0;
    for (const m of miners) { try { await invoke("restart_miner", { ip: m.IP }); c++; } catch {} }
    return c;
  };

  const startCountdown = useCallback((miners: MinerDevice[], type: 'pool' | 'performance') => {
    setPendingRestartMiners(miners); setRestartType(type); setCountdown(5); setShowCountdown(true); cancelledRef.current = false;
  }, []);

  const cancelRestart = useCallback(() => {
    cancelledRef.current = true;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setShowCountdown(false); setPendingRestartMiners([]); toast.info("Restart cancelled");
    setSendingPool(false); setSendingPerformance(false);
  }, []);

  const executeRestart = useCallback(async () => {
    setShowCountdown(false);
    toast.info(`Restarting ${pendingRestartMiners.length} miner(s)...`);
    const c = await restartMiners(pendingRestartMiners);
    toast.success(`Restarted ${c} miner(s)`);
    setPendingRestartMiners([]);
    restartType === 'pool' ? setSendingPool(false) : setSendingPerformance(false);
  }, [pendingRestartMiners, restartType]);

  useEffect(() => {
    if (showCountdown && countdown > 0) {
      countdownRef.current = setTimeout(() => { if (!cancelledRef.current) setCountdown(p => p - 1); }, 1000);
      return () => { if (countdownRef.current) clearTimeout(countdownRef.current); };
    } else if (showCountdown && countdown === 0 && !cancelledRef.current) executeRestart();
  }, [showCountdown, countdown, executeRestart]);

  const sendPoolSettings = async () => {
    if (!poolAddress.trim()) { toast.error("Enter pool address"); return; }
    if (selectedMiners.size === 0) { toast.error("Select miners"); return; }
    setSendingPool(true);
    const selected = devices.filter(m => selectedMiners.has(m.IP));
    let ok = 0, fail = 0; const good: MinerDevice[] = [];
    for (const m of selected) {
      try {
        const clean = poolAddress.replace(/^stratum\+tcp:\/\//i, '');
        await invoke("update_miner_settings", { ip: m.IP, stratumUrl: clean, stratumPort: parseInt(port, 10), stratumUser: username || null, stratumPassword: password || "x", fanSpeed: null, frequency: null, coreVoltage: null });
        ok++; good.push(m);
      } catch { fail++; }
    }
    if (fail > 0) toast.error(`Failed: ${fail} miner(s)`);
    if (good.length > 0) { toast.success(`Saved on ${ok} miner(s)`); startCountdown(good, 'pool'); } else setSendingPool(false);
  };

  const sendPerformanceSettings = async () => {
    if (selectedMiners.size === 0) { toast.error("Select miners"); return; }
    if ((frequency > 575 || coreVoltage > 1300) && !ocWarningAccepted) {
      toast.error("Accept the overclocking warning first");
      return;
    }
    setSendingPerformance(true);
    const selected = devices.filter(m => selectedMiners.has(m.IP));
    let ok = 0, fail = 0; const good: MinerDevice[] = [];
    for (const m of selected) {
      try {
        await invoke("update_miner_settings", { ip: m.IP, stratumUrl: null, stratumPort: null, stratumUser: null, stratumPassword: null, fanSpeed, frequency, coreVoltage });
        ok++; good.push(m);
      } catch { fail++; }
    }
    if (fail > 0) toast.error(`Failed: ${fail} miner(s)`);
    if (good.length > 0) { toast.success(`Saved on ${ok} miner(s)`); startCountdown(good, 'performance'); } else setSendingPerformance(false);
  };

  return (
    <>
      <Dialog open={showCountdown} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <RotateCcw className="h-4 w-4 text-primary animate-spin" /> Restarting Miners
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">Miners restart in {countdown}s</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <div className="text-5xl font-black font-mono text-primary mb-3">{countdown}</div>
            <Progress value={(5 - countdown) * 20} className="h-1.5" />
            <div className="mt-3 text-[10px] text-muted-foreground font-mono">
              {pendingRestartMiners.map(m => m.name || m.IP).join(', ')}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelRestart} className="font-mono text-xs"><X className="h-3 w-3 mr-1" />Cancel</Button>
            <Button size="sm" onClick={executeRestart} className="font-mono text-xs"><RotateCcw className="h-3 w-3 mr-1" />Now</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Configuration</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Pool · Performance · Schedule</p>
          </div>
        </div>

        {/* Miner Selection */}
        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Select Miners</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">{selectedMiners.size}/{devices.length}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono" onClick={() => setSelectedMiners(new Set(devices.map(m => m.IP)))}>All</Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono" onClick={() => setSelectedMiners(new Set())}>None</Button>
            </div>
          </div>
          {devices.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 font-mono">No miners found</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-32 overflow-auto">
              {devices.map(m => (
                <div key={m.IP} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-xs font-mono ${
                  selectedMiners.has(m.IP) ? 'bg-primary/8 border-primary/30' : 'border-border/30 hover:bg-secondary/30'
                }`} onClick={() => toggleMiner(m.IP)}>
                  <Checkbox checked={selectedMiners.has(m.IP)} onCheckedChange={() => toggleMiner(m.IP)} className="h-3.5 w-3.5" />
                  <span className="truncate flex-1">{m.name || m.IP}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-accent' : 'bg-destructive'}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pool" className="space-y-3">
          <TabsList className="grid grid-cols-4 h-8">
            <TabsTrigger value="pool" className="text-[10px] font-mono">Pool</TabsTrigger>
            <TabsTrigger value="performance" className="text-[10px] font-mono">Performance</TabsTrigger>
            <TabsTrigger value="schedule" className="text-[10px] font-mono">Schedule</TabsTrigger>
            <TabsTrigger value="dualpool" className="text-[10px] font-mono">Dual Pool</TabsTrigger>
          </TabsList>

          {/* Pool Tab */}
          <TabsContent value="pool">
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Pool Settings</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Pool Address</Label>
                  <Input placeholder="solo.ckpool.org" value={poolAddress} onChange={e => setPoolAddress(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Port</Label>
                  <Input placeholder="3333" value={port} onChange={e => setPort(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Username</Label>
                  <Input placeholder="bc1q..." value={username} onChange={e => setUsername(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Password</Label>
                  <Input placeholder="x" value={password} onChange={e => setPassword(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
              </div>
              <Button className="w-full h-8 text-xs font-mono" onClick={sendPoolSettings} disabled={sendingPool || selectedMiners.size === 0}>
                {sendingPool ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</> : <><RotateCcw className="h-3 w-3 mr-1" />Save & Restart</>}
              </Button>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Performance</h2>
              </div>

              {/* OC Warning */}
              <div className={`p-3 rounded-lg border ${ocWarningAccepted ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold font-mono text-warning">Overclocking Warning</p>
                    <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                      Overclocking can damage your hardware, void warranty, and cause instability. You proceed at your own risk.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox id="oc-accept" checked={ocWarningAccepted} onCheckedChange={c => setOcWarningAccepted(c === true)} className="h-3.5 w-3.5" />
                      <label htmlFor="oc-accept" className="text-[10px] font-mono font-bold text-warning cursor-pointer">
                        I understand the risks and accept responsibility
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(DEFAULT_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => applyPreset(key)} className={`p-2 rounded-lg border text-center transition-all text-[10px] font-mono ${
                    activePreset === key ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border/30 hover:bg-secondary/30'
                  } ${(key === 'max' || key === 'performance') && !ocWarningAccepted ? 'opacity-40 cursor-not-allowed' : ''}`}
                  disabled={(key === 'max' || key === 'performance') && !ocWarningAccepted}>
                    <span className="text-base">{p.icon}</span>
                    <p className="mt-0.5 font-medium">{p.name}</p>
                  </button>
                ))}
              </div>

              {/* Custom presets */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Custom</span>
                {!showSaveInput && (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] font-mono" onClick={() => setShowSaveInput(true)}>
                    <Save className="h-2.5 w-2.5 mr-0.5" />Save
                  </Button>
                )}
              </div>
              {showSaveInput && (
                <div className="flex gap-1">
                  <Input placeholder="Name..." value={customPresetName} onChange={e => setCustomPresetName(e.target.value)} className="h-7 text-[10px] font-mono" onKeyDown={e => e.key === 'Enter' && saveCustomPreset()} />
                  <Button size="sm" onClick={saveCustomPreset} className="h-7 px-2"><Save className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowSaveInput(false); setCustomPresetName(""); }} className="h-7 px-2">✕</Button>
                </div>
              )}
              {customPresets.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {customPresets.map((p, i) => (
                    <div key={i} className={`group relative p-1.5 rounded-lg border text-center transition-all cursor-pointer text-[10px] font-mono ${
                      activePreset === `custom-${i}` ? 'bg-primary/15 border-primary/40' : 'border-border/30 hover:bg-secondary/30'
                    }`} onClick={() => applyCustomPreset(p, i)}>
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-[8px] text-muted-foreground">{p.frequency}MHz</p>
                      <button onClick={(e) => { e.stopPropagation(); deleteCustomPreset(i); }} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Sliders */}
              {[
                { icon: Fan, label: "Fan", value: fanSpeed, set: setFanSpeed, min: 0, max: 100, step: 5, unit: "%" },
                { icon: Cpu, label: "Frequency", value: frequency, set: setFrequency, min: 300, max: 650, step: 5, unit: "MHz" },
                { icon: Zap, label: "Voltage", value: coreVoltage, set: setCoreVoltage, min: 850, max: 1400, step: 10, unit: "mV" },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1"><s.icon className="h-3 w-3" />{s.label}</Label>
                    <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">{s.value}{s.unit}</span>
                  </div>
                  <Slider value={[s.value]} onValueChange={v => s.set(v[0])} min={s.min} max={s.max} step={s.step} />
                </div>
              ))}

              <Button className="w-full h-8 text-xs font-mono" onClick={sendPerformanceSettings} disabled={sendingPerformance || selectedMiners.size === 0}>
                {sendingPerformance ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</> : <><RotateCcw className="h-3 w-3 mr-1" />Save & Restart</>}
              </Button>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule">
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Scheduled OC</h2>
                </div>
                <Switch checked={scheduledOC.enabled} onCheckedChange={v => updateScheduledOC({ enabled: v })} />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Automatically apply a performance preset during selected hours, then revert to original settings.
              </p>
              
              <div className={`space-y-3 ${!scheduledOC.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-mono uppercase text-muted-foreground">Start Hour</Label>
                    <Select value={String(scheduledOC.startHour)} onValueChange={v => updateScheduledOC({ startHour: Number(v) })}>
                      <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-mono uppercase text-muted-foreground">End Hour</Label>
                    <Select value={String(scheduledOC.endHour)} onValueChange={v => updateScheduledOC({ endHour: Number(v) })}>
                      <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Preset to Apply</Label>
                  <Select value={scheduledOC.preset} onValueChange={v => updateScheduledOC({ preset: v })}>
                    <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEFAULT_PRESETS).map(([key, p]) => (
                        <SelectItem key={key} value={key}>{p.icon} {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/15">
                  <p className="text-[9px] text-muted-foreground font-mono">
                    ⏰ Active: {String(scheduledOC.startHour).padStart(2, '0')}:00 → {String(scheduledOC.endHour).padStart(2, '0')}:00 · 
                    Applies <span className="text-primary font-bold">{DEFAULT_PRESETS[scheduledOC.preset as keyof typeof DEFAULT_PRESETS]?.name || scheduledOC.preset}</span> then reverts
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Dual Pool Tab */}
          <TabsContent value="dualpool">
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Dual Pool</h2>
                </div>
                <Switch checked={dualPool.enabled} onCheckedChange={v => updateDualPool({ enabled: v })} />
              </div>

              <div className="p-2 rounded-lg bg-warning/5 border border-warning/20">
                <p className="text-[9px] text-warning font-mono font-bold">⚠️ NerdAxe / NerdMiner Only</p>
                <p className="text-[9px] text-muted-foreground font-mono mt-0.5">Dual pool mining only works on NerdMiner-based devices.</p>
              </div>

              <div className={`space-y-3 ${!dualPool.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                {/* Pool distribution slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-mono uppercase text-muted-foreground">Distribution</Label>
                    <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">
                      Pool 1: {dualPool.pool1Percent}% · Pool 2: {100 - dualPool.pool1Percent}%
                    </span>
                  </div>
                  <Slider value={[dualPool.pool1Percent]} onValueChange={v => updateDualPool({ pool1Percent: v[0] })} min={10} max={90} step={5} />
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {/* Pool 1 */}
                  <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <p className="text-[10px] font-mono font-bold text-primary">Pool 1 ({dualPool.pool1Percent}%)</p>
                    <div className="space-y-1">
                      <Input placeholder="Pool address" value={dualPool.pool1Url} onChange={e => updateDualPool({ pool1Url: e.target.value })} className="h-7 text-[10px] font-mono" />
                      <div className="grid grid-cols-2 gap-1">
                        <Input placeholder="Port" value={dualPool.pool1Port} onChange={e => updateDualPool({ pool1Port: e.target.value })} className="h-7 text-[10px] font-mono" />
                        <Input placeholder="Username" value={dualPool.pool1User} onChange={e => updateDualPool({ pool1User: e.target.value })} className="h-7 text-[10px] font-mono" />
                      </div>
                    </div>
                  </div>
                  {/* Pool 2 */}
                  <div className="space-y-2 p-3 rounded-lg border border-accent/20 bg-accent/5">
                    <p className="text-[10px] font-mono font-bold text-accent">Pool 2 ({100 - dualPool.pool1Percent}%)</p>
                    <div className="space-y-1">
                      <Input placeholder="Pool address" value={dualPool.pool2Url} onChange={e => updateDualPool({ pool2Url: e.target.value })} className="h-7 text-[10px] font-mono" />
                      <div className="grid grid-cols-2 gap-1">
                        <Input placeholder="Port" value={dualPool.pool2Port} onChange={e => updateDualPool({ pool2Port: e.target.value })} className="h-7 text-[10px] font-mono" />
                        <Input placeholder="Username" value={dualPool.pool2User} onChange={e => updateDualPool({ pool2User: e.target.value })} className="h-7 text-[10px] font-mono" />
                      </div>
                    </div>
                  </div>
                </div>

                <Button className="w-full h-8 text-xs font-mono" disabled={selectedMiners.size === 0 || !dualPool.pool1Url || !dualPool.pool2Url}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Apply Dual Pool
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Notifications */}
        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Notifications</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-secondary/20">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                <div><p className="text-[10px] font-mono font-medium">Block Found</p></div>
              </div>
              <Switch checked={notificationSettings.blockFoundEnabled} onCheckedChange={c => updateNotificationSettings({ blockFoundEnabled: c })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-secondary/20">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-destructive" />
                <div><p className="text-[10px] font-mono font-medium">Temp Warning</p></div>
              </div>
              <Switch checked={notificationSettings.tempWarningEnabled} onCheckedChange={c => updateNotificationSettings({ tempWarningEnabled: c })} />
            </div>
            <div className="p-3 rounded-lg border border-border/30 bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono font-medium">Threshold</p>
                <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded">{notificationSettings.tempThreshold}°C</span>
              </div>
              <Slider value={[notificationSettings.tempThreshold]} onValueChange={v => updateNotificationSettings({ tempThreshold: v[0] })} min={50} max={90} step={5} />
            </div>
            <div className="p-3 rounded-lg border border-border/30 bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1"><Volume2 className="h-3 w-3" /><p className="text-[10px] font-mono font-medium">Sound</p></div>
                <Switch checked={notificationSettings.soundEnabled} onCheckedChange={c => updateNotificationSettings({ soundEnabled: c })} />
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1 text-[9px] h-6 font-mono" onClick={() => playTestSound('block')} disabled={!notificationSettings.soundEnabled}>🎉 Block</Button>
                <Button variant="outline" size="sm" className="flex-1 text-[9px] h-6 font-mono" onClick={() => playTestSound('warning')} disabled={!notificationSettings.soundEnabled}>⚠️ Warn</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Config;
