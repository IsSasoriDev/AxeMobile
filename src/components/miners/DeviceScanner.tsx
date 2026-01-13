import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Plus, RefreshCw, Trash2, RotateCcw, Thermometer, Zap, TrendingUp, Activity, Network, Trophy } from 'lucide-react';
import { useNetworkScanner } from '@/hooks/useNetworkScanner';
import { toast } from 'sonner';

export const DeviceScanner = () => {
  const {
    devices,
    isLoading,
    isScanning,
    scanNetwork,
    addDevice,
    removeDevice,
    restartDevice,
    refreshDevices,
    totalHashRate,
    totalPower,
    activeDevices,
    totalDevices,
    totalEfficiency,
  } = useNetworkScanner();

  const [newDeviceIP, setNewDeviceIP] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [scanRange, setScanRange] = useState('192.168.1');

  const validateIP = (ip: string) => {
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
    return ipRegex.test(ip);
  };

  const handleAddDevice = async () => {
    if (!validateIP(newDeviceIP)) {
      toast.error('Please enter a valid IP address');
      return;
    }

    const success = await addDevice(newDeviceIP);
    if (success) {
      setNewDeviceIP('');
      setShowAddDialog(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0d:0h:0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d:${hours}h:${minutes}m`;
  };

  const formatHashRate = (hashRate: number) => {
    if (hashRate >= 1000) {
      return `${(hashRate / 1000).toFixed(2)} TH/s`;
    }
    return `${hashRate.toFixed(2)} GH/s`;
  };

  const formatDiff = (diff: number) => {
    if (!diff) return '0';
    if (diff >= 1e12) return `${(diff / 1e12).toFixed(2)}T`;
    if (diff >= 1e9) return `${(diff / 1e9).toFixed(2)}B`;
    if (diff >= 1e6) return `${(diff / 1e6).toFixed(2)}M`;
    if (diff >= 1e3) return `${(diff / 1e3).toFixed(2)}K`;
    return diff.toString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Scanning network for mining devices...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Network Devices</h2>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                disabled={isScanning}
                variant="outline"
                className="gap-2"
              >
                <Search className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Scan Network'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Scan Network for Devices</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-1">ℹ️ Network Scanning</p>
                  <p className="text-muted-foreground">
                    Scanning will search for Bitaxe/Nerdaxe miners on your local network. 
                    Devices found will be saved automatically.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Network Range (first 3 octets)
                  </label>
                  <Input
                    placeholder="e.g., 192.168.1"
                    value={scanRange}
                    onChange={(e) => setScanRange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Will scan {scanRange}.1 through {scanRange}.254
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    onClick={() => scanNetwork(scanRange)} 
                    disabled={isScanning}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Start Scan
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={refreshDevices} 
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Mining Device</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="text-muted-foreground">
                    Manually add a Bitaxe or Nerdaxe device by entering its local network IP address.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Device IP Address
                  </label>
                  <Input
                    placeholder="Enter IP address (e.g., 192.168.1.100)"
                    value={newDeviceIP}
                    onChange={(e) => setNewDeviceIP(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddDevice()}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDevice}>
                    Add Device
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hashrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHashRate(totalHashRate)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Power</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPower.toFixed(0)} W</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDevices}</div>
            <p className="text-xs text-muted-foreground">of {totalDevices} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEfficiency.toFixed(2)} W/TH</div>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Tabs defaultValue="table" className="w-full">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="cards">Card View</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Device Details</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-12">
                  <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Mining Devices Found</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Start by scanning your local network or manually adding device IP addresses. 
                    Make sure your Bitaxe/Nerdaxe devices are powered on and connected to your network.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Search className="h-4 w-4 mr-2" />
                          Scan Network
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Scan Network for Devices</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-muted p-3 rounded-md text-sm">
                            <p className="font-medium mb-1">ℹ️ Network Scanning</p>
                            <p className="text-muted-foreground">
                              Scanning will search for miners on your local network. Found devices are saved automatically.
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Network Range (first 3 octets)
                            </label>
                            <Input
                              placeholder="e.g., 192.168.1"
                              value={scanRange}
                              onChange={(e) => setScanRange(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button 
                              onClick={() => scanNetwork(scanRange)} 
                              disabled={isScanning}
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Start Scan
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manually
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hashrate</TableHead>
                      <TableHead>Best Diff</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Power</TableHead>
                      <TableHead>Uptime</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.IP}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{device.name || device.IP}</div>
                            <div className="text-xs text-muted-foreground">{device.IP}</div>
                            <div className="text-sm text-muted-foreground">{device.model}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.isActive ? 'default' : 'destructive'}>
                            {device.isActive ? 'Online' : 'Offline'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {formatHashRate(device.hashRate || 0)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-500 font-medium">
                              {formatDiff(device.bestDiff || 0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Thermometer className="h-3 w-3" />
                            <span className={
                              (device.temp || 0) > 70 ? 'text-destructive' : 
                              (device.temp || 0) > 60 ? 'text-yellow-500' : ''
                            }>
                              {device.temp || 0}°C
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {device.power || 0}W
                          </div>
                        </TableCell>
                        <TableCell>{formatUptime(device.uptimeSeconds || 0)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {device.isActive && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <RotateCcw className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restart Device</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to restart {device.IP}? This will temporarily interrupt mining.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => restartDevice(device.IP)}>
                                      Restart
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Device</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {device.IP} from the device list?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeDevice(device.IP)}>
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <Card key={device.IP} className={device.isActive ? '' : 'opacity-60'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <CardTitle className="text-lg">{device.name || device.IP}</CardTitle>
                    </div>
                    <Badge variant={device.isActive ? 'default' : 'destructive'}>
                      {device.isActive ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{device.IP}</p>
                  <p className="text-sm text-muted-foreground">{device.model}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Hashrate</p>
                      <p className="font-semibold">{formatHashRate(device.hashRate || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Temperature</p>
                      <p className={`font-semibold ${
                        (device.temp || 0) > 70 ? 'text-destructive' : 
                        (device.temp || 0) > 60 ? 'text-yellow-500' : ''
                      }`}>
                        {device.temp || 0}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Power</p>
                      <p className="font-semibold">{device.power || 0}W</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                      <p className="font-semibold">{formatUptime(device.uptimeSeconds || 0)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {device.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restart
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restart Device</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to restart {device.IP}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => restartDevice(device.IP)}>
                              Restart
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Device</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {device.IP}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeDevice(device.IP)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};