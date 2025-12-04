import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReloadButton() {
  const handleReload = () => {
    toast.success("Reloading app...");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <Button 
      variant="outline" 
      size="icon" 
      className="h-8 w-8"
      onClick={handleReload}
      title="Reload App"
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );
}
