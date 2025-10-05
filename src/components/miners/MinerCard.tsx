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
    <Card className="shadow-card hover:shadow-glow hover:scale-[1.02] transition-all duration-300 group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">{miner.name || miner.IP}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditName(miner.name || '');
                setEditDialogOpen(true);
              }}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(miner.IP)}
            className="text-destructive hover:bg-destructive/10 hover:scale-110 transition-transform"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">IP Address:</span>
          <code className="bg-muted px-2 py-1 rounded text-sm">{miner.IP}</code>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Model:</span>
          <span className="text-sm">{miner.model || 'Unknown'}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={getStatusVariant()} className="gap-1">
            {getStatusIcon()}
            {miner.isActive ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {miner.hashRate && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Hashrate:</span>
            <span className="text-sm font-mono">{miner.hashRate.toFixed(2)} GH/s</span>
          </div>
        )}

        {miner.temp && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Temperature:</span>
            <span className={`text-sm font-mono ${
              miner.temp > 70 ? 'text-destructive' : 
              miner.temp > 60 ? 'text-yellow-500' : ''
            }`}>
              {miner.temp}°C
            </span>
          </div>
        )}
        
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusCheck(miner)}
            className="flex-1 hover:scale-105 transition-transform"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenWebView(miner)}
            className="flex-1 hover:scale-105 transition-transform"
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