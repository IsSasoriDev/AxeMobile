import { useState } from "react";
import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

const themes = [
  { id: "light", name: "White", className: "" },
  { id: "amoled", name: "AMOLED", className: "theme-amoled" },
  { id: "ixtech", name: "IxTech", className: "theme-ixtech" },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          Themes
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border">
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption.id}
            onClick={() => setTheme(themeOption.id)}
            className={theme === themeOption.id ? "bg-accent" : ""}
          >
            {themeOption.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}