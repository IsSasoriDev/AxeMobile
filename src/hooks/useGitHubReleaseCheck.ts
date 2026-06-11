import { useState, useEffect, useCallback } from "react";

const REPO = "IsSasoriDev/AxeMobile";
const STORAGE_KEY = "axemobile_dismissed_release";
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 min

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
}

export function useGitHubReleaseCheck() {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const checkRelease = useCallback(async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const data: GitHubRelease = await res.json();

      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed !== data.tag_name) {
        setRelease(data);
        setShowPopup(true);
      }
    } catch {
      // silent fail
    }
  }, []);

  const dismiss = useCallback(() => {
    if (release) {
      localStorage.setItem(STORAGE_KEY, release.tag_name);
    }
    setShowPopup(false);
  }, [release]);

  useEffect(() => {
    // Check on mount after a short delay
    const t = setTimeout(checkRelease, 5000);
    // Re-check periodically
    const interval = setInterval(checkRelease, CHECK_INTERVAL);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [checkRelease]);

  return { release, showPopup, dismiss };
}
