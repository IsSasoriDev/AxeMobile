import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1407784261863477362/A4ZiMm6V9vHAlQoDpE3mc7Ow6VaoLDQD_86gNLXiRzaBaumPIltpDbd-YSXwJsmkAz1m";

export function SuggestionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!suggestion.trim()) {
      toast({
        title: "Error",
        description: "Please enter a suggestion",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `**New Suggestion from AxeMobile Dashboard:**\n\n${suggestion}\n\n*Submitted at: ${new Date().toLocaleString()}*`,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Suggestion Sent!",
        description: "Thank you for your feedback. Your suggestion has been sent to our Discord.",
      });

      setSuggestion("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error sending suggestion:", error);
      toast({
        title: "Error",
        description: "Failed to send suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Leave a Suggestion
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send us a Suggestion</DialogTitle>
          <DialogDescription>
            Help us improve AxeMobile by sharing your ideas and feedback.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Share your suggestion, feature request, or feedback..."
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            className="min-h-[120px] resize-none"
            disabled={isLoading}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Suggestion
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}