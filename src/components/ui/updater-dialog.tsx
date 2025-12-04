import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Download, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

export function UpdaterDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { toast } = useToast();

  const checkForUpdates = async () => {
    if (!window.__TAURI__) return;
    
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      
      if (update) {
        setUpdateAvailable(true);
        setCurrentVersion(update.currentVersion);
        setLatestVersion(update.version);
        setIsOpen(true);
        
        toast({
          title: "Update Available",
          description: `Version ${update.version} is available for download.`,
        });
      } else {
        toast({
          title: "Up to Date",
          description: "You're running the latest version.",
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast({
        title: "Update Check Failed",
        description: "Could not check for updates. Please try again later.",
        variant: "destructive",
      });
    }
  };

  const downloadAndInstall = async () => {
    if (!window.__TAURI__) return;
    
    try {
      setIsDownloading(true);
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      
      if (update) {
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              setDownloadProgress(0);
              break;
            case 'Progress':
              setDownloadProgress(event.data.chunkLength);
              break;
            case 'Finished':
              setDownloadProgress(100);
              break;
          }
        });

        toast({
          title: "Update Installed",
          description: "Restarting application...",
        });

        await relaunch();
      }
    } catch (error) {
      console.error('Failed to download and install update:', error);
      toast({
        title: "Update Failed",
        description: "Could not install update. Please try again.",
        variant: "destructive",
      });
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    // Check for updates on mount (only in Tauri environment)
    if (window.__TAURI__) {
      checkForUpdates();
    }
  }, []);

  if (!window.__TAURI__) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Update Available
            </DialogTitle>
            <DialogDescription>
              A new version of AxeMobile is ready to install.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Version:</span>
                <span className="font-medium">{currentVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Latest Version:</span>
                <span className="font-medium text-primary">{latestVersion}</span>
              </div>
            </div>

            {isDownloading && (
              <div className="space-y-2">
                <Progress value={downloadProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Downloading update...
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isDownloading}
            >
              Later
            </Button>
            <Button
              onClick={downloadAndInstall}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Update Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
