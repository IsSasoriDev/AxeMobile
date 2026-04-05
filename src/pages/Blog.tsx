import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns/format";
import {
  BookOpen, Calendar, ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff,
  Image as ImageIcon, Link as LinkIcon, Bold, Italic, Heading, List, Save, X, Upload,
  Search, Tag, Hash, Clock
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover_image_url: string | null;
  tags: string[];
  published: boolean;
  created_at: string;
  updated_at: string;
}

const BLOG_ADMIN_EMAIL = "blog-admin@axemobile.app";
const BLOG_ADMIN_PASSWORD = "axemobileblogs";

const calculateReadingTime = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};

// ─── Admin Panel ───
const BlogAdmin = ({ onClose }: { onClose: () => void }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const fetchAllPosts = async () => {
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    setPosts((data as BlogPost[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAllPosts(); }, []);

  const generateSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const startNew = () => {
    setIsNew(true); setEditing(null);
    setTitle(""); setContent(""); setExcerpt(""); setCoverUrl(""); setPublished(false); setTagsInput("");
  };

  const startEdit = (post: BlogPost) => {
    setIsNew(false); setEditing(post);
    setTitle(post.title); setContent(post.content); setExcerpt(post.excerpt || "");
    setCoverUrl(post.cover_image_url || ""); setPublished(post.published);
    setTagsInput((post.tags || []).join(", "));
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const slug = generateSlug(title);
    const tags = tagsInput.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const payload = { title, slug, content, excerpt, cover_image_url: coverUrl || null, published, tags, updated_at: new Date().toISOString() };

    if (isNew) {
      const { error } = await supabase.from("blog_posts").insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Post created!");
    } else if (editing) {
      const { error } = await supabase.from("blog_posts").update(payload as any).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Post updated!");
    }
    setEditing(null); setIsNew(false); fetchAllPosts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Post deleted"); fetchAllPosts();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `blog/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("blog-images").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(path);
    setCoverUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Image uploaded!");
  };

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    setContent(prev => prev + prefix + suffix);
  };

  const isEditorOpen = isNew || editing !== null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono text-primary flex items-center gap-2">
          <Edit2 className="h-4 w-4" /> Blog Admin
        </h2>
        <div className="flex gap-2">
          {!isEditorOpen && (
            <Button size="sm" onClick={startNew} className="gap-1"><Plus className="h-3 w-3" /> New Post</Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}><X className="h-3 w-3" /></Button>
        </div>
      </div>

      {isEditorOpen ? (
        <div className="space-y-3">
          <Input placeholder="Post title..." value={title} onChange={e => setTitle(e.target.value)} className="font-bold text-lg" />
          <Input placeholder="Short excerpt..." value={excerpt} onChange={e => setExcerpt(e.target.value)} />
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input placeholder="Tags (comma separated): mining, bitcoin, hardware..." value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          </div>
          {tagsInput && (
            <div className="flex gap-1 flex-wrap">
              {tagsInput.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                <Badge key={tag} variant="secondary" className="text-[9px] gap-1"><Hash className="h-2 w-2" />{tag}</Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input placeholder="Cover image URL..." value={coverUrl} onChange={e => setCoverUrl(e.target.value)} className="flex-1" />
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button size="sm" variant="outline" asChild disabled={uploading}>
                <span><Upload className="h-3 w-3 mr-1" />{uploading ? "..." : "Upload"}</span>
              </Button>
            </label>
          </div>
          {coverUrl && (
            <div className="rounded-lg overflow-hidden border border-border/50 max-h-40">
              <img src={coverUrl} alt="Cover" className="w-full h-40 object-cover" />
            </div>
          )}
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => insertMarkdown("**", "bold text**")}><Bold className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insertMarkdown("*", "italic text*")}><Italic className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insertMarkdown("\n## ", "Heading\n")}><Heading className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insertMarkdown("\n- ", "List item\n")}><List className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insertMarkdown("[", "link text](https://url)")}><LinkIcon className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insertMarkdown("![", "alt text](https://image-url)")}><ImageIcon className="h-3 w-3" /></Button>
          </div>
          <Textarea placeholder="Write your article content here... (supports Markdown)" value={content} onChange={e => setContent(e.target.value)} className="min-h-[300px] font-mono text-sm" />
          <div className="flex items-center justify-between">
            <Button size="sm" variant={published ? "default" : "outline"} onClick={() => setPublished(!published)} className="gap-1">
              {published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {published ? "Published" : "Draft"}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}>Cancel</Button>
              <Button size="sm" onClick={handleSave} className="gap-1"><Save className="h-3 w-3" /> Save</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet. Create your first article!</p>
          ) : (
            posts.map(post => (
              <Card key={post.id} className="bg-card/50 border-border/30">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold truncate">{post.title}</span>
                      <Badge variant={post.published ? "default" : "secondary"} className="text-[9px]">
                        {post.published ? "Live" : "Draft"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(post.created_at), "MMM d, yyyy")}</span>
                      {(post.tags || []).length > 0 && (
                        <div className="flex gap-1">
                          {post.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[8px] px-1 py-0">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(post)}><Edit2 className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(post.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Markdown renderer ───
const renderMarkdown = (text: string) => {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3 text-foreground">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg my-4 max-w-full" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>')
    .replace(/\n/g, '<br/>');
};

// ─── Article View ───
const BlogArticle = ({ post, onBack, onTagClick }: { post: BlogPost; onBack: () => void; onTagClick: (tag: string) => void }) => (
  <ScrollArea className="h-full">
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 mb-2">
        <ArrowLeft className="h-3 w-3" /> Back to Blog
      </Button>
      {post.cover_image_url && (
        <div className="rounded-xl overflow-hidden border border-border/30">
          <img src={post.cover_image_url} alt={post.title} className="w-full h-48 md:h-64 object-cover" />
        </div>
      )}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{post.title}</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(post.created_at), "MMMM d, yyyy")}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{calculateReadingTime(post.content)} min read</span>
          {(post.tags || []).map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] cursor-pointer hover:bg-primary/20 transition-colors gap-1"
              onClick={() => { onTagClick(tag); onBack(); }}
            >
              <Hash className="h-2 w-2" />{tag}
            </Badge>
          ))}
        </div>
      </div>
      <div
        className="prose prose-invert max-w-none text-sm text-muted-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
      />
    </div>
  </ScrollArea>
);

// ─── Main Blog Page ───
export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [secretClicks, setSecretClicks] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase.from("blog_posts").select("*").eq("published", true).order("created_at", { ascending: false });
      setPosts((data as BlogPost[]) || []);
      setLoading(false);
    };
    fetchPosts();
  }, [isAdmin]);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [posts]);

  // Filter posts by search + tag
  const filteredPosts = useMemo(() => {
    let result = posts;
    if (activeTag) {
      result = result.filter(p => (p.tags || []).includes(activeTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.excerpt || "").toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.includes(q))
      );
    }
    return result;
  }, [posts, searchQuery, activeTag]);

  const handleSecretClick = () => {
    const newClicks = secretClicks + 1;
    setSecretClicks(newClicks);
    if (newClicks >= 5) {
      setShowPasswordDialog(true);
      setSecretClicks(0);
    }
  };

  const handlePasswordSubmit = async () => {
    if (password !== BLOG_ADMIN_PASSWORD) {
      toast.error("Wrong password");
      setPassword("");
      return;
    }

    const { error: seedError } = await supabase.functions.invoke("seed-admins", {
      body: { email: BLOG_ADMIN_EMAIL, password: BLOG_ADMIN_PASSWORD },
    });

    if (seedError) {
      toast.error("Failed to initialize admin access");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: BLOG_ADMIN_EMAIL,
      password: BLOG_ADMIN_PASSWORD,
    });

    if (signInError) {
      toast.error("Admin login failed");
      setPassword("");
      return;
    }

    setIsAdmin(true);
    setShowPasswordDialog(false);
    setPassword("");
    toast.success("Blog admin unlocked! ⛏️");
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(prev => prev === tag ? null : tag);
    setSelectedPost(null);
  };

  if (selectedPost) {
    return <BlogArticle post={selectedPost} onBack={() => setSelectedPost(null)} onTagClick={handleTagClick} />;
  }

  if (isAdmin) {
    return <BlogAdmin onClose={() => setIsAdmin(false)} />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
        {/* Header */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono text-foreground">Blog</h1>
              <p className="text-xs text-muted-foreground">Mining insights & updates</p>
            </div>
          </div>
          <button
            onClick={handleSecretClick}
            className="absolute top-0 right-0 w-3 h-3 rounded-full opacity-[0.08] hover:opacity-20 bg-muted-foreground transition-opacity"
            aria-hidden="true"
          />
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/50 border-border/30 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Tags filter */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTag(null)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                !activeTag
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border/30 text-muted-foreground hover:border-primary/20 hover:text-foreground"
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                  activeTag === tag
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "border-border/30 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`}
              >
                <Hash className="h-2 w-2" />{tag}
              </button>
            ))}
          </div>
        )}

        {/* Results info */}
        {(searchQuery || activeTag) && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{filteredPosts.length} article{filteredPosts.length !== 1 ? "s" : ""} found</span>
            {activeTag && (
              <Badge variant="secondary" className="text-[9px] gap-1">
                <Hash className="h-2 w-2" />{activeTag}
                <button onClick={() => setActiveTag(null)} className="ml-0.5 hover:text-foreground"><X className="h-2 w-2" /></button>
              </Badge>
            )}
          </div>
        )}

        {/* Posts grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-card/50 border-border/30 animate-pulse">
                <div className="h-40 bg-secondary/30 rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-secondary/30 rounded w-3/4" />
                  <div className="h-3 bg-secondary/20 rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-8 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {posts.length === 0 ? "No articles yet. Stay tuned!" : "No articles match your search."}
              </p>
              {(searchQuery || activeTag) && (
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => { setSearchQuery(""); setActiveTag(null); }}>
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPosts.map(post => (
              <Card
                key={post.id}
                className="bg-card/50 border-border/30 cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all duration-200 group overflow-hidden"
                onClick={() => setSelectedPost(post)}
              >
                {post.cover_image_url && (
                  <div className="overflow-hidden">
                    <img src={post.cover_image_url} alt={post.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold font-mono text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {calculateReadingTime(post.content)} min
                      </span>
                    </div>
                    {(post.tags || []).length > 0 && (
                      <div className="flex gap-1">
                        {post.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[9px] font-mono text-muted-foreground/50 flex items-center gap-0.5">
                            <Hash className="h-2 w-2" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono">🔒 Admin Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
              autoFocus
            />
            <Button size="sm" className="w-full" onClick={handlePasswordSubmit}>Unlock</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
