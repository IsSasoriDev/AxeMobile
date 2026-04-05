import { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, Monitor, Smartphone, Type, RefreshCw, Bell, 
  Trash2, Download, Shield, Thermometer, Globe, Zap, Eye, Volume2, MessageSquare,
  AlertTriangle, HardDrive, Server, Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePlatform } from "@/hooks/usePlatform";

interface AppSettings {
  tempUnit: "celsius" | "fahrenheit";
  hashrateUnit: "auto" | "GH" | "TH" | "MH";
  refreshInterval: number; // seconds
  autoRefresh: boolean;
  backgroundMonitoring: boolean;
  compactMode: boolean;
  showAnimations: boolean;
  discordWebhook: string;
  discordEnabled: boolean;
  discordEvents: { blockFound: boolean; tempWarning: boolean; minerOffline: boolean; hashrateDropped: boolean };
  announcementsEnabled: boolean;
  atlasPoolWallet: string;
  // Alert thresholds
  tempWarningThreshold: number;
  tempCriticalThreshold: number;
  hashrateDropPercent: number;
  offlineAlertDelay: number; // seconds
}

const DEFAULT_SETTINGS: AppSettings = {
  tempUnit: "celsius",
  hashrateUnit: "auto",
  refreshInterval: 30,
  autoRefresh: true,
  backgroundMonitoring: true,
  compactMode: false,
  showAnimations: true,
  discordWebhook: "",
  discordEnabled: false,
  discordEvents: { blockFound: true, tempWarning: true, minerOffline: true, hashrateDropped: false },
  announcementsEnabled: true,
  atlasPoolWallet: "",
  tempWarningThreshold: 65,
  tempCriticalThreshold: 80,
  hashrateDropPercent: 20,
  offlineAlertDelay: 120,
};

