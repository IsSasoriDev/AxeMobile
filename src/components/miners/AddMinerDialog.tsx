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
import { Miner } from "@/hooks/useMinerStorage";

interface AddMinerDialogProps {
  onAddMiner: (miner: Omit<Miner, "id">) => void;
}

export function AddMinerDialog({ onAddMiner }: AddMinerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name.trim() && ipAddress.trim()) {
      onAddMiner({
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        status: "offline",
      });
      
      setName("");
      setIpAddress("");
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
            Enter your miner's details to add it to your dashboard.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Miner Name</Label>
            <Input
              id="name"
              placeholder="e.g., BitAxe Pro #1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ip">IP Address</Label>
            <Input
              id="ip"
              placeholder="e.g., 192.168.1.100"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
              title="Please enter a valid IP address"
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