import { useState } from "react";
import { ExternalLink, RotateCcw, Trash2, Activity, AlertCircle, CheckCircle, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MinerDevice } from "@/hooks/useNetworkScanner";
import { toast } from "sonner";

interface MinerCardProps {
  miner: MinerDevice;
  onStatusCheck: (miner: MinerDevice) => void;
  onDelete: (ip: string) => void;
  onOpenWebView: (miner: MinerDevice) => void;
  onUpdateName: (ip: string, name: string) => void;
}

export function MinerCard({ miner, onStatusCheck, onDelete, onOpenWebView, onUpdateName }: MinerCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState(miner.name || '');

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(miner.IP, editName.trim());
      setEditDialogOpen(false);
    } else {
      toast.error('Device name cannot be empty');
    }
  };

  const getStatusIcon = () => {
    if (miner.isActive) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusVariant = () => {
    return miner.isActive ? "default" : "destructive";
  };

  return (
    <Card className="group relative overflow-hidden shadow-card hover:shadow-glow transition-all duration-500 border-primary/20 hover:border-primary/40">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-black bg-gradient-primary bg-clip-text text-transparent group-hover:scale-105 transition-transform"
                       style={{ textShadow: '0 0 20px hsl(var(--primary) / 0.2)' }}>
              {miner.name || miner.IP}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditName(miner.name || '');
                setEditDialogOpen(true);
              }}
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-primary/10"
            >
              <Pencil className="h-3.5 w-3.5 text-primary" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(miner.IP)}
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/20 hover:scale-110 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">IP Address</span>
            <code className="bg-background/80 px-3 py-1.5 rounded-md text-sm font-mono font-bold">{miner.IP}</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Model</span>
            <span className="text-sm font-bold">{miner.model || 'Unknown'}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <Badge variant={getStatusVariant()} className="gap-1.5 px-3 py-1">
              {getStatusIcon()}
              <span className="font-bold">{miner.isActive ? 'Online' : 'Offline'}</span>
            </Badge>
          </div>

          {miner.hashRate && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 transition-all duration-300 hover:scale-[1.02] border border-primary/20">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-muted-foreground uppercase tracking-wide">Hashrate</span>
              </span>
              <span className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent"
                    style={{ textShadow: '0 0 15px hsl(var(--primary) / 0.3)' }}>
                {miner.hashRate.toFixed(2)}<span className="text-xs ml-1">GH/s</span>
              </span>
            </div>
          )}

          {miner.temp && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-muted/50 to-transparent hover:from-muted hover:to-muted/50 transition-all duration-300 hover:scale-[1.02]">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Temperature</span>
              <span className={`text-lg font-black ${
                miner.temp > 70 ? 'text-destructive animate-pulse' : 
                miner.temp > 60 ? 'text-warning animate-pulse' : 'text-success'
              }`}>
                {miner.temp}<span className="text-sm ml-0.5">°C</span>
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusCheck(miner)}
            className="flex-1 hover:scale-105 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300 font-semibold"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenWebView(miner)}
            className="flex-1 hover:scale-105 transition-all duration-300 font-semibold shadow-glow"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </Button>
        </div>
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Miner Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Miner Name
              </label>
              <Input
                placeholder="Enter miner name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveName}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}