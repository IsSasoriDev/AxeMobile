import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Copy, Download, Pause, Play, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { clearLogs, subscribeLogs, type LogEntry, type LogLevel } from "@/lib/logger";

const LEVEL_STYLES: Record<LogLevel, string> = {
  error: "text-destructive",
  warn: "text-yellow-400",
  info: "text-primary",
  log: "text-foreground/80",
  debug: "text-muted-foreground",
};

const LEVELS: LogLevel[] = ["error", "warn", "info", "log", "debug"];

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
};

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(new Set(LEVELS));
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedSnapshot = useRef<LogEntry[] | null>(null);

  useEffect(() => {
    const unsub = subscribeLogs((next) => {
      if (paused) return;
      setLogs(next);
    });
    return () => { unsub(); };
  }, [paused]);

  useEffect(() => {
    if (!autoScroll || paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll, paused]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return logs.filter((l) => enabledLevels.has(l.level) && (!q || l.message.toLowerCase().includes(q)));
  }, [logs, filter, enabledLevels]);

  const toggleLevel = (lvl: LogLevel) => {
    setEnabledLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl); else next.add(lvl);
      return next;
    });
  };

  const handleCopy = async () => {
    const text = filtered.map((l) => `[${fmtTime(l.ts)}] ${l.level.toUpperCase()} ${l.message}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${filtered.length} log lines`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleDownload = () => {
    const text = filtered.map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()} ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axemobile-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, log: 0, debug: 0 };
    logs.forEach((l) => { c[l.level]++; });
    return c;
  }, [logs]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => toggleLevel(lvl)}
            className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-all ${
              enabledLevels.has(lvl)
                ? `${LEVEL_STYLES[lvl]} border-current/40 bg-current/10`
                : "text-muted-foreground/50 border-border/30"
            }`}
          >
            {lvl} {counts[lvl] > 0 && <span className="ml-1 opacity-60">{counts[lvl]}</span>}
          </button>
        ))}
        <div className="flex-1 min-w-[120px]">
          <Input
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 text-[10px] font-mono"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1" onClick={() => setAutoScroll((s) => !s)}>
          <ScrollText className="h-3 w-3" /> Auto-scroll: {autoScroll ? "on" : "off"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1" onClick={handleCopy}>
          <Copy className="h-3 w-3" /> Copy
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1" onClick={handleDownload}>
          <Download className="h-3 w-3" /> Save
        </Button>
        <Button size="sm" variant="destructive" className="h-7 text-[10px] font-mono gap-1 ml-auto" onClick={clearLogs}>
          <Trash2 className="h-3 w-3" /> Clear
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="h-72 overflow-y-auto rounded-lg border border-border/40 bg-background/60 p-2 font-mono text-[10px] leading-relaxed"
      >
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">No log entries</div>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="flex gap-2 py-0.5 border-b border-border/10 last:border-0">
              <span className="text-muted-foreground/60 shrink-0">{fmtTime(l.ts)}</span>
              <span className={`shrink-0 uppercase font-bold w-10 ${LEVEL_STYLES[l.level]}`}>{l.level}</span>
              <span className={`whitespace-pre-wrap break-all ${LEVEL_STYLES[l.level]}`}>{l.message}</span>
            </div>
          ))
        )}
      </div>

      <p className="text-[9px] text-muted-foreground font-mono">
        Live in-app logs (max 500 entries). Useful for diagnosing issues like miner connection errors or white screens.
      </p>
    </div>
  );
}
