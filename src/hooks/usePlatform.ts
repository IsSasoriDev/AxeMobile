import { useState, useEffect } from "react";

export type Platform = "pc" | "mobile";

export function usePlatform() {
  const [platform, setPlatformState] = useState<Platform | null>(() => {
    const saved = localStorage.getItem("axemobile-platform");
    return saved as Platform | null;
  });

  const [textSize, setTextSizeState] = useState<"small" | "medium" | "large">(() => {
    return (localStorage.getItem("axemobile-text-size") as any) || "medium";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("text-size-small", "text-size-medium", "text-size-large");
    root.classList.add(`text-size-${textSize}`);
    localStorage.setItem("axemobile-text-size", textSize);
  }, [textSize]);

  const setPlatform = (p: Platform) => {
    setPlatformState(p);
    localStorage.setItem("axemobile-platform", p);
  };

  const setTextSize = (size: "small" | "medium" | "large") => {
    setTextSizeState(size);
  };

  const isFirstTime = platform === null;
  const isMobile = platform === "mobile";

  return { platform, setPlatform, isFirstTime, isMobile, textSize, setTextSize };
}
