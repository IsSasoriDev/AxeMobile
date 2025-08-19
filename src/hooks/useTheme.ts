import { useState, useEffect } from "react";

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("axemobile-theme") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove("theme-amoled", "theme-ixtech");
    
    // Add current theme class
    if (theme === "amoled") {
      root.classList.add("theme-amoled");
    } else if (theme === "ixtech") {
      root.classList.add("theme-ixtech");
    }
    
    localStorage.setItem("axemobile-theme", theme);
  }, [theme]);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}