import { useState } from "react";
import { Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
// Using uploaded images as base64 or direct paths
const bitaxeIcon = "/lovable-uploads/7adf75f8-8945-4fd7-860c-25e1ed367b3c.png";
const nerdaxeIcon = "/lovable-uploads/e4e02e37-303c-4cd3-ab4d-7ba7dba7a3ea.png";

const devices = [
  {
    id: "bitaxe",
    name: "Bitaxe",
    description: "Flash firmware for Bitaxe miners",
    icon: bitaxeIcon,
    url: "https://bitaxeorg.github.io/bitaxe-web-flasher",
    color: "text-primary",
  },
  {
    id: "nerdaxe", 
    name: "NerdAxe",
    description: "Flash firmware for NerdAxe miners", 
    icon: nerdaxeIcon,
    url: "https://shufps.github.io/nerdqaxe-web-flasher",
    color: "text-accent",
  },
];

export default function FlashFirmware() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
  };

  const handleCloseWebView = () => {
    setSelectedDevice(null);
  };

  const selectedDeviceData = devices.find(d => d.id === selectedDevice);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Flash Firmware
        </h1>
        <p className="text-muted-foreground mt-1">
          Update your miner firmware with the latest releases
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {devices.map((device) => {
          return (
            <Card 
              key={device.id} 
              className="shadow-card hover:shadow-glow transition-all duration-300 cursor-pointer group"
              onClick={() => handleDeviceSelect(device.id)}
            >
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform p-2">
                  <img 
                    src={device.icon} 
                    alt={`${device.name} icon`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <CardTitle className="text-xl">{device.name}</CardTitle>
                <CardDescription>{device.description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <Button className="w-full gap-2" variant="outline">
                  <Zap className="h-4 w-4" />
                  Flash Firmware
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-lg p-6 text-center">
        <Zap className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h3 className="text-lg font-semibold mb-2">Important Notice</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Flashing firmware will update your miner's software. Make sure your device is properly connected 
          and powered before proceeding. Interrupting the flash process may damage your device.
        </p>
      </div>

      {selectedDevice && selectedDeviceData && (
        <WebViewFrame
          url={selectedDeviceData.url}
          title={`${selectedDeviceData.name} Firmware Flasher`}
          onClose={handleCloseWebView}
        />
      )}
    </div>
  );
}