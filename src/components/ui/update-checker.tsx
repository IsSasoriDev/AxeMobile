import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFirmwareUpdater } from "@/hooks/useFirmwareUpdater";
import { Download, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface UpdateCheckerProps {
  trigger?: React.ReactNode;
}

export function UpdateChecker({ trigger }: UpdateCheckerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [updates, setUpdates] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const { checkForUpdates } = useFirmwareUpdater();

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const latestUpdates = await checkForUpdates();
      setUpdates(latestUpdates);
      
      const hasUpdates = latestUpdates.app || latestUpdates.bitaxe || latestUpdates.nerdaxe;
      if (hasUpdates) {
        toast.success("Updates available!");
      } else {
        toast.success("All software is up to date");
      }
    } catch (error) {
      toast.error("Failed to check for updates");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleCheckUpdates();
    }
  }, [isOpen]);

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Check for Updates
          </Button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${checking ? 'animate-spin' : ''}`} />
              Software Updates
            </DialogTitle>
            <DialogDescription>
              Check for the latest versions of AxeMobile and firmware releases
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {checking ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Checking for updates...</p>
              </div>
            ) : updates ? (
              <div className="space-y-4">
                {/* AxeMobile App Updates */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">AxeMobile App</h3>
                    {updates.app ? (
                      <Badge variant="secondary">Update Available</Badge>
                    ) : (
                      <Badge variant="outline">Up to Date</Badge>
                    )}
                  </div>
                  
                  {updates.app ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>Latest Version:</strong> {updates.app.version}
                      </p>
                      {updates.app.body && (
                        <div className="text-sm">
                          <p className="font-medium">Release Notes:</p>
                          <div className="bg-muted/50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap">{updates.app.body}</pre>
                          </div>
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() => openExternalUrl(updates.app.htmlUrl)}
                        className="gap-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Release
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You're running the latest version of AxeMobile.
                    </p>
                  )}
                </div>

                {/* Bitaxe Firmware Updates */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Bitaxe Firmware</h3>
                    {updates.bitaxe ? (
                      <Badge variant="secondary">Update Available</Badge>
                    ) : (
                      <Badge variant="outline">Up to Date</Badge>
                    )}
                  </div>
                  
                  {updates.bitaxe ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>Latest Version:</strong> {updates.bitaxe.version}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openExternalUrl(updates.bitaxe.htmlUrl)}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Release
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openExternalUrl('https://bitaxeorg.github.io/bitaxe-web-flasher')}
                          className="gap-2"
                        >
                          <Download className="h-3 w-3" />
                          Flash Firmware
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Latest Bitaxe firmware is available.
                    </p>
                  )}
                </div>

                {/* NerdAxe Firmware Updates */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">NerdAxe Firmware</h3>
                    {updates.nerdaxe ? (
                      <Badge variant="secondary">Update Available</Badge>
                    ) : (
                      <Badge variant="outline">Up to Date</Badge>
                    )}
                  </div>
                  
                  {updates.nerdaxe ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>Latest Version:</strong> {updates.nerdaxe.version}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openExternalUrl(updates.nerdaxe.htmlUrl)}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Release
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openExternalUrl('https://shufps.github.io/nerdqaxe-web-flasher')}
                          className="gap-2"
                        >
                          <Download className="h-3 w-3" />
                          Flash Firmware
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Latest NerdAxe firmware is available.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Click the button below to check for updates</p>
                <Button onClick={handleCheckUpdates} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Check for Updates
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}