import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Shield, LogOut, Send, Plus, Trash2, Megaphone, AlertTriangle, 
  Sparkles, Calendar, Link as LinkIcon, User, ImagePlus, X
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  active: boolean;
  created_at: string;
  expires_at: string | null;
  image_url: string | null;
}

export default function Admin() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Announcement form
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [link, setLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchAnnouncements();
  }, [session]);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from("announcements" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAnnouncements(data as unknown as Announcement[]);
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    const email = username.includes("@") ? username : `${username.toLowerCase()}@axemobile.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Invalid credentials");
    } else {
      toast.success("Logged in");
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const [dragOver, setDragOver] = useState(false);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("announcement-images")
      .upload(fileName, file, { contentType: file.type });
    if (error) {
      toast.error("Failed to upload image");
      return null;
    }
    const { data: urlData } = supabase.storage
      .from("announcement-images")
      .getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSubmitting(true);

    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (!imageUrl) { setSubmitting(false); return; }
    }

    const fullMessage = link ? `${message.trim()}\n🔗 ${link.trim()}` : message.trim();
    const { error } = await supabase
      .from("announcements" as any)
      .insert({ title: title.trim(), message: fullMessage, type, active: true, image_url: imageUrl } as any);
    if (error) {
      toast.error("Failed to create announcement");
    } else {
      toast.success("Announcement published!");
      setTitle("");
      setMessage("");
      setLink("");
      setType("info");
      clearImage();
      fetchAnnouncements();
    }
    setSubmitting(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("announcements" as any).update({ active: !active } as any).eq("id", id);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from("announcements" as any).delete().eq("id", id);
    fetchAnnouncements();
    toast.success("Deleted");
  };

  const typeIcons: Record<string, typeof Megaphone> = {
    info: Megaphone,
    warning: AlertTriangle,
    update: Sparkles,
    event: Calendar,
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin-slow h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4 animate-scale-up">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-lg font-bold font-mono">Admin Login</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Announcement Management</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Username</Label>
              <div className="relative mt-1">
                <User className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="h-8 text-xs font-mono pl-8"
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-8 text-xs font-mono mt-1"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} disabled={loginLoading} className="w-full h-8 text-xs font-mono gap-2">
              {loginLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Announcements</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
              Logged in as {session.user.email?.split("@")[0]}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="h-7 text-[10px] font-mono gap-1.5">
          <LogOut className="h-3 w-3" /> Logout
        </Button>
      </div>

      {/* Create New */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3 animate-slide-up">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">New Announcement</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" className="h-8 text-xs font-mono mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs font-mono mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">ℹ️ Info</SelectItem>
                <SelectItem value="warning">⚠️ Warning</SelectItem>
                <SelectItem value="update">✨ Update</SelectItem>
                <SelectItem value="event">📅 Event</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[10px] font-mono uppercase text-muted-foreground">Message</Label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write your announcement..."
            className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Image Upload */}
        <div>
          <Label className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
            <ImagePlus className="h-3 w-3" /> Image (optional)
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative mt-1 rounded-lg overflow-hidden border border-border/40 max-h-32">
              <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
              <button
                onClick={clearImage}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-full mt-1 h-20 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground ${
                dragOver ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-secondary/10 hover:bg-secondary/20"
              }`}
            >
              <ImagePlus className="h-4 w-4" />
              {dragOver ? "Drop image here" : "Click or drag & drop image"}
            </button>
          )}
        </div>

        <div>
          <Label className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
            <LinkIcon className="h-3 w-3" /> Link (optional)
          </Label>
          <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="h-8 text-xs font-mono mt-1" />
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full h-8 text-xs font-mono gap-2">
          <Send className="h-3 w-3" /> {submitting ? "Publishing..." : "Publish Announcement"}
        </Button>
      </div>

      {/* Existing Announcements */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3">
        <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">
          All Announcements ({announcements.length})
        </h2>
        {announcements.length === 0 ? (
          <p className="text-[10px] font-mono text-muted-foreground text-center py-4">No announcements yet</p>
        ) : (
          <div className="space-y-2">
            {announcements.map(a => {
              const Icon = typeIcons[a.type] || Megaphone;
              return (
                <div key={a.id} className={`p-3 rounded-lg border transition-all ${
                  a.active ? "border-border/40 bg-secondary/20" : "border-border/20 bg-secondary/5 opacity-50"
                }`}>
                  <div className="flex items-start gap-2">
                    <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono font-bold">{a.title}</p>
                      <p className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap line-clamp-2">{a.message}</p>
                      <p className="text-[8px] font-mono text-muted-foreground/60 mt-1">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch checked={a.active} onCheckedChange={() => toggleActive(a.id, a.active)} />
                      <button onClick={() => deleteAnnouncement(a.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                  {a.image_url && (
                    <div className="mt-2 rounded-md overflow-hidden border border-border/30 max-h-24">
                      <img src={a.image_url} alt={a.title} className="w-full h-24 object-cover" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
