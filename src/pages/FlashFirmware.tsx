import { useState, useRef, useCallback } from "react";
import { 
  Zap, AlertTriangle, Download, Loader2, Check, ExternalLink, ChevronRight, 
  Usb, Wifi, Terminal, RefreshCw, X, ChevronDown, Shield, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const bitaxeIcon = "/images/7adf75f8-8945-4fd7-860c-25e1ed367b3c.png";
const nerdaxeIcon = "/images/e4e02e37-303c-4cd3-ab4d-7ba7dba7a3ea.png";

interface FirmwareRelease {
  tag: string;
  name: string;
  date: string;
  url: string;
  assets: { name: string; url: string; size: number }[];
}

interface MinerVariant {
  id: string;
  name: string;
  chip: string;
  description: string;
  repo: string;
  repoOwner: string;
  repoName: string;
  flasherUrl: string;
  flashOffsets: { bootloader: number; partitionTable: number; app: number };
  /** Substring match to auto-select the correct .bin for this variant */
  firmwareMatch: string;
}

interface MinerModel {
  id: string;
  name: string;
  icon: string;
  variants: MinerVariant[];
}

const defaultBitaxe = {
  repo: "https://github.com/bitaxeorg/ESP-Miner",
  repoOwner: "bitaxeorg",
  repoName: "ESP-Miner",
  flasherUrl: "https://bitaxeorg.github.io/bitaxe-web-flasher",
  flashOffsets: { bootloader: 0x0, partitionTable: 0x8000, app: 0x10000 },
};

const defaultNerdAxe = {
  repo: "https://github.com/shufps/ESP-Miner-NerdQAxePlus",
  repoOwner: "shufps",
  repoName: "ESP-Miner-NerdQAxePlus",
  flasherUrl: "https://shufps.github.io/nerdqaxe-web-flasher",
  flashOffsets: { bootloader: 0x0, partitionTable: 0x8000, app: 0x10000 },
};

const MINER_MODELS: MinerModel[] = [
  {
    id: "bitaxe", name: "Bitaxe", icon: bitaxeIcon,
    variants: [
      { id: "supra", name: "BitAxe Supra", chip: "BM1368", description: "200 Series — High performance single ASIC", firmwareMatch: "esp-miner", ...defaultBitaxe },
      { id: "ultra", name: "BitAxe Ultra", chip: "BM1366", description: "200 Series — Efficient single ASIC miner", firmwareMatch: "esp-miner", ...defaultBitaxe },
      { id: "max", name: "BitAxe Max", chip: "BM1397", description: "100 Series — Entry-level solo miner", firmwareMatch: "esp-miner", ...defaultBitaxe },
      { id: "hex", name: "BitAxe Hex", chip: "6× BM1366", description: "600 Series — Multi-ASIC high hashrate", firmwareMatch: "hex", ...defaultBitaxe },
      { id: "gamma", name: "BitAxe Gamma", chip: "BM1370", description: "600 Series — Based on Antminer S21 Pro chip", firmwareMatch: "esp-miner", ...defaultBitaxe },
      { id: "gamma-turbo", name: "BitAxe Gamma Turbo (GT)", chip: "BM1370", description: "700 Series — Overclocked Gamma variant", firmwareMatch: "esp-miner", ...defaultBitaxe },
      { id: "supra-hex", name: "BitAxe Supra Hex", chip: "6× BM1368", description: "700 Series — Multi-ASIC Supra variant, ~4.2 TH/s", firmwareMatch: "hex", ...defaultBitaxe },
      
    ],
  },
  {
    id: "nerdaxe", name: "NerdAxe", icon: nerdaxeIcon,
    variants: [
      { id: "nerdqaxe-pp", name: "NerdQAxe++", chip: "4× BM1368", description: "Quad ASIC — Most popular NerdAxe miner", firmwareMatch: "NerdQAxe++", ...defaultNerdAxe },
      { id: "nerdqaxe-p", name: "NerdQAxe+", chip: "4× BM1368", description: "Quad ASIC NerdMiner variant", firmwareMatch: "NerdQAxe+", ...defaultNerdAxe },
      { id: "nerdqx", name: "NerdQX", chip: "BM1368", description: "Compact single ASIC NerdMiner", firmwareMatch: "NerdQX", ...defaultNerdAxe },
      { id: "nerdaxe", name: "NerdAxe", chip: "BM1368", description: "Original single ASIC NerdMiner", firmwareMatch: "factory-NerdAxe-", ...defaultNerdAxe },
      { id: "nerdaxe-gamma", name: "NerdAxe Gamma", chip: "BM1370", description: "Single ASIC — S21 Pro chip variant", firmwareMatch: "NerdAxeGamma", ...defaultNerdAxe },
      { id: "nerdoctaxe-plus", name: "NerdOCTAXE+", chip: "8× BM1368", description: "Octa ASIC — High performance NerdMiner", firmwareMatch: "NerdOCTAXE+", ...defaultNerdAxe },
      { id: "nerdoctaxe-gamma", name: "NerdOCTAXE Gamma", chip: "8× BM1370", description: "Octa ASIC — S21 Pro chips, highest hashrate", firmwareMatch: "NerdOCTAXE-Gamma", ...defaultNerdAxe },
      { id: "nerdhaxe-gamma", name: "NerdHaxe Gamma", chip: "6× BM1370", description: "Hex ASIC — 6-chip S21 Pro variant", firmwareMatch: "NerdHaxe-Gamma", ...defaultNerdAxe },
      { id: "nerdeko", name: "NerdEKO", chip: "BM1368", description: "Eco-friendly single ASIC miner", firmwareMatch: "NerdEKO", ...defaultNerdAxe },
    ],
  },
];

type FlashStep = "select" | "firmware" | "connect" | "flash" | "done";

export default function FlashFirmware() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [flashMethod, setFlashMethod] = useState<"usb" | "ota" | "web" | null>(null);
  const [step, setStep] = useState<FlashStep>("select");
  
  // Firmware
  const [releases, setReleases] = useState<FirmwareRelease[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(false);
  
  // USB Flash
  const [port, setPort] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashStatus, setFlashStatus] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);

  const model = MINER_MODELS.find(m => m.id === selectedModel);
  const variant = model?.variants.find(v => v.id === selectedVariant);
  const release = releases.find(r => r.tag === selectedRelease);
  const asset = release?.assets.find(a => a.name === selectedAsset);

  const addLog = useCallback((msg: string) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    setTimeout(() => terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight), 50);
  }, []);

  // Auto-select correct firmware file for a variant (prefer factory builds for USB flash)
  const autoSelectAsset = (rel: FirmwareRelease, v: MinerVariant) => {
    const bins = rel.assets.filter(a => a.name.endsWith(".bin"));
    // Try factory build first (full flash for USB), then OTA build
    const factoryMatch = bins.find(a => a.name.includes("factory") && a.name.includes(v.firmwareMatch));
    const anyMatch = bins.find(a => a.name.includes(v.firmwareMatch));
    setSelectedAsset(factoryMatch?.name || anyMatch?.name || bins[0]?.name || null);
  };

  // Fetch releases from GitHub
  const fetchReleases = async () => {
    if (!variant) return;
    setLoadingReleases(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${variant.repoOwner}/${variant.repoName}/releases?per_page=10`);
      if (!res.ok) throw new Error("Failed to fetch releases");
      const data = await res.json();
      const mapped: FirmwareRelease[] = data.map((r: any) => ({
        tag: r.tag_name,
        name: r.name || r.tag_name,
        date: new Date(r.published_at).toLocaleDateString(),
        url: r.html_url,
        assets: (r.assets || [])
          .filter((a: any) => a.name.endsWith(".bin"))
          .map((a: any) => ({
            name: a.name,
            url: a.browser_download_url,
            size: a.size,
          })),
      }));
      setReleases(mapped);
      if (mapped.length > 0) {
        setSelectedRelease(mapped[0].tag);
        autoSelectAsset(mapped[0], variant);
      }
      addLog(`Fetched ${mapped.length} releases from ${variant.repoOwner}/${variant.repoName}`);
    } catch (err: any) {
      toast.error("Failed to fetch firmware releases");
      addLog(`Error: ${err.message}`);
    } finally {
      setLoadingReleases(false);
    }
  };

  // Connect USB serial
  const connectUSB = async () => {
    if (!("serial" in (navigator as any))) {
      toast.error("Web Serial API not supported. Use Chrome or Edge.");
      addLog("Error: Web Serial API not available in this browser");
      return;
    }
    try {
      addLog("Requesting serial port...");
      const nav = navigator as any;
      const serialPort = await nav.serial.requestPort({
        filters: [
          { usbVendorId: 0x1A86 }, // CH340
          { usbVendorId: 0x10C4 }, // CP2102
          { usbVendorId: 0x0403 }, // FTDI
          { usbVendorId: 0x303A }, // Espressif
        ],
      });
      setPort(serialPort);
      setIsConnected(true);
      addLog("✓ Serial port connected");
      toast.success("Device connected via USB");
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        toast.error("Failed to connect: " + err.message);
        addLog(`Error: ${err.message}`);
      }
    }
  };

  // Flash firmware
  const flashFirmware = async () => {
    if (!port || !asset || !variant) return;
    setIsFlashing(true);
    setFlashProgress(0);
    setFlashStatus("Downloading firmware...");
    addLog(`Downloading ${asset.name} (${(asset.size / 1024).toFixed(0)} KB)...`);

    try {
      // Download firmware binary
      const res = await fetch(asset.url);
      if (!res.ok) throw new Error("Failed to download firmware");
      const firmwareData = await res.arrayBuffer();
      addLog(`✓ Downloaded ${(firmwareData.byteLength / 1024).toFixed(0)} KB`);
      setFlashProgress(10);

      // Import esptool-js dynamically
      setFlashStatus("Initializing flasher...");
      addLog("Loading ESPLoader...");
      const { ESPLoader, Transport } = await import("esptool-js");
      setFlashProgress(15);

      // Open transport
      setFlashStatus("Connecting to ESP32...");
      addLog("Opening serial transport at 115200 baud...");
      const transport = new Transport(port, true);
      setFlashProgress(20);

      const terminal = {
        clean: () => {},
        writeLine: (data: string) => addLog(data),
        write: (data: string) => {
          if (data.trim()) addLog(data.trim());
        },
      };

      const esploader = new ESPLoader({
        transport,
        baudrate: 115200,
        romBaudrate: 115200,
        terminal,
      });

      setFlashStatus("Detecting chip...");
      addLog("Connecting to bootloader...");
      await esploader.main();
      setFlashProgress(30);
      addLog(`✓ Chip detected: ${esploader.chip.CHIP_NAME}`);

      // Convert firmware to binary string for esptool-js
      const uint8 = new Uint8Array(firmwareData);
      let binaryString = "";
      for (let i = 0; i < uint8.length; i++) {
        binaryString += String.fromCharCode(uint8[i]);
      }

      setFlashStatus("Flashing firmware...");
      addLog(`Flashing to offset 0x${variant.flashOffsets.app.toString(16)}...`);

      const flashOptions = {
        fileArray: [{ data: binaryString, address: variant.flashOffsets.app }],
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = 30 + Math.round((written / total) * 65);
          setFlashProgress(pct);
          setFlashStatus(`Flashing... ${Math.round((written / total) * 100)}%`);
        },
        calculateMD5Hash: (image: string) => undefined,
      } as any;

      await esploader.writeFlash(flashOptions);
      setFlashProgress(95);

      setFlashStatus("Resetting device...");
      addLog("✓ Flash complete! Resetting...");
      await esploader.after("hard_reset");
      
      setFlashProgress(100);
      setFlashStatus("Done!");
      setStep("done");
      addLog("✓ Firmware flashed successfully!");
      toast.success("Firmware flashed successfully!");

      await transport.disconnect();
    } catch (err: any) {
      toast.error("Flash failed: " + err.message);
      addLog(`✗ Flash error: ${err.message}`);
      setFlashStatus("Flash failed");
    } finally {
      setIsFlashing(false);
    }
  };

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariant(variantId);
    setFlashMethod(null);
    setReleases([]);
    setSelectedRelease(null);
    setSelectedAsset(null);
    setStep("select");
  };

  const handleSelectMethod = (method: "usb" | "ota" | "web") => {
    setFlashMethod(method);
    if (method === "usb") {
      setStep("firmware");
      fetchReleases();
    } else if (method === "web" && variant) {
      window.open(variant.flasherUrl, "_blank");
    }
  };

  const handleProceedToConnect = () => {
    if (!acknowledgedRisk) {
      toast.error("Please acknowledge the flashing risks first");
      return;
    }
    setStep("connect");
  };

  const handleStartFlash = () => {
    if (!isConnected) {
      toast.error("Connect your device first");
      return;
    }
    setStep("flash");
    flashFirmware();
  };

  const resetAll = () => {
    setStep("select");
    setFlashMethod(null);
    setReleases([]);
    setSelectedRelease(null);
    setSelectedAsset(null);
    setIsConnected(false);
    setPort(null);
    setFlashProgress(0);
    setFlashStatus("");
    setTerminalLogs([]);
    setAcknowledgedRisk(false);
    setIsFlashing(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const currentStepIndex = ["select", "firmware", "connect", "flash", "done"].indexOf(step);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
            <Zap className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Flash Firmware</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">USB Direct Flash & OTA Update</p>
          </div>
        </div>
        {step !== "select" && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1.5 font-mono text-xs h-8">
            <X className="h-3 w-3" /> Reset
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {["Select", "Firmware", "Connect", "Flash", "Done"].map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-mono font-bold border transition-all ${
              i < currentStepIndex ? "bg-accent border-accent text-accent-foreground" :
              i === currentStepIndex ? "bg-primary border-primary text-primary-foreground" :
              "border-border/40 text-muted-foreground"
            }`}>
              {i < currentStepIndex ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-[9px] font-mono hidden sm:inline ${i === currentStepIndex ? "text-primary font-bold" : "text-muted-foreground"}`}>{label}</span>
            {i < 4 && <div className={`flex-1 h-px ${i < currentStepIndex ? "bg-accent" : "bg-border/30"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Miner & Variant */}
      {step === "select" && (
        <div className="space-y-3 animate-fade-in">
          {/* Model selection */}
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Select Miner</h2>
            <div className="grid grid-cols-2 gap-3">
              {MINER_MODELS.map(m => (
                <button key={m.id}
                  onClick={() => { setSelectedModel(m.id); setSelectedVariant(null); }}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    selectedModel === m.id ? "border-primary bg-primary/10" : "border-border/30 bg-card/30 hover:border-primary/20"
                  }`}
                >
                  <img src={m.icon} alt={m.name} className="w-10 h-10 object-contain" />
                  <div className="text-left">
                    <p className="font-bold font-mono text-sm">{m.name}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">{m.variants.length} variants</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Variant selection */}
          {model && (
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3 animate-slide-up">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Select Variant</h2>
              <div className="grid gap-2">
                {model.variants.map(v => (
                  <button key={v.id}
                    onClick={() => handleSelectVariant(v.id)}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                      selectedVariant === v.id ? "border-primary/40 bg-primary/8" : "border-border/30 hover:bg-secondary/30"
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-xs font-bold font-mono">{v.name}</p>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 transition-colors ${selectedVariant === v.id ? "text-primary" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Flash method */}
          {variant && (
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3 animate-slide-up">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Flash Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleSelectMethod("usb")}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    flashMethod === "usb" ? "border-primary bg-primary/10" : "border-border/30 hover:border-primary/20"
                  }`}
                >
                  <Usb className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-xs font-bold font-mono">USB Direct Flash</p>
                  <p className="text-[9px] text-muted-foreground font-mono mt-1">Flash via USB-JTAG serial</p>
                  <Badge variant="outline" className="text-[8px] mt-2 border-accent/30 text-accent">Recommended</Badge>
                </button>
                <button
                  onClick={() => handleSelectMethod("web")}
                  className="p-4 rounded-xl border-2 border-border/30 hover:border-primary/20 transition-all text-center"
                >
                  <ExternalLink className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs font-bold font-mono">Official Web Flasher</p>
                  <p className="text-[9px] text-muted-foreground font-mono mt-1">Open external flasher</p>
                </button>
                <a href={variant.repo} target="_blank" rel="noopener noreferrer"
                  className="p-4 rounded-xl border-2 border-border/30 hover:border-primary/20 transition-all text-center block"
                >
                  <Download className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs font-bold font-mono">GitHub Releases</p>
                  <p className="text-[9px] text-muted-foreground font-mono mt-1">Download .bin manually</p>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Firmware Selection */}
      {step === "firmware" && variant && (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Download className="h-3.5 w-3.5" /> Select Firmware
              </h2>
              <Button variant="ghost" size="sm" onClick={fetchReleases} disabled={loadingReleases} className="h-7 px-2 text-[10px] font-mono gap-1">
                <RefreshCw className={`h-3 w-3 ${loadingReleases ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            {loadingReleases ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-mono">Fetching releases from GitHub...</span>
              </div>
            ) : releases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                No releases found. Check the repository.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Release selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Release Version</label>
                  <Select value={selectedRelease || ""} onValueChange={(v) => {
                    setSelectedRelease(v);
                    const r = releases.find(r => r.tag === v);
                    if (r && variant) autoSelectAsset(r, variant);
                  }}>
                    <SelectTrigger className="h-9 text-xs font-mono">
                      <SelectValue placeholder="Select release" />
                    </SelectTrigger>
                    <SelectContent>
                      {releases.map(r => (
                        <SelectItem key={r.tag} value={r.tag} className="text-xs font-mono">
                          {r.name} <span className="text-muted-foreground ml-2">({r.date})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Asset selector */}
                {release && release.assets.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Firmware File</label>
                    <Select value={selectedAsset || ""} onValueChange={setSelectedAsset}>
                      <SelectTrigger className="h-9 text-xs font-mono">
                        <SelectValue placeholder="Select firmware file" />
                      </SelectTrigger>
                      <SelectContent>
                        {release.assets.map(a => (
                          <SelectItem key={a.name} value={a.name} className="text-xs font-mono">
                            {a.name} ({formatSize(a.size)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {release && release.assets.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-xs font-mono">
                    No .bin files found in this release. Try a different version.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Risk warning */}
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold font-mono text-warning">⚠ Flashing Warning</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1 leading-relaxed">
                  Flashing incorrect firmware can permanently damage your device. Ensure you've selected the correct miner model and variant.
                  Do not disconnect power or USB during the flash process. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <Checkbox
                id="risk-ack"
                checked={acknowledgedRisk}
                onCheckedChange={(v) => setAcknowledgedRisk(v === true)}
              />
              <label htmlFor="risk-ack" className="text-[10px] font-mono text-muted-foreground cursor-pointer">
                I understand the risks and have selected the correct firmware for my <span className="text-primary font-bold">{variant.name}</span>
              </label>
            </div>
          </div>

          <Button className="w-full h-10 font-mono text-xs gap-2" onClick={handleProceedToConnect} disabled={!selectedAsset || !acknowledgedRisk}>
            <Usb className="h-4 w-4" /> Continue — Connect Device
          </Button>
        </div>
      )}

      {/* Step 3: Connect Device */}
      {step === "connect" && variant && (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Usb className="h-3.5 w-3.5" /> Connect {variant.name} via USB
            </h2>
            
            <div className="rounded-lg bg-secondary/30 p-3 space-y-2">
              <p className="text-[10px] font-mono text-muted-foreground">Instructions:</p>
              <ol className="list-decimal list-inside text-[10px] font-mono text-muted-foreground space-y-1.5 pl-1">
                <li>Connect your {variant.name} to this computer via USB-C / USB-JTAG cable</li>
                <li>If your device has a BOOT button, hold it while connecting</li>
                <li>Click "Connect" and select the serial port from the browser popup</li>
                <li>Common USB chips: <span className="text-primary">CH340</span>, <span className="text-primary">CP2102</span>, <span className="text-primary">FTDI</span></li>
              </ol>
            </div>

            <div className="flex items-center gap-3">
              <Button className="flex-1 h-10 font-mono text-xs gap-2" onClick={connectUSB} disabled={isConnected}>
                {isConnected ? <Check className="h-4 w-4" /> : <Usb className="h-4 w-4" />}
                {isConnected ? "Connected" : "Connect USB Device"}
              </Button>
              {isConnected && (
                <Badge variant="default" className="gap-1 text-[10px] font-mono py-1 px-3">
                  <Radio className="h-3 w-3 animate-pulse" /> Ready
                </Badge>
              )}
            </div>
          </div>

          {/* Selected firmware summary */}
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">Flash Summary</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded-lg bg-secondary/30"><span className="text-muted-foreground">Device:</span> <span className="text-primary font-bold">{variant.name}</span></div>
              <div className="p-2 rounded-lg bg-secondary/30"><span className="text-muted-foreground">Chip:</span> <span className="font-bold">{variant.chip}</span></div>
              <div className="p-2 rounded-lg bg-secondary/30"><span className="text-muted-foreground">Version:</span> <span className="font-bold">{selectedRelease}</span></div>
              <div className="p-2 rounded-lg bg-secondary/30"><span className="text-muted-foreground">File:</span> <span className="font-bold">{selectedAsset}</span></div>
            </div>
          </div>

          <Button className="w-full h-10 font-mono text-xs gap-2 bg-warning text-warning-foreground hover:bg-warning/90" onClick={handleStartFlash} disabled={!isConnected}>
            <Zap className="h-4 w-4" /> Start Flashing
          </Button>
        </div>
      )}

      {/* Step 4: Flashing */}
      {(step === "flash" || step === "done") && (
        <div className="space-y-3 animate-fade-in">
          {/* Progress */}
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {step === "done" ? <Check className="h-3.5 w-3.5 text-accent" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {step === "done" ? "Flash Complete" : "Flashing..."}
              </h2>
              <span className="text-sm font-bold font-mono text-primary">{flashProgress}%</span>
            </div>
            <Progress value={flashProgress} className="h-2" />
            <p className="text-[10px] font-mono text-muted-foreground">{flashStatus}</p>
          </div>

          {/* Terminal */}
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-secondary/30">
              <Terminal className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Console Output</span>
            </div>
            <ScrollArea className="h-48">
              <div ref={terminalRef} className="p-3 space-y-0.5">
                {terminalLogs.map((log, i) => (
                  <p key={i} className={`text-[10px] font-mono leading-relaxed ${
                    log.includes("✓") ? "text-accent" :
                    log.includes("✗") || log.includes("Error") ? "text-destructive" :
                    "text-muted-foreground"
                  }`}>{log}</p>
                ))}
                {isFlashing && <p className="text-[10px] font-mono text-primary animate-pulse">▋</p>}
              </div>
            </ScrollArea>
          </div>

          {step === "done" && (
            <div className="flex gap-3">
              <Button className="flex-1 h-10 font-mono text-xs gap-2" onClick={resetAll}>
                <RefreshCw className="h-4 w-4" /> Flash Another
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
