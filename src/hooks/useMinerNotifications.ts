import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { MinerDevice } from './useNetworkScanner';

// Sound generation using Web Audio API
const playNotificationSound = (type: 'block' | 'warning') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (type === 'block') {
      // Victory/celebration sound for block found - ascending triumphant chime
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
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
      
      // Add a shimmer effect
      setTimeout(() => {
        const shimmerOsc = audioContext.createOscillator();
        const shimmerGain = audioContext.createGain();
        shimmerOsc.connect(shimmerGain);
        shimmerGain.connect(audioContext.destination);
        shimmerOsc.type = 'triangle';
        shimmerOsc.frequency.setValueAtTime(2093, audioContext.currentTime);
        shimmerGain.gain.setValueAtTime(0.15, audioContext.currentTime);
        shimmerGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        shimmerOsc.start();
        shimmerOsc.stop(audioContext.currentTime + 0.5);
      }, 600);
    } else {
      // Warning sound - urgent descending alert
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
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + 0.35);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};

// Check if running in Capacitor environment
const isCapacitor = () => {
  return typeof (window as any).Capacitor !== 'undefined';
};

// Check if running in Tauri environment
const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window || 
         '__TAURI_INTERNALS__' in window ||
         (window as any).__TAURI_METADATA__ !== undefined;
};

interface NotificationSettings {
  blockFoundEnabled: boolean;
  tempWarningEnabled: boolean;
  tempThreshold: number; // Default 70°C
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  blockFoundEnabled: true,
  tempWarningEnabled: true,
  tempThreshold: 70,
  soundEnabled: true,
};

export const useMinerNotifications = (devices: MinerDevice[]) => {
  const previousBestDiffs = useRef<Map<string, number>>(new Map());
  const tempWarningCooldown = useRef<Map<string, number>>(new Map());
  const settingsRef = useRef<NotificationSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('NOTIFICATION_SETTINGS');
    if (stored) {
      try {
        settingsRef.current = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse notification settings:', e);
      }
    }
  }, []);

  const saveSettings = useCallback((settings: NotificationSettings) => {
    settingsRef.current = settings;
    localStorage.setItem('NOTIFICATION_SETTINGS', JSON.stringify(settings));
  }, []);

  const requestPermission = useCallback(async () => {
    // For Capacitor (Android)
    if (isCapacitor()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      } catch (error) {
        console.error('Failed to request Capacitor notification permissions:', error);
        return false;
      }
    }

    // For Tauri desktop
    if (isTauri()) {
      try {
        const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        return permissionGranted;
      } catch (error) {
        console.error('Failed to request Tauri notification permissions:', error);
        return false;
      }
    }

    // For browser
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const sendNotification = useCallback(async (title: string, body: string, isUrgent = false) => {
    // For Capacitor (Android)
    if (isCapacitor()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 100) },
              sound: isUrgent ? 'notification.wav' : undefined,
              extra: { isUrgent },
            },
          ],
        });
        return true;
      } catch (error) {
        console.error('Failed to send Capacitor notification:', error);
        toast.info(title, { description: body });
        return false;
      }
    }

    // For Tauri desktop
    if (isTauri()) {
      try {
        const { sendNotification: tauriNotify } = await import('@tauri-apps/plugin-notification');
        tauriNotify({ title, body });
        return true;
      } catch (error) {
        console.error('Failed to send Tauri notification:', error);
        toast.info(title, { description: body });
        return false;
      }
    }

    // For browser
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
      return true;
    }

    // Fallback to toast
    toast.info(title, { description: body });
    return false;
  }, []);

  // Check for block found (significant increase in bestDiff)
  const checkBlockFound = useCallback((device: MinerDevice) => {
    if (!settingsRef.current.blockFoundEnabled || !device.isActive) return;

    const previousBestDiff = previousBestDiffs.current.get(device.IP) || 0;
    const currentBestDiff = device.bestDiff || 0;

    // If bestDiff increased significantly (potential block found)
    if (currentBestDiff > previousBestDiff && previousBestDiff > 0) {
      const increase = currentBestDiff - previousBestDiff;
      // Only notify for significant increases (e.g., > 1 billion difficulty)
      if (increase > 1000000000) {
        // Play celebration sound if enabled
        if (settingsRef.current.soundEnabled) {
          playNotificationSound('block');
        }
        sendNotification(
          '🎉 Block Found!',
          `${device.name || device.IP} found a new best difficulty: ${formatDiff(currentBestDiff)}`,
          true
        );
      }
    }

    previousBestDiffs.current.set(device.IP, currentBestDiff);
  }, [sendNotification]);

  // Check for temperature warning
  const checkTempWarning = useCallback((device: MinerDevice) => {
    if (!settingsRef.current.tempWarningEnabled || !device.isActive) return;

    const temp = device.temp || 0;
    const threshold = settingsRef.current.tempThreshold;

    if (temp >= threshold) {
      const lastWarning = tempWarningCooldown.current.get(device.IP) || 0;
      const now = Date.now();
      
      // Only warn once every 5 minutes per device
      if (now - lastWarning > 5 * 60 * 1000) {
        // Play warning sound if enabled
        if (settingsRef.current.soundEnabled) {
          playNotificationSound('warning');
        }
        sendNotification(
          '🌡️ Temperature Warning!',
          `${device.name || device.IP} is running hot at ${temp}°C (threshold: ${threshold}°C)`,
          true
        );
        tempWarningCooldown.current.set(device.IP, now);
      }
    }
  }, [sendNotification]);

  // Monitor devices for notifications
  useEffect(() => {
    devices.forEach(device => {
      checkBlockFound(device);
      checkTempWarning(device);
    });
  }, [devices, checkBlockFound, checkTempWarning]);

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return {
    settings: settingsRef.current,
    saveSettings,
    requestPermission,
    sendNotification,
  };
};

// Helper function to format difficulty
function formatDiff(diff: number): string {
  if (diff >= 1e12) return `${(diff / 1e12).toFixed(2)}T`;
  if (diff >= 1e9) return `${(diff / 1e9).toFixed(2)}B`;
  if (diff >= 1e6) return `${(diff / 1e6).toFixed(2)}M`;
  if (diff >= 1e3) return `${(diff / 1e3).toFixed(2)}K`;
  return diff.toString();
}
