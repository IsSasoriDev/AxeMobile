import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface WebViewFrameProps {
  url: string;
  title: string;
  onClose: () => void;
}

export function WebViewFrame({ url, title, onClose }: WebViewFrameProps) {
  return (
    <Card className="fixed inset-4 z-50 flex flex-col shadow-2xl">
      <CardHeader className="flex-row items-center justify-between py-3 px-4 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          allow="serial; usb; bluetooth"
        />
      </CardContent>
    </Card>
  );
}