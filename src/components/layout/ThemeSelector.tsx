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
  { id: "disco", name: "Disco", className: "theme-disco" },
  { id: "ixtech", name: "IxTech", className: "theme-ixtech" },
  { id: "bitaxe", name: "Bitaxe", className: "theme-bitaxe" },
  { id: "bitcoin", name: "Bitcoin", className: "theme-bitcoin" },
  { id: "powermining", name: "PowerMining", className: "theme-powermining" },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border">
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption.id}
            onClick={() => handleThemeChange(themeOption.id)}
            className={theme === themeOption.id ? "bg-accent" : ""}
          >
            {themeOption.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}