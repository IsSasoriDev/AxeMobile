import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { invoke } from "@tauri-apps/api/core";
import { X, Minimize2 } from "lucide-react";

interface CloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloseDialog({ open, onOpenChange }: CloseDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleExit = async () => {
    if (rememberChoice) {
      // Save preference to NOT minimize (just exit)
      localStorage.setItem("closeAction", "exit");
    }
    await invoke("quit_app");
    onOpenChange(false);
  };

  const handleMinimize = async () => {
    if (rememberChoice) {
      // Save preference to minimize to tray
      localStorage.setItem("closeAction", "minimize");
      await invoke("set_minimize_to_tray", { enabled: true });
    }
    await invoke("hide_to_tray");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close AxeMobile?</AlertDialogTitle>
          <AlertDialogDescription>
            Would you like to exit the app completely or minimize it to the
            system tray? When minimized, you can click the tray icon to restore
            the window.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id="remember"
            checked={rememberChoice}
            onCheckedChange={(checked) => setRememberChoice(checked === true)}
          />
          <label
            htmlFor="remember"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Remember my choice
          </label>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleMinimize}>
            <Minimize2 className="mr-2 h-4 w-4" />
            Minimize to Tray
          </Button>
          <Button variant="destructive" onClick={handleExit}>
            <X className="mr-2 h-4 w-4" />
            Exit
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
