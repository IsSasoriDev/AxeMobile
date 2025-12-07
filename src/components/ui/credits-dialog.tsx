import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShoppingBag, Heart } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { createPortal } from "react-dom";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
import dtvLogo from "@/assets/dtv-electronics-logo.png";

interface CreditsDialogProps {
  trigger: React.ReactNode;
}

export function CreditsDialog({ trigger }: CreditsDialogProps) {
  const [showDTVWebview, setShowDTVWebview] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDTVShopClick = () => {
    navigator.clipboard.writeText("https://dtvelectronics.com/");
    toast.success("Link copied! Opening DTV Electronics shop...");
    setOpen(false);
    setTimeout(() => {
      setShowDTVWebview(true);
    }, 150);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Credits
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
                AxeMobile
              </h3>
              <p className="text-sm text-muted-foreground">
                Open Source Mining Dashboard
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Supporters
              </h4>
              
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                <div className="flex items-center gap-3">
                  <img 
                    src={dtvLogo} 
                    alt="DTV Electronics" 
                    className="h-10 w-10 object-contain"
                  />
                  <div>
                    <span className="rainbow-text text-base font-semibold">DTV Electronics</span>
                    <p className="text-xs text-muted-foreground">First Supporter • EST. BLOCK 723,420</p>
                  </div>
                </div>
                <button 
                  onClick={handleDTVShopClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary font-medium text-sm transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" />
                  SHOP
                </button>
              </div>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Built with ❤️ by the OSMU Community
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showDTVWebview && createPortal(
        <WebViewFrame
          url="https://dtvelectronics.com/"
          title="DTV Electronics Shop"
          onClose={() => setShowDTVWebview(false)}
        />,
        document.body
      )}
    </>
  );
}