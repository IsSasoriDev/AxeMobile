import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "update" | "event";
  created_at: string;
  image_url?: string | null;
}

async function sendNativeNotification(title: string, body: string) {
  try {
    if (window.__TAURI__) {
      const { sendNotification, isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) { sendNotification({ title, body }); return; }
    }
  } catch {}
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [{ title, body, id: Math.floor(Math.random() * 100000), schedule: { at: new Date(Date.now() + 500) } }],
    });
    return;
  } catch {}
  try {
    if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission === "granted") new Notification(title, { body, icon: "/favicon.ico" });
    }
  } catch {}
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("axemobile-dismissed-announcements") || "[]"); }
    catch { return []; }
  });
  const knownIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  const enabled = useMemo(() => {
    try {
      const settings = JSON.parse(localStorage.getItem("axemobile-settings") || "{}");
      return settings.announcementsEnabled !== false;
    } catch { return true; }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        const typed = data as unknown as Announcement[];
        if (!isInitialLoad.current) {
          for (const a of typed) {
            if (!knownIds.current.has(a.id)) {
              sendNativeNotification(`📢 ${a.title}`, a.message);
            }
          }
        }
        isInitialLoad.current = false;
        knownIds.current = new Set(typed.map(a => a.id));
        setAnnouncements(typed);
      }
    };

    fetchAnnouncements();

    const channel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => { fetchAnnouncements(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  const dismiss = (id: string) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    localStorage.setItem("axemobile-dismissed-announcements", JSON.stringify(updated));
  };

  const visible = announcements.filter(a => !dismissed.includes(a.id));

  return { announcements: visible, dismiss, enabled };
}