export default function Settings() {
  const { platform, setPlatform, textSize, setTextSize } = usePlatform();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("axemobile-settings");
    if (saved) try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch {}
    return DEFAULT_SETTINGS;
  });

  const saveSettings = (update: Partial<AppSettings>) => {
    const updated = { ...settings, ...update };
    setSettings(updated);
    localStorage.setItem("axemobile-settings", JSON.stringify(updated));
    toast.success("Settings saved");
  };

  const clearCache = () => {
    const keysToKeep = ["axemobile-platform", "axemobile-theme", "axemobile-text-size", "axemobile-settings"];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => { if (!keysToKeep.includes(key)) localStorage.removeItem(key); });
    toast.success("Cache cleared");
  };

  const resetApp = () => {
    localStorage.clear();
    window.location.reload();
  };

  const exportData = () => {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "axemobile-backup.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  const Section = ({ icon: Icon, title, children }: { icon: typeof SettingsIcon; title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold font-mono tracking-tight">Settings</h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">App Preferences</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Platform */}
        <Section icon={Monitor} title="Platform">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { if (platform !== "pc") { setPlatform("pc"); setTimeout(() => window.location.reload(), 300); } }} className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
              platform === "pc" ? "border-primary bg-primary/10" : "border-border/30 hover:border-primary/20"
            }`}>
              <Monitor className={`h-4 w-4 ${platform === "pc" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-xs font-mono font-bold">Desktop</span>
            </button>
            <button onClick={() => { if (platform !== "mobile") { setPlatform("mobile"); setTimeout(() => window.location.reload(), 300); } }} className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
              platform === "mobile" ? "border-primary bg-primary/10" : "border-border/30 hover:border-primary/20"
            }`}>
              <Smartphone className={`h-4 w-4 ${platform === "mobile" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-xs font-mono font-bold">Mobile</span>
            </button>
          </div>
        </Section>

        {/* Display */}
        <Section icon={Type} title="Display">
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Text Size</Label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {(["small", "medium", "large"] as const).map(size => (
                  <button key={size} onClick={() => setTextSize(size)} className={`p-2 rounded-lg border text-center transition-all text-xs font-mono capitalize ${
                    textSize === size ? "bg-primary/15 border-primary/40 text-primary" : "border-border/30 hover:bg-secondary/30"
                  }`}>{size}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Temperature</Label>
                <Select value={settings.tempUnit} onValueChange={v => saveSettings({ tempUnit: v as any })}>
                  <SelectTrigger className="h-8 text-xs font-mono mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celsius">°C Celsius</SelectItem>
                    <SelectItem value="fahrenheit">°F Fahrenheit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Hashrate</Label>
                <Select value={settings.hashrateUnit} onValueChange={v => saveSettings({ hashrateUnit: v as any })}>
                  <SelectTrigger className="h-8 text-xs font-mono mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="MH">MH/s</SelectItem>
                    <SelectItem value="GH">GH/s</SelectItem>
                    <SelectItem value="TH">TH/s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-mono">Show Animations</span>
              </div>
              <Switch checked={settings.showAnimations} onCheckedChange={v => saveSettings({ showAnimations: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-mono">Compact Mode</span>
              </div>
              <Switch checked={settings.compactMode} onCheckedChange={v => saveSettings({ compactMode: v })} />
            </div>
          </div>
        </Section>

        {/* Auto-Refresh */}
        <Section icon={RefreshCw} title="Polling & Refresh">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono">Auto Refresh</span>
              <Switch checked={settings.autoRefresh} onCheckedChange={v => saveSettings({ autoRefresh: v })} />
            </div>
            {settings.autoRefresh && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Interval</Label>
                  <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">{settings.refreshInterval}s</span>
                </div>
                <Slider value={[settings.refreshInterval]} onValueChange={v => saveSettings({ refreshInterval: v[0] })} min={10} max={120} step={5} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono">Background Monitoring</span>
              <Switch checked={settings.backgroundMonitoring} onCheckedChange={v => saveSettings({ backgroundMonitoring: v })} />
            </div>
          </div>
        </Section>

        {/* Discord Webhook */}
        <Section icon={MessageSquare} title="Discord Notifications">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono">Enable Discord Alerts</span>
              <Switch checked={settings.discordEnabled} onCheckedChange={v => saveSettings({ discordEnabled: v })} />
            </div>
            {settings.discordEnabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Webhook URL</Label>
                  <Input 
                    placeholder="https://discord.com/api/webhooks/..." 
                    value={settings.discordWebhook} 
                    onChange={e => saveSettings({ discordWebhook: e.target.value })} 
                    className="h-8 text-xs font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase">Events</p>
                  {[
                    { key: "blockFound", label: "Block Found", icon: "🎉" },
                    { key: "tempWarning", label: "Temp Warning", icon: "🌡️" },
                    { key: "minerOffline", label: "Miner Offline", icon: "⚠️" },
                    { key: "hashrateDropped", label: "Hashrate Drop", icon: "📉" },
                  ].map(event => (
                    <div key={event.key} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono">{event.icon} {event.label}</span>
                      <Switch 
                        checked={(settings.discordEvents as any)[event.key]} 
                        onCheckedChange={v => saveSettings({ 
                          discordEvents: { ...settings.discordEvents, [event.key]: v } 
                        })} 
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Alert Thresholds */}
        <Section icon={AlertTriangle} title="Alert Thresholds">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Temp Warning</Label>
                <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">{settings.tempWarningThreshold}°C</span>
              </div>
              <Slider value={[settings.tempWarningThreshold]} onValueChange={v => saveSettings({ tempWarningThreshold: v[0] })} min={40} max={90} step={5} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Temp Critical</Label>
                <span className="text-[10px] font-mono bg-destructive/20 px-1.5 py-0.5 rounded text-destructive">{settings.tempCriticalThreshold}°C</span>
              </div>
              <Slider value={[settings.tempCriticalThreshold]} onValueChange={v => saveSettings({ tempCriticalThreshold: v[0] })} min={50} max={100} step={5} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Hashrate Drop Alert</Label>
                <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">{settings.hashrateDropPercent}%</span>
              </div>
              <Slider value={[settings.hashrateDropPercent]} onValueChange={v => saveSettings({ hashrateDropPercent: v[0] })} min={5} max={50} step={5} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Offline Alert Delay</Label>
                <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">{settings.offlineAlertDelay}s</span>
              </div>
              <Slider value={[settings.offlineAlertDelay]} onValueChange={v => saveSettings({ offlineAlertDelay: v[0] })} min={30} max={600} step={30} />
            </div>
          </div>
        </Section>

        {/* AtlasPool */}
        <Section icon={Globe} title="AtlasPool">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Bitcoin Wallet Address</Label>
              <Input
                placeholder="bc1q... or 1... or 3..."
                value={settings.atlasPoolWallet}
                onChange={e => saveSettings({ atlasPoolWallet: e.target.value.trim() })}
                className="h-8 text-xs font-mono"
              />
            </div>
            <p className="text-[9px] text-muted-foreground font-mono">Enter your BTC address to open your AtlasPool dashboard directly.</p>
          </div>
        </Section>

        {/* Announcements */}
        <Section icon={Megaphone} title="Announcements">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-mono">Show Announcements</span>
              </div>
              <Switch checked={settings.announcementsEnabled} onCheckedChange={v => saveSettings({ announcementsEnabled: v })} />
            </div>
            <p className="text-[9px] text-muted-foreground font-mono">Receive app-wide announcements and updates from the team.</p>
          </div>
        </Section>

        {/* Data & Privacy */}
        <Section icon={Shield} title="Data & Privacy">
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs font-mono gap-2 justify-start" onClick={exportData}>
              <Download className="h-3 w-3" /> Export All Data
            </Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs font-mono gap-2 justify-start" onClick={clearCache}>
              <Trash2 className="h-3 w-3" /> Clear Cache
            </Button>
            <Button variant="destructive" size="sm" className="w-full h-8 text-xs font-mono gap-2 justify-start" onClick={resetApp}>
              <Trash2 className="h-3 w-3" /> Reset App (Everything)
            </Button>
            <p className="text-[9px] text-muted-foreground font-mono">All data is stored locally. Nothing is sent to external servers.</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
