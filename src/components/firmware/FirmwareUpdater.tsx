import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNetworkScanner } from "@/hooks/useNetworkScanner";
import { useFirmwareUpdater } from "@/hooks/useFirmwareUpdater";
import { Download, Zap, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FirmwareRelease {
  version: string;
  name: string;
  body: string;
  downloadUrl: string;
  htmlUrl: string;
}

interface FirmwareUpdaterProps {
  model: 'bitaxe' | 'nerdaxe';
  onClose: () => void;
}

export function FirmwareUpdater({ model, onClose }: FirmwareUpdaterProps) {
  const { devices } = useNetworkScanner();
  const { updating, updateFirmware, checkForUpdates } = useFirmwareUpdater();
  const [selectedMiners, setSelectedMiners] = useState<string[]>([]);
  const [latestRelease, setLatestRelease] = useState<FirmwareRelease | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);

  const modelMiners = devices.filter(d => d.model?.toLowerCase().includes(model.toLowerCase()));

  useEffect(() => {
    loadLatestFirmware();
  }, [model]);

  const loadLatestFirmware = async () => {
    try {
      const updates = await checkForUpdates();
      setLatestRelease(updates[model] || null);
    } catch (error) {
      toast.error("Failed to check for firmware updates");
    }
  };

  const handleMinerSelect = (minerId: string, checked: boolean) => {
    if (checked) {
      setSelectedMiners([...selectedMiners, minerId]);
    } else {
      setSelectedMiners(selectedMiners.filter(id => id !== minerId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMiners(modelMiners.map(m => m.IP));
    } else {
      setSelectedMiners([]);
    }
  };

  const handleUpdateFirmware = async () => {
    if (!latestRelease || selectedMiners.length === 0) return;

    const minersToUpdate = modelMiners.filter(m => selectedMiners.includes(m.IP));
    
    try {
      setProgress(0);
      setResults([]);

      // Convert network devices to the format expected by firmware updater
      const formattedMiners = minersToUpdate.map(device => ({
        id: device.IP,
        name: device.IP,
        ip_address: device.IP,
        model: model
      }));

      const updateResults = await updateFirmware(
        formattedMiners,
        latestRelease.downloadUrl,
        model
      );

      setResults(updateResults);
      
      // Simulate progress
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 10;
        setProgress(currentProgress);
        if (currentProgress >= 100) {
          clearInterval(interval);
        }
      }, 1000);

    } catch (error) {
      console.error('Firmware update failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-8 lg:inset-16">
        <Card className="h-full overflow-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  {model === 'bitaxe' ? 'Bitaxe' : 'NerdAxe'} Firmware Updater
                </CardTitle>
                <CardDescription>
                  Update firmware on multiple miners simultaneously
                </CardDescription>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Latest Firmware Info */}
            {latestRelease && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Latest Firmware Release</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold">{latestRelease.version}</h4>
                      <p className="text-sm text-muted-foreground">{latestRelease.name}</p>
                    </div>
                    <Badge variant="secondary">
                      <Download className="h-3 w-3 mr-1" />
                      Latest
                    </Badge>
                  </div>
                  
                  {latestRelease.body && (
                    <div className="text-sm">
                      <p className="font-medium mb-2">Release Notes:</p>
                      <div className="bg-muted/50 p-3 rounded-md max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-xs">{latestRelease.body}</pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Miner Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Select Miners to Update</CardTitle>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedMiners.length === modelMiners.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm">Select All</label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {modelMiners.length === 0 ? (
                  <p className="text-muted-foreground">No {model} miners found</p>
                ) : (
                  <div className="space-y-3">
                    {modelMiners.map((miner) => (
                      <div key={miner.IP} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={miner.IP}
                            checked={selectedMiners.includes(miner.IP)}
                            onCheckedChange={(checked) => handleMinerSelect(miner.IP, checked as boolean)}
                          />
                          <div>
                            <label htmlFor={miner.IP} className="font-medium cursor-pointer">
                              {miner.IP}
                            </label>
                            <p className="text-sm text-muted-foreground">{miner.IP}</p>
                            {miner.version && (
                              <p className="text-xs text-muted-foreground">
                                Current: {miner.version}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant={miner.isActive ? 'default' : 'destructive'}
                        >
                          {miner.isActive ? 'online' : 'offline'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Update Progress */}
            {updating && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Update Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={progress} className="mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Updating firmware on {selectedMiners.length} miner(s)...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Update Results */}
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Update Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{result.miner}</p>
                          <p className="text-sm text-muted-foreground">{result.ipAddress}</p>
                          <p className="text-sm">
                            {result.success ? result.message : result.error}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Firmware updates will temporarily interrupt mining operations. 
                Ensure all selected miners are accessible before proceeding. The update process may take several minutes per miner.
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleUpdateFirmware}
                disabled={!latestRelease || selectedMiners.length === 0 || updating}
                className="flex-1"
              >
                <Zap className="h-4 w-4 mr-2" />
                Update {selectedMiners.length} Miner(s)
              </Button>
              
              <Button
                variant="outline"
                onClick={loadLatestFirmware}
                disabled={updating}
              >
                <Download className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}