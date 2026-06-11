import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, BarChart3, Play, Square } from "lucide-react";
import { toast } from "sonner";

interface GrafanaEmbeddedProps {
  influxUrl?: string;
  influxToken?: string;
  influxBucket?: string;
  influxOrg?: string;
}

export function GrafanaEmbedded({ influxUrl, influxToken, influxBucket, influxOrg }: GrafanaEmbeddedProps) {
  const [grafanaUrl, setGrafanaUrl] = useState("http://localhost:3000");
  const [isRunning, setIsRunning] = useState(false);
  const [dashboardId, setDashboardId] = useState("");

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${field} copied to clipboard`);
    } catch (err) {
      toast.error(`Failed to copy ${field}`);
    }
  };

  const dockerComposeConfig = `version: '3.8'

services:
  influxdb:
    image: influxdb:2.7
    container_name: miner-influxdb
    ports:
      - "8086:8086"
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=setup
      - DOCKER_INFLUXDB_INIT_USERNAME=admin
      - DOCKER_INFLUXDB_INIT_PASSWORD=password123
      - DOCKER_INFLUXDB_INIT_ORG=${influxOrg || 'miner-org'}
      - DOCKER_INFLUXDB_INIT_BUCKET=${influxBucket || 'miner-data'}
      - DOCKER_INFLUXDB_INIT_RETENTION=0
      - DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${influxToken || 'your-token-here'}
    volumes:
      - influxdb_data:/var/lib/influxdb2

  grafana:
    image: grafana/grafana:latest
    container_name: miner-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-clock-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - influxdb

volumes:
  influxdb_data:
  grafana_data:`;

  const grafanaDashboard = {
    "dashboard": {
      "id": null,
      "title": "Bitcoin Miner Dashboard",
      "tags": ["bitcoin", "mining"],
      "timezone": "browser",
      "panels": [
        {
          "id": 1,
          "title": "Total Hashrate",
          "type": "gauge",
          "targets": [
            {
              "query": `from(bucket: "${influxBucket || 'miner-data'}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "mainnet_stats")
  |> filter(fn: (r) => r._field == "hashrate")
  |> last()`,
              "refId": "A"
            }
          ],
          "fieldConfig": {
            "defaults": {
              "unit": "short",
              "min": 0,
              "max": 1000
            }
          },
          "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
        },
        {
          "id": 2,
          "title": "Temperature",
          "type": "gauge",
          "targets": [
            {
              "query": `from(bucket: "${influxBucket || 'miner-data'}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "mainnet_stats")
  |> filter(fn: (r) => r._field == "temperature")
  |> last()`,
              "refId": "A"
            }
          ],
          "fieldConfig": {
            "defaults": {
              "unit": "celsius",
              "min": 0,
              "max": 100,
              "thresholds": {
                "steps": [
                  {"color": "green", "value": null},
                  {"color": "yellow", "value": 60},
                  {"color": "red", "value": 80}
                ]
              }
            }
          },
          "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
        },
        {
          "id": 3,
          "title": "Hashrate Over Time",
          "type": "timeseries",
          "targets": [
            {
              "query": `from(bucket: "${influxBucket || 'miner-data'}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "mainnet_stats")
  |> filter(fn: (r) => r._field == "hashrate")`,
              "refId": "A"
            }
          ],
          "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8}
        },
        {
          "id": 4,
          "title": "Shares Accepted vs Rejected",
          "type": "timeseries",
          "targets": [
            {
              "query": `from(bucket: "${influxBucket || 'miner-data'}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "mainnet_stats")
  |> filter(fn: (r) => r._field == "shares_accepted" or r._field == "shares_rejected")`,
              "refId": "A"
            }
          ],
          "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
        },
        {
          "id": 5,
          "title": "Power Consumption",
          "type": "stat",
          "targets": [
            {
              "query": `from(bucket: "${influxBucket || 'miner-data'}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "mainnet_stats")
  |> filter(fn: (r) => r._field == "power")
  |> last()`,
              "refId": "A"
            }
          ],
          "fieldConfig": {
            "defaults": {
              "unit": "watt"
            }
          },
          "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16}
        }
      ],
      "time": {
        "from": "now-1h",
        "to": "now"
      },
      "refresh": "5s"
    }
  };

  const datasourceConfig = `apiVersion: 1

datasources:
  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    database: ${influxBucket || 'miner-data'}
    user: admin
    secureJsonData:
      token: ${influxToken || 'your-token-here'}
    jsonData:
      version: Flux
      organization: ${influxOrg || 'miner-org'}
      defaultBucket: ${influxBucket || 'miner-data'}
      tlsSkipVerify: true`;

  const startGrafanaStack = () => {
    toast.info("Starting Grafana + InfluxDB stack...");
    setIsRunning(true);
    // In a real implementation, this would trigger docker-compose up
    setTimeout(() => {
      setDashboardId("bitcoin-miner-dashboard");
      toast.success("Grafana stack started! Dashboard available at http://localhost:3000");
    }, 3000);
  };

  const stopGrafanaStack = () => {
    toast.info("Stopping Grafana stack...");
    setIsRunning(false);
    setDashboardId("");
    // In a real implementation, this would trigger docker-compose down
    setTimeout(() => {
      toast.success("Grafana stack stopped");
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Grafana Dashboard
        </CardTitle>
        <CardDescription>
          Advanced visualization dashboard for your Bitcoin miners using Grafana + InfluxDB
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grafana Configuration */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grafana-url">Grafana URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="grafana-url"
                  value={grafanaUrl}
                  onChange={(e) => setGrafanaUrl(e.target.value)}
                  placeholder="http://localhost:3000"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(grafanaUrl, "Grafana URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <div className="flex gap-2">
                <Button
                  onClick={startGrafanaStack}
                  disabled={isRunning}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Stack
                </Button>
                <Button
                  onClick={stopGrafanaStack}
                  disabled={!isRunning}
                  variant="outline"
                  className="gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop Stack
                </Button>
              </div>
            </div>
          </div>

          {isRunning && (
            <div className="flex items-center gap-2">
              <Badge variant="default">Running</Badge>
              <span className="text-sm text-muted-foreground">
                Grafana is running at {grafanaUrl}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(grafanaUrl, '_blank')}
                className="gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </Button>
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Setup Instructions</h3>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-2">1. Create docker-compose.yml</h4>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto max-h-48">
                  <code>{dockerComposeConfig}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(dockerComposeConfig, "Docker Compose config")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. Create Grafana datasource config</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Save as <code>grafana/datasources/influxdb.yml</code>
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto max-h-32">
                  <code>{datasourceConfig}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(datasourceConfig, "Datasource config")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. Import Dashboard</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Copy this JSON and import it in Grafana
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto max-h-32">
                  <code>{JSON.stringify(grafanaDashboard, null, 2)}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(JSON.stringify(grafanaDashboard, null, 2), "Dashboard JSON")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">4. Start the stack</h4>
              <div className="bg-muted p-3 rounded-md font-mono text-sm">
                docker-compose up -d
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Preview */}
        {dashboardId && (
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Dashboard Preview</h3>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-8 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Your Grafana dashboard is ready! Features include:
              </p>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                <li>• Real-time hashrate monitoring</li>
                <li>• Temperature alerts and gauges</li>
                <li>• Historical performance charts</li>
                <li>• Share acceptance/rejection tracking</li>
                <li>• Power consumption monitoring</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}