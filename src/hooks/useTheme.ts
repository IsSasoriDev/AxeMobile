import { useState, useEffect } from "react";

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("axemobile-theme") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove("theme-amoled", "theme-disco", "theme-ixtech", "theme-bitaxe", "theme-bitcoin", "theme-powermining", "theme-dtv");
    
    // Add current theme class
    if (theme === "amoled") {
      root.classList.add("theme-amoled");
    } else if (theme === "disco") {
      root.classList.add("theme-disco");
    } else if (theme === "ixtech") {
      root.classList.add("theme-ixtech");
    } else if (theme === "bitaxe") {
      root.classList.add("theme-bitaxe");
    } else if (theme === "bitcoin") {
      root.classList.add("theme-bitcoin");
    } else if (theme === "powermining") {
      root.classList.add("theme-powermining");
    } else if (theme === "dtv") {
      root.classList.add("theme-dtv");
    }
    
    localStorage.setItem("axemobile-theme", theme);
  }, [theme]);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}