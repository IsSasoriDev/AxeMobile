import { useEffect } from "react";

const AtlasPool = () => {
  useEffect(() => {
    let url = "https://atlaspool.io";
    try {
      const saved = localStorage.getItem("axemobile-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.atlasPoolWallet) {
          url = `https://atlaspool.io/dashboard.html?wallet=${encodeURIComponent(settings.atlasPoolWallet)}`;
        }
      }
    } catch {}
    window.open(url, "_blank");
    window.history.back();
  }, []);

  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-muted-foreground font-mono">Opening AtlasPool...</p>
    </div>
  );
};

export default AtlasPool;
