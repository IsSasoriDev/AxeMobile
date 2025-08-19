import { useState } from "react";
import { ExternalLink, RotateCw, Trash2, Activity, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Miner } from "@/hooks/useMinerStorage";

interface MinerCardProps {
  miner: Miner;
  onStatusCheck: (miner: Miner) => void;
  onDelete: (id: string) => void;
  onOpenWebView: (miner: Miner) => void;
}

export function MinerCard({ miner, onStatusCheck, onDelete, onOpenWebView }: MinerCardProps) {
  const getStatusIcon = () => {
    switch (miner.status) {
      case "online":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "offline":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "checking":
        return <RotateCw className="h-4 w-4 animate-spin text-warning" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = () => {
    switch (miner.status) {
      case "online":
        return "default";
      case "offline":
        return "destructive";
      case "checking":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className="shadow-card hover:shadow-glow transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{miner.name}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(miner.id)}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">IP Address:</span>
          <code className="bg-muted px-2 py-1 rounded text-sm">{miner.ipAddress}</code>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={getStatusVariant()} className="gap-1">
            {getStatusIcon()}
            {miner.status}
          </Badge>
        </div>
        
        {miner.lastChecked && (
          <div className="text-xs text-muted-foreground">
            Last checked: {miner.lastChecked.toLocaleTimeString()}
          </div>
        )}
        
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusCheck(miner)}
            disabled={miner.status === "checking"}
            className="flex-1"
          >
            <RotateCw className={`h-4 w-4 mr-2 ${miner.status === "checking" ? "animate-spin" : ""}`} />
            Check Status
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenWebView(miner)}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}