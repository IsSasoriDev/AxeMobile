import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

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
}

export const useNetworkScanner = () => {
  const [devices, setDevices] = useState<MinerDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Get device info from API (supports BitAxe and NerdAxe endpoints)
  const getDeviceInfo = async (ip: string): Promise<MinerDevice> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${ip}/api/system/info`, {
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Parse data from NerdAxe or BitAxe format
      // NerdAxe uses similar API structure to BitAxe
      return {
        IP: ip,
        isActive: true,
        hashRate: data.hashRate || data.hashRate_10m || data.hashrate || data.hr || 0,
        temp: data.temp || data.asicTemp || data.temperature || data.temp1 || data.temp2 || 0,
        power: data.power || data.powerConsumption || data.wattage || 0,
        voltage: data.voltage || data.coreVoltage || data.coreVoltageActual || data.vrTemp || 0,
        uptimeSeconds: data.uptimeSeconds || data.uptime || data.uptimeSecs || 0,
        shares: {
          accepted: data.sharesAccepted || data.shares?.accepted || data.bestDiff || 0,
          rejected: data.sharesRejected || data.shares?.rejected || data.rejected || 0,
        },
        model: data.deviceModel || data.ASICModel || data.model || data.version || 'Unknown',
        version: data.version || data.firmwareVersion || 'Unknown',
      };
    } catch (error) {
      return {
        IP: ip,
        isActive: false,
      };
    }
  };

  // Scan network for devices
  const scanNetwork = useCallback(async (baseIP?: string) => {
    setIsScanning(true);
    
    try {
      // Determine base IP for scanning
      let baseSegment = '192.168.1'; // Default to common router IP range
      
      if (baseIP) {
        // Use provided base IP
        const ipSegments = baseIP.split('.');
        baseSegment = ipSegments.slice(0, 3).join('.');
      } else {
        // Try to detect local IP from hostname
        const hostname = window.location.hostname;
        // Check if hostname is a valid local IP address (not a domain)
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipRegex.test(hostname)) {
          const ipSegments = hostname.split('.');
          baseSegment = ipSegments.slice(0, 3).join('.');
        }
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

      // Prioritize common IPs first, then scan full range
      const ipsToScan = [...commonIPs, ...scanRange.filter(ip => !commonIPs.includes(ip))];

      // Scan in batches to avoid overwhelming the network
      const batchSize = 20;
      const foundDevices: MinerDevice[] = [];
      
      // Create a loading toast that we'll update
      const scanToastId = toast.loading(`Scanning ${baseSegment}.0/24...`, {
        description: `Checking IP: ${ipsToScan[0]}`,
        position: 'bottom-right',
      });

      for (let i = 0; i < ipsToScan.length; i += batchSize) {
        const batch = ipsToScan.slice(i, i + batchSize);
        
        // Update toast with current IPs being scanned
        const currentIPs = batch.join(', ');
        const progress = Math.round((i / ipsToScan.length) * 100);
        toast.loading(`Scanning ${baseSegment}.0/24... (${progress}%)`, {
          id: scanToastId,
          description: `Checking: ${currentIPs}`,
          position: 'bottom-right',
        });
        
        const batchResults = await Promise.all(
          batch.map(ip => getDeviceInfo(ip))
        );

        const activeDevices = batchResults.filter(device => device.isActive);
        foundDevices.push(...activeDevices);

        // Update state with found devices so far
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

      // Dismiss the loading toast
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
      // Still add inactive devices to show they were attempted
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

  // Restart device
  const restartDevice = useCallback(async (ip: string) => {
    try {
      await fetch(`http://${ip}/api/system/restart`, {
        method: 'POST',
        mode: 'cors',
      });
      toast.success('Device restart command sent');
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
          // Refresh stored devices data
          const refreshedDevices = await Promise.all(
            storedDevices.map((device: MinerDevice) => getDeviceInfo(device.IP))
          );
          setDevices(refreshedDevices);
        } else {
          // No stored devices, perform initial scan
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