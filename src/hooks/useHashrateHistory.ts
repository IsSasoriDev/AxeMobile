import { useEffect, useRef, useState } from 'react';

interface Sample {
  t: number; // epoch ms
  h: number; // total hashrate (GH/s)
  p: number; // total power (W)
}

const KEY = 'HASHRATE_HISTORY';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const SAMPLE_INTERVAL_MS = 30_000; // sample at most every 30s

const loadSamples = (): Sample[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Sample[];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter((s) => s.t >= cutoff);
  } catch {
    return [];
  }
};

const avgInWindow = (samples: Sample[], windowMs: number, key: 'h' | 'p') => {
  const cutoff = Date.now() - windowMs;
  const sub = samples.filter((s) => s.t >= cutoff);
  if (sub.length === 0) return null;
  return sub.reduce((a, s) => a + s[key], 0) / sub.length;
};

export const useHashrateHistory = (totalHashRate: number, totalPower: number) => {
  const [samples, setSamples] = useState<Sample[]>(() => loadSamples());
  const lastSampleRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return;
    lastSampleRef.current = now;
    setSamples((prev) => {
      const cutoff = now - MAX_AGE_MS;
      const next = [...prev.filter((s) => s.t >= cutoff), { t: now, h: totalHashRate, p: totalPower }];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [totalHashRate, totalPower]);

  return {
    avg10m: avgInWindow(samples, 10 * 60 * 1000, 'h'),
    avg1h: avgInWindow(samples, 60 * 60 * 1000, 'h'),
    avg24h: avgInWindow(samples, 24 * 60 * 60 * 1000, 'h'),
    avgPower10m: avgInWindow(samples, 10 * 60 * 1000, 'p'),
    sampleCount: samples.length,
  };
};
