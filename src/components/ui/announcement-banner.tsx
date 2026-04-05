import { useState } from "react";
import { X, Megaphone, AlertTriangle, Sparkles, Calendar, Copy, Check, Image as ImageIcon } from "lucide-react";
import { useAnnouncements, Announcement } from "@/hooks/useAnnouncements";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const typeConfig = {
  info: { icon: Megaphone, bg: "bg-primary/10 border-primary/30", text: "text-primary" },
  warning: { icon: AlertTriangle, bg: "bg-warning/10 border-warning/30", text: "text-warning" },
  update: { icon: Sparkles, bg: "bg-accent/10 border-accent/30", text: "text-accent" },
  event: { icon: Calendar, bg: "bg-info/10 border-info/30", text: "text-info" },
};

function AnnouncementModal({ announcement, open, onClose }: { announcement: Announcement | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!announcement) return null;

  const config = typeConfig[announcement.type] || typeConfig.info;
  const Icon = config.icon;

  // Extract link from message if present
  const linkMatch = announcement.message.match(/🔗\s*(https?:\/\/\S+)/);
  const messageText = announcement.message.replace(/\n🔗\s*https?:\/\/\S+/, "").trim();

  const handleCopyLink = () => {
    if (linkMatch?.[1]) {
      navigator.clipboard.writeText(linkMatch[1]);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border/40 bg-card/95 backdrop-blur-xl">
        <DialogTitle className="sr-only">{announcement.title}</DialogTitle>
        {announcement.image_url && (
          <div className="w-full max-h-64 overflow-hidden bg-black/20">
            <img
              src={announcement.image_url}
              alt={announcement.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`h-4 w-4 ${config.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-mono font-bold uppercase tracking-wider ${config.text}`}>
                {announcement.title}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                {new Date(announcement.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {messageText}
          </p>

          {linkMatch?.[1] && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
              <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
                {linkMatch[1]}
              </span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 p-1.5 rounded-md hover:bg-secondary/50 transition-colors"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementBanner() {
  const { announcements, dismiss, enabled } = useAnnouncements();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  if (!enabled || announcements.length === 0) return null;

  return (
    <>
      <div className="space-y-1.5 px-3 pt-2 animate-slide-down">
        {announcements.slice(0, 3).map((a) => {
          const config = typeConfig[a.type] || typeConfig.info;
          const Icon = config.icon;
          return (
            <div
              key={a.id}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${config.bg} backdrop-blur-sm animate-scale-up transition-all duration-300 cursor-pointer hover:brightness-110`}
              onClick={() => setSelectedAnnouncement(a)}
            >
              <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.text}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[10px] font-mono font-bold uppercase tracking-wider ${config.text}`}>
                    {a.title}
                  </p>
                  {a.image_url && <ImageIcon className="h-2.5 w-2.5 text-muted-foreground/50" />}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground leading-relaxed line-clamp-1">
                  {a.message.replace(/\n🔗\s*https?:\/\/\S+/, "")}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(a.id); }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary/50 transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          );
        })}
      </div>

      <AnnouncementModal
        announcement={selectedAnnouncement}
        open={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </>
  );
}
