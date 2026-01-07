import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

// Check if running in Tauri environment
const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window || 
         '__TAURI_INTERNALS__' in window ||
         (window as any).__TAURI_METADATA__ !== undefined;
};

// Get Tauri invoke function
const getTauriInvoke = async () => {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke;
    } catch (error) {
      console.error('Failed to load Tauri invoke:', error);
      return null;
    }
  }
  return null;
};

export interface MinerDevice {
  IP: string;
  name?: string;
  isActive: boolean;
  hashRate?: number;
  temp?: number;
  power?: number;
  voltage?: number;
  uptimeSeconds?: number;
  shares?: {
    accepted: number;
    rejected: number;
  };
  model?: string;
  version?: string;
  bestDiff?: number;
}

export const useNetworkScanner = () => {
  const [devices, setDevices] = useState<MinerDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Warn user if running in browser (Tauri commands won't work)
  useEffect(() => {
    if (!isTauri()) {
      console.warn('⚠️ Running in browser mode - network scanning requires native app');
      console.warn('⚠️ BitAxe devices reject requests from non-private IPs due to CORS security');
    }
  }, []);

  // Get device info using Tauri Rust command (no Origin header)
  const getDeviceInfo = async (ip: string): Promise<MinerDevice> => {
    try {
      const invoke = await getTauriInvoke();
      
      if (!invoke) {
        // Fallback for browser - will fail due to CORS but at least attempts
        console.log(`Attempting browser fetch for ${ip} (will likely fail due to CORS)`);
        const response = await fetch(`http://${ip}/api/system/info`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Request failed');
        const data = await response.json();
        return {
          IP: ip,
          isActive: true,
          name: data.hostname || undefined,
          hashRate: data.hashRate || 0,
          temp: data.temp || 0,
          power: data.power || 0,
          voltage: data.coreVoltageActual || data.coreVoltage || data.voltage || 0,
          uptimeSeconds: data.uptimeSeconds || 0,
          shares: {
            accepted: data.sharesAccepted || 0,
            rejected: data.sharesRejected || 0,
          },
          model: data.ASICModel || 'Unknown',
          version: data.version || 'Unknown',
          bestDiff: data.bestDiff || data.bestSessionDiff || 0,
        };
      }

      // Use Tauri Rust command - makes request without Origin header
      const systemData = await invoke<any>('fetch_miner_info', { ip });
      
      console.log(`✓ Connected to ${ip} via Tauri command`, systemData);

      return {
        IP: ip,
        isActive: true,
        name: systemData.hostname || undefined,
        hashRate: systemData.hashRate || 0,
        temp: systemData.temp || 0,
        power: systemData.power || 0,
        voltage: systemData.coreVoltageActual || systemData.coreVoltage || systemData.voltage || 0,
        uptimeSeconds: systemData.uptimeSeconds || 0,
        shares: {
          accepted: systemData.sharesAccepted || 0,
          rejected: systemData.sharesRejected || 0,
        },
        model: systemData.ASICModel || 'Unknown',
        version: systemData.version || 'Unknown',
        bestDiff: systemData.bestDiff || systemData.bestSessionDiff || 0,
      };
    } catch (error) {
      console.log(`❌ Device ${ip} not responding:`, error);
      return {
        IP: ip,
        isActive: false,
      };
    }
  };

  // Scan network for devices
  const scanNetwork = useCallback(async (baseIP?: string) => {
    setIsScanning(true);

    if (!isTauri()) {
      toast.error('Network scanning requires native app', {
        description: 'BitAxe devices block browser requests due to CORS security. Please use the Android or desktop app.',
        position: 'bottom-right',
      });
      setIsScanning(false);
      return [];
    }
    
    try {
      // Common mDNS .local hostnames for BitAxe/NerdAxe devices
      const mdnsHostnames = [
        'bitaxe.local',
        'nerdaxe.local',
        'bitaxe-01.local',
        'bitaxe-02.local',
        'bitaxe-03.local',
        'nerdaxe-01.local',
        'nerdaxe-02.local',
        'nerdaxe-03.local',
      ];

      // Determine base IP for scanning
      let baseSegment = '192.168.1';
      
      if (baseIP) {
        const ipSegments = baseIP.split('.');
        baseSegment = ipSegments.slice(0, 3).join('.');
      }

      // Common IP addresses for bitaxe devices
      const commonIPs = [
        `${baseSegment}.100`,
        `${baseSegment}.101`,
        `${baseSegment}.102`,
        `${baseSegment}.103`,
        `${baseSegment}.104`,
        `${baseSegment}.105`,
        `${baseSegment}.110`,
        `${baseSegment}.111`,
        `${baseSegment}.112`,
        `${baseSegment}.113`,
        `${baseSegment}.114`,
        `${baseSegment}.115`,
      ];

      // Full range scan (1-254)
      const scanRange = [];
      for (let i = 1; i <= 254; i++) {
        scanRange.push(`${baseSegment}.${i}`);
      }

      // Prioritize: mDNS hostnames first, then common IPs, then full range
      const ipsToScan = [
        ...mdnsHostnames,
        ...commonIPs, 
        ...scanRange.filter(ip => !commonIPs.includes(ip))
      ];

      // Scan in batches
      const batchSize = 20;
      const foundDevices: MinerDevice[] = [];
      
      const scanToastId = toast.loading(`Scanning network... 0%`, {
        description: `Scanning ${baseSegment}.0/24`,
        position: 'bottom-right',
      });

      for (let i = 0; i < ipsToScan.length; i += batchSize) {
        const batch = ipsToScan.slice(i, i + batchSize);
        
        const progress = Math.round((i / ipsToScan.length) * 100);
        toast.loading(`Scanning network... ${progress}%`, {
          id: scanToastId,
          description: `Scanning ${baseSegment}.0/24`,
          position: 'bottom-right',
        });
        
        const batchResults = await Promise.all(
          batch.map(ip => getDeviceInfo(ip))
        );

        const activeDevices = batchResults.filter(device => device.isActive);
        foundDevices.push(...activeDevices);

        if (activeDevices.length > 0) {
          setDevices(prev => {
            const existing = prev.filter(d => !foundDevices.some(f => f.IP === d.IP));
            return [...existing, ...foundDevices];
          });
          toast.success(`Found ${activeDevices.length} device(s)!`, {
            position: 'bottom-right',
          });
        }
      }

      toast.dismiss(scanToastId);

      if (foundDevices.length === 0) {
        toast.warning('No devices found. Try manually adding device IPs.', {
          position: 'bottom-right',
        });
      } else {
        toast.success(`Scan complete! Found ${foundDevices.length} device(s) total`, {
          position: 'bottom-right',
        });
      }

      return foundDevices;
    } catch (error) {
      console.error('Network scan error:', error);
      toast.error('Failed to scan network for devices', {
        position: 'bottom-right',
      });
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Add device manually
  const addDevice = useCallback(async (ip: string) => {
    if (devices.some(device => device.IP === ip)) {
      toast.warning('Device already exists');
      return false;
    }

    const deviceInfo = await getDeviceInfo(ip);
    
    if (deviceInfo.isActive) {
      setDevices(prev => [...prev, deviceInfo]);
      localStorage.setItem('MINER_DEVICES', JSON.stringify([...devices, deviceInfo]));
      toast.success('Device added successfully');
      return true;
    } else {
      setDevices(prev => [...prev, deviceInfo]);
      localStorage.setItem('MINER_DEVICES', JSON.stringify([...devices, deviceInfo]));
      toast.warning('Device added but appears to be offline');
      return false;
    }
  }, [devices]);

  // Remove device
  const removeDevice = useCallback((ip: string) => {
    const updatedDevices = devices.filter(device => device.IP !== ip);
    setDevices(updatedDevices);
    localStorage.setItem('MINER_DEVICES', JSON.stringify(updatedDevices));
    toast.success('Device removed');
  }, [devices]);

  // Update device name
  const updateDeviceName = useCallback((ip: string, name: string) => {
    const updatedDevices = devices.map(device => 
      device.IP === ip ? { ...device, name } : device
    );
    setDevices(updatedDevices);
    localStorage.setItem('MINER_DEVICES', JSON.stringify(updatedDevices));
    toast.success('Device name updated');
  }, [devices]);

  // Restart device using Tauri command
  const restartDevice = useCallback(async (ip: string) => {
    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        await invoke('restart_miner', { ip });
        toast.success('Device restart command sent');
      } else {
        toast.error('Restart requires native app');
      }
    } catch (error) {
      toast.error('Failed to restart device');
    }
  }, []);

  // Refresh device data
  const refreshDevices = useCallback(async () => {
    if (devices.length === 0) return;

    const updatedDevices = await Promise.all(
      devices.map(device => getDeviceInfo(device.IP))
    );

    setDevices(updatedDevices);
    localStorage.setItem('MINER_DEVICES', JSON.stringify(updatedDevices));
  }, [devices]);

  // Load devices from localStorage on init
  useEffect(() => {
    const loadStoredDevices = async () => {
      setIsLoading(true);
      try {
        const stored = localStorage.getItem('MINER_DEVICES');
        if (stored) {
          const storedDevices = JSON.parse(stored);
          const refreshedDevices = await Promise.all(
            storedDevices.map((device: MinerDevice) => getDeviceInfo(device.IP))
          );
          setDevices(refreshedDevices);
        } else if (isTauri()) {
          await scanNetwork();
        }
      } catch (error) {
        console.error('Error loading devices:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredDevices();
  }, [scanNetwork]);

  // Auto-refresh devices every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (devices.length > 0) {
        refreshDevices();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshDevices, devices.length]);

  // Calculate totals
  const totalHashRate = devices.reduce((total, device) => {
    return total + (device.isActive ? (device.hashRate || 0) : 0);
  }, 0);

  const totalPower = devices.reduce((total, device) => {
    return total + (device.isActive ? (device.power || 0) : 0);
  }, 0);

  const activeDevices = devices.filter(device => device.isActive);

  const totalEfficiency = totalHashRate > 0 ? (totalPower / (totalHashRate / 1000)) : 0;

  return {
    devices,
    isLoading,
    isScanning,
    scanNetwork,
    addDevice,
    removeDevice,
    restartDevice,
    refreshDevices,
    updateDeviceName,
    totalHashRate,
    totalPower,
    activeDevices: activeDevices.length,
    totalDevices: devices.length,
    totalEfficiency,
  };
};
