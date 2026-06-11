import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, Trash2, Ban, Save, ShieldOff, Plus } from "lucide-react";

interface Entry {
  id: string; username: string; miner_name: string;
  best_difficulty: number; time_to_find_seconds: number; achieved_at: string;
}
interface BanRow { id: string; username: string; reason: string | null; created_at: string; }

const formatDiff = (d: number) => {
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)}T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)}G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)}M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(2)}K`;
  return d.toString();
};

export function LeaderboardAdmin() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [editing, setEditing] = useState<Record<string, Partial<Entry>>>({});
  const [banUser, setBanUser] = useState("");
  const [banReason, setBanReason] = useState("");

  const fetchAll = async () => {
    const [{ data: e }, { data: b }] = await Promise.all([
      supabase.from("leaderboard_entries" as any).select("*").order("best_difficulty", { ascending: false }),
      supabase.from("leaderboard_bans" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setEntries((e as unknown as Entry[]) || []);
    setBans((b as unknown as BanRow[]) || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateEntry = async (id: string) => {
    const patch = editing[id];
    if (!patch) return;
    const { error } = await supabase.from("leaderboard_entries" as any).update(patch as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); setEditing(p => { const n = { ...p }; delete n[id]; return n; }); fetchAll(); }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("leaderboard_entries" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchAll(); }
  };

  const addBan = async () => {
    const u = banUser.trim();
    if (!u) return;
    const { error } = await supabase.from("leaderboard_bans" as any).insert({ username: u, reason: banReason.trim() || null } as any);
    if (error) toast.error(error.message); else { toast.success(`Banned ${u}`); setBanUser(""); setBanReason(""); fetchAll(); }
  };

  const removeBan = async (id: string) => {
    const { error } = await supabase.from("leaderboard_bans" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Unbanned"); fetchAll(); }
  };

  const banFromEntry = async (uname: string) => {
    if (!confirm(`Ban "${uname}"?`)) return;
    const { error } = await supabase.from("leaderboard_bans" as any).insert({ username: uname } as any);
    if (error) toast.error(error.message); else { toast.success(`Banned ${uname}`); fetchAll(); }
  };

  const setEdit = (id: string, key: keyof Entry, val: any) =>
    setEditing(p => ({ ...p, [id]: { ...p[id], [key]: val } }));

  return (
    <div className="space-y-4">
      {/* Bans */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Ban className="h-3.5 w-3.5 text-destructive" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Banned Users ({bans.length})</h2>
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Username</Label>
            <Input value={banUser} onChange={e => setBanUser(e.target.value)} placeholder="username" className="h-8 text-xs font-mono mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Reason (opt.)</Label>
            <Input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="cheating..." className="h-8 text-xs font-mono mt-1" />
          </div>
          <Button onClick={addBan} className="h-8 text-xs font-mono gap-1.5"><Plus className="h-3 w-3" />Ban</Button>
        </div>
        {bans.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {bans.map(b => (
              <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs font-mono">
                <Ban className="h-3 w-3 text-destructive shrink-0" />
                <span className="font-bold flex-1 truncate">{b.username}</span>
                {b.reason && <span className="text-muted-foreground text-[10px] truncate">{b.reason}</span>}
                <button onClick={() => removeBan(b.id)} className="p-1 rounded hover:bg-secondary/40" title="Unban">
                  <ShieldOff className="h-3 w-3 text-accent" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entries */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-warning" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Entries ({entries.length})</h2>
        </div>
        {entries.length === 0 ? (
          <p className="text-[11px] font-mono text-muted-foreground text-center py-4">No entries yet</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map(e => {
              const ed = editing[e.id] || {};
              const dirty = Object.keys(ed).length > 0;
              return (
                <div key={e.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_120px_auto] gap-2 items-center p-2 rounded-lg border border-border/20 bg-secondary/10">
                  <Input
                    defaultValue={e.username}
                    onChange={ev => setEdit(e.id, "username", ev.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                  <Input
                    defaultValue={e.miner_name}
                    onChange={ev => setEdit(e.id, "miner_name", ev.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                  <Input
                    type="number"
                    defaultValue={e.best_difficulty}
                    onChange={ev => setEdit(e.id, "best_difficulty", Number(ev.target.value))}
                    className="h-7 text-xs font-mono"
                    title={`Currently: ${formatDiff(e.best_difficulty)}`}
                  />
                  <Input
                    type="number"
                    defaultValue={e.time_to_find_seconds}
                    onChange={ev => setEdit(e.id, "time_to_find_seconds", Number(ev.target.value))}
                    className="h-7 text-xs font-mono"
                    title="Seconds"
                  />
                  <div className="flex items-center gap-1 justify-end">
                    {dirty && (
                      <button onClick={() => updateEntry(e.id)} className="p-1.5 rounded hover:bg-primary/10" title="Save">
                        <Save className="h-3 w-3 text-primary" />
                      </button>
                    )}
                    <button onClick={() => banFromEntry(e.username)} className="p-1.5 rounded hover:bg-destructive/10" title="Ban user">
                      <Ban className="h-3 w-3 text-destructive" />
                    </button>
                    <button onClick={() => deleteEntry(e.id)} className="p-1.5 rounded hover:bg-destructive/10" title="Delete">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
