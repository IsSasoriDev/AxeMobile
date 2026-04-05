import { useEffect, useRef } from "react";
import type { MinerDevice } from "./useNetworkScanner";

const isTauri = () =>
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

export function useTrayStats(
  activeDevices: number,
  totalDevices: number,
  totalHashRate: number,
  totalPower: number,
  devices: MinerDevice[] = []
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    const update = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const statsText = totalDevices === 0
          ? "AxeMobile\nNo miners connected"
          : `AxeMobile\n⛏ ${activeDevices}/${totalDevices} Active\n⚡ ${totalHashRate.toFixed(2)} GH/s\n🔌 ${totalPower.toFixed(0)}W`;

        const miners = devices.map((d) => ({
          ip: d.IP,
          name: d.name || d.IP,
          hashRate: d.hashRate ?? 0,
          temp: d.temp ?? 0,
          power: d.power ?? 0,
          isActive: d.isActive,
        }));

        await invoke("update_tray_stats", { statsText, miners });
      } catch {
        // Not in Tauri
      }
    };

    update();
    intervalRef.current = setInterval(update, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeDevices, totalDevices, totalHashRate, totalPower, devices]);
}
