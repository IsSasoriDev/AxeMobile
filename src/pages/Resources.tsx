import { useState } from "react";
import { BookMarked, Calculator, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ResourceCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  iframeUrl: string;
}

const resources: ResourceCard[] = [
  {
    id: "block-probability",
    title: "Block Probability Calculator",
    description: "Estimate your chances of finding a solo block based on your hashrate, duration, and current network difficulty.",
    icon: <Calculator className="h-5 w-5" />,
    badge: "AtlasPool",
    iframeUrl: "https://atlaspool.io/resources/calculators/embed/block-probability.html?hashrate=200&unit=TH&duration=7&durationUnit=days&difficulty=133.79&difficultyUnit=T",
  },
];

export default function Resources() {
  const [activeResource, setActiveResource] = useState<string | null>(null);

  const active = resources.find((r) => r.id === activeResource);

  if (active) {
    return (
      <div className="h-full flex flex-col min-h-[calc(100vh-8rem)] md:min-h-0 md:h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {active.icon}
            <h3 className="text-sm font-bold font-mono">{active.title}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActiveResource(null)} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1">
          <iframe
            src={active.iframeUrl}
            className="w-full h-full border-0 min-h-[calc(100vh-12rem)] md:min-h-[650px]"
            title={active.title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <BookMarked className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold font-mono tracking-tight">Resources</h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Tools & Calculators</p>
        </div>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resources.map((resource) => (
          <button
            key={resource.id}
            onClick={() => setActiveResource(resource.id)}
            className="text-left group"
          >
            <Card className="h-full border border-border/40 bg-card/40 backdrop-blur-sm hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary/20 transition-colors">
                    {resource.icon}
                  </div>
                  {resource.badge && (
                    <Badge variant="outline" className="text-[9px] font-mono border-accent/30 text-accent">
                      {resource.badge}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <h3 className="text-sm font-bold font-mono mb-1 group-hover:text-primary transition-colors">{resource.title}</h3>
                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">{resource.description}</p>
                <div className="flex items-center gap-1 mt-3 text-[10px] text-primary font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="h-3 w-3" /> Open tool
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
