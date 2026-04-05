import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, ExternalLink, Sparkles } from "lucide-react";
import { useGitHubReleaseCheck } from "@/hooks/useGitHubReleaseCheck";

export function ReleasePopup() {
  const { release, showPopup, dismiss } = useGitHubReleaseCheck();

  if (!release) return null;

  return (
    <Dialog open={showPopup} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <Sparkles className="h-5 w-5 text-primary" />
            Update Available
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            A new version of AxeMobile has been released
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-bold">{release.name || release.tag_name}</span>
            <Badge variant="secondary" className="font-mono text-[10px]">{release.tag_name}</Badge>
          </div>

          {release.body && (
            <ScrollArea className="max-h-48 rounded-lg border border-border/40 bg-secondary/20 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {release.body}
              </pre>
            </ScrollArea>
          )}

          <p className="text-[10px] text-muted-foreground font-mono">
            Released {new Date(release.published_at).toLocaleDateString()}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={dismiss} className="font-mono text-xs">
            Later
          </Button>
          <Button
            size="sm"
            className="gap-1.5 font-mono text-xs"
            onClick={() => { window.open(release.html_url, "_blank", "noopener,noreferrer"); dismiss(); }}
          >
            <ExternalLink className="h-3 w-3" />
            View Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
