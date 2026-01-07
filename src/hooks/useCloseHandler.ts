import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useCloseHandler() {
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  useEffect(() => {
    // Check saved preference on mount
    const savedChoice = localStorage.getItem("closeAction");
    if (savedChoice === "minimize") {
      invoke("set_minimize_to_tray", { enabled: true });
    } else if (savedChoice === "exit") {
      invoke("set_minimize_to_tray", { enabled: false });
    }

    // Listen for close request from window
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          const savedChoice = localStorage.getItem("closeAction");
          
          if (!savedChoice) {
            // No saved preference, show dialog
            event.preventDefault();
            setShowCloseDialog(true);
          }
          // If there's a saved choice, the Rust backend will handle it
        });
      } catch (error) {
        console.log("Not running in Tauri environment");
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const resetClosePreference = useCallback(async () => {
    localStorage.removeItem("closeAction");
    await invoke("set_minimize_to_tray", { enabled: false });
  }, []);

  return {
    showCloseDialog,
    setShowCloseDialog,
    resetClosePreference,
  };
}
