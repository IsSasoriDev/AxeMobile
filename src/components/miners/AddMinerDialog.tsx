import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddMinerDialogProps {
  onAddMiner: (miner: { name: string; ipAddress: string; model: 'bitaxe' | 'nerdaxe' | 'avalon' }) => void;
}

const MODEL_LABELS: Record<string, string> = {
  bitaxe: 'BitAxe',
  nerdaxe: 'NerdAxe',
  avalon: 'Avalon Nano',
};

export function AddMinerDialog({ onAddMiner }: AddMinerDialogProps) {
  const [open, setOpen] = useState(false);
  const [ipAddress, setIpAddress] = useState("");
  const [model, setModel] = useState<'bitaxe' | 'nerdaxe' | 'avalon'>('bitaxe');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (ipAddress.trim()) {
      onAddMiner({
        name: `${MODEL_LABELS[model]} - ${ipAddress.trim()}`,
        ipAddress: ipAddress.trim(),
        model,
      });
      
      setIpAddress("");
      setModel('bitaxe');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4" />
          Add Miner
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Miner</DialogTitle>
          <DialogDescription>
            Select your miner type and enter its IP address.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model">Miner Type</Label>
            <Select value={model} onValueChange={(value: 'bitaxe' | 'nerdaxe' | 'avalon') => setModel(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bitaxe">BitAxe</SelectItem>
                <SelectItem value="nerdaxe">NerdAxe</SelectItem>
                <SelectItem value="avalon">Avalon Nano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ipAddress">IP Address</Label>
            <Input
              id="ipAddress"
              placeholder="e.g., 192.168.1.100"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              required
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Miner
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
